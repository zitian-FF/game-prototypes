import Phaser from 'phaser';
import { tune } from '../sim/tune';

const KEY='PunchiesGymFloor';
// Undo the gym illustration's converging floor columns. The full authored
// ring has parallel sides, so the surrounding tiles must share that plane.
class GymFloorPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({game,name:KEY,fragShader:`
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uFloorScale;
varying vec2 outTexCoord;
void main() {
  float row=1.0-outTexCoord.y;
  float scale=mix(uFloorScale.x,uFloorScale.y,row);
  vec2 uv=vec2(0.5+(outTexCoord.x-0.5)*scale,outTexCoord.y);
  gl_FragColor=texture2D(uMainSampler,uv);
}`});
  }
  onPreRender(): void {
    this.set2f('uFloorScale',tune.view.arena.floorTopScale,tune.view.arena.floorBottomScale);
  }
}
export function alignGymFloor(scene: Phaser.Scene,image: Phaser.GameObjects.Image | null): void {
  const renderer=scene.game.renderer;
  if (!image || !(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  if (!renderer.pipelines.getPostPipeline(KEY)) renderer.pipelines.addPostPipeline(KEY,GymFloorPipeline);
  // Leave enough source outside the viewport for the inverse projection.
  image.setScale(image.scaleX*Math.max(tune.view.arena.floorTopScale,tune.view.arena.floorBottomScale));
  image.setPostPipeline(KEY);
}
