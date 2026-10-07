import Phaser from 'phaser';
import { tune } from '../sim/tune';
import { VIEW } from './pixelRatio';

const KEY='PunchiesGymFloor';
const projection={sourceY:0,anchorY:0,referenceScale:1,zoom:1};
// Both floor columns and ring ropes aim at this screen-space point.
export function arenaVanishingY(): number {
  return VIEW.top-VIEW.height*tune.view.arena.vanishingHeight;
}
export function updateGymProjection(image: Phaser.GameObjects.Image): void {
  projection.sourceY=image.y-image.displayHeight*(0.5+tune.view.arena.floorSourceVanishingHeight);
  projection.anchorY=VIEW.cy;
  projection.zoom=image.scaleX/projection.referenceScale;
}
class GymFloorPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({game,name:KEY,fragShader:`
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec4 uView;
uniform vec4 uProjection;
uniform vec2 uTileSize;
varying vec2 outTexCoord;
void main() {
  vec2 uv=vec2(outTexCoord.x,1.0-outTexCoord.y);
  float y=uView.y+uv.y*uView.w;
  float target=(y-uProjection.x)/(uProjection.z-uProjection.x);
  float x=uView.x+uv.x*uView.z;
  float depth=uProjection.z-uProjection.x;
  vec2 plane=vec2((x-uProjection.w)/target,depth-depth/target);
  vec2 tile=floor(plane/uTileSize);
  vec2 local=fract(plane/uTileSize)*uTileSize;
  vec2 edge=min(local,uTileSize-local);
  float seam=min(edge.x*target,edge.y*target*target);
  float variation=fract(sin(dot(tile,vec2(127.1,311.7)))*43758.5453);
  vec3 base=mix(vec3(0.070,0.112,0.190),vec3(0.095,0.148,0.240),variation);
  // Sample inside each source tile for painted grain, never its inconsistent seams.
  vec2 grain=vec2(0.52,0.48)+(fract(local/uTileSize)-0.5)*0.045;
  base+= (texture2D(uMainSampler,grain).rgb-vec3(0.09,0.14,0.22))*0.12;
  base=mix(vec3(0.035,0.065,0.115),base,smoothstep(0.8,2.4,seam));
  base+=vec3(0.012,0.018,0.028)*(1.0-smoothstep(2.0,3.5,seam));
  gl_FragColor=vec4(base,1.0);}`});
  }
  onPreRender(): void {
    this.set4f('uView',VIEW.left,VIEW.top,VIEW.width,VIEW.height);
    this.set4f('uProjection',arenaVanishingY(),projection.sourceY,projection.anchorY,VIEW.cx);
    this.set2f('uTileSize',tune.view.arena.floorTileWidth*projection.zoom,tune.view.arena.floorTileDepth*projection.zoom);
  }
}
export function alignGymFloor(scene: Phaser.Scene,image: Phaser.GameObjects.Image | null): void {
  if (!image || !(scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  if (!scene.game.renderer.pipelines.getPostPipeline(KEY)) scene.game.renderer.pipelines.addPostPipeline(KEY,GymFloorPipeline);
  // Overscan the source so the inverse projection never samples transparent edges.
  image.setScale(image.scaleX*tune.view.arena.floorOverscan);
  projection.referenceScale=image.scaleX;
  updateGymProjection(image);
  image.setPostPipeline(KEY);
}
