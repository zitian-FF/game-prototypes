import Phaser from 'phaser';
import { tune } from '../sim/tune';
import { VIEW } from './pixelRatio';
import { arenaVanishingY, updateGymProjection } from './gymPerspective';

// Ring perspective: a presentation-only tilt. The sim arena stays a flat
// square; everything that belongs to the ring (floor, ropes, boxers, hit
// effects) is gathered into one container and drawn through a keystone
// shader, so the far edge is narrower and the picture is slightly squashed.
// HUD, buttons and touch controls are not in the container and stay flat.
// The shader works in logical world pixels, so it is independent of the
// render scale and of the camera fit.

const KEY = 'PunchiesKeystone';

// Shared by the pipeline (read every frame): what the camera shows, in
// logical world pixels, and the ring the taper is anchored to.
const state = { view: [0, 0, 844, 390], ring: [0, 0, 1, 1], warp: [1, 1], sourceTopRatio: 1 };

const FRAG = `
#define SHADER_NAME PUNCHIES_KEYSTONE_FS
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec4 uView;   // camera view: x, y, w, h (world px)
uniform vec4 uRing;   // ring: left, top, width, height (world px)
uniform float uSourceTopRatio;
uniform vec2 uWarp;   // far-edge scale, vertical squash
varying vec2 outTexCoord;
void main() {
  vec2 uv = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  vec2 p = uView.xy + uv * uView.zw;
  float cx = uRing.x + uRing.z * 0.5;
  float cy = uRing.y + uRing.w * 0.5;
  // Invert the tilt: where in the flat picture does this output pixel come from?
  float ys = cy + (p.y - cy) / uWarp.y;
  float t = (ys - uRing.y) / uRing.w;
  float s = max(mix(uWarp.x, 1.0, t) / mix(uSourceTopRatio, 1.0, t), 0.2);
  float xs = cx + (p.x - cx) / s;
  vec2 q = (vec2(xs, ys) - uView.xy) / uView.zw;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) {
    gl_FragColor = vec4(0.0);
  } else {
    gl_FragColor = texture2D(uMainSampler, vec2(q.x, 1.0 - q.y));
  }
}
`;

class KeystonePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, name: KEY, fragShader: FRAG });
  }
  onPreRender(): void {
    this.set4f('uView', state.view[0], state.view[1], state.view[2], state.view[3]);
    this.set4f('uRing', state.ring[0], state.ring[1], state.ring[2], state.ring[3]);
    this.set2f('uWarp', state.warp[0], state.warp[1]);
    this.set1f('uSourceTopRatio',state.sourceTopRatio);
  }
}

// The ring world: add the objects that should tilt, call update() each frame.
export class RingPerspective {
  readonly world: Phaser.GameObjects.Container | null;
  private applied = false;

  constructor(private scene: Phaser.Scene) {
    this.world = scene.add.container(0, 0).setDepth(5);
    // Runtime effects must follow the fitted world in both renderers.
    // DisplayList emits ADDED_TO_SCENE, not a generic List "add" event.
    // Listen before any runtime sparks/text spawn so they share the same
    // container scale, projection and camera shake as the ring and fighters.
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.adopt, this);
    scene.events.once('shutdown', () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.adopt, this));
    const renderer = scene.game.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
      return;
    }
    if (!renderer.pipelines.getPostPipeline(KEY)) renderer.pipelines.addPostPipeline(KEY, KeystonePipeline);
    // Effects spawn at run time (hit sparks, rings, popups); the ones at the
    // world depths join the container so they tilt with the ring.
  }

  private artworkBounds: {left:number;top:number;width:number;height:number;aspect:number} | null = null;
  fitArtwork(bounds: {left:number;top:number;width:number;height:number;aspect:number}): void {
    this.artworkBounds = bounds;
  }
  private roundZoomStart = 0;
  private backdrop: {image:Phaser.GameObjects.Image;x:number;y:number;scale:number} | null = null;
  setBackdrop(image: Phaser.GameObjects.Image | null): void {
    if (image) this.backdrop={image,x:image.x,y:image.y,scale:image.scaleX};
  }
  beginRound(time: number): void { this.roundZoomStart=time; }

  // Move already-built objects into the ring world.
  take(objects: Phaser.GameObjects.GameObject[]): void {
    this.world?.add(objects);
  }

  private adopt(obj: Phaser.GameObjects.GameObject): void {
    // setDepth is chained after creation, so decide on the next microtask.
    queueMicrotask(() => {
      if (!this.world || !obj.scene || obj.parentContainer) return;
      const d = (obj as Phaser.GameObjects.GameObject & { depth: number }).depth;
      if (d >= 60 && d < 76) this.world.add(obj);
    });
  }

  // Shared projection for gameplay and the title's registered ring layers.
  projectAuthored(farY:number,nearY:number): void {
    if(!this.world || !(this.scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
    state.view=[VIEW.left,VIEW.top,VIEW.width,VIEW.height];
    state.ring=[VIEW.cx-1,farY,2,nearY-farY];
    state.sourceTopRatio=tune.view.arena.ringSourceTopRatio;
    state.warp=[(farY-arenaVanishingY())/(nearY-arenaVanishingY()),1];
    if(!this.applied) { this.world.setPostPipeline(KEY); this.applied=true; }
  }
  update(): void {
    const world = this.world;
    if (!world) return;
    if (this.artworkBounds) {
      const b=this.artworkBounds;
      // Reserve the HUD strip, then fit the registered master below it.
      // Scale the ring, fighters and effects together so collision positions
      // remain aligned. The authored perspective needs no second keystone.
      const top=VIEW.top+tune.view.arena.uiBottom+VIEW.height*tune.view.arena.topGap;
      const bottom=VIEW.bottom-VIEW.height*tune.view.arena.bottomGap;
      // Top outer red rope and lowest opaque step pixel in the master.
      const ropeTop=b.top+b.height*110/1211;
      const stepsBottom=b.top+b.height*1131/1211;
      const finalScale=(bottom-top)/(stepsBottom-ropeTop);
      const finalY=top-ropeTop*finalScale;
      // The wider opening matches the reference framing from before the
      // rope-only enlargement. Ease the presentation during READY/GO.
      const startTop=VIEW.top+64;
      const startHeight=VIEW.bottom-startTop-8;
      const startScale=Math.min(startHeight/b.height,(VIEW.width-32)/(b.width*b.aspect));
      const startY=startTop+startHeight/2-(b.top+b.height/2)*startScale;
      const duration=tune.view.arena.roundZoomMs;
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const t=reduced||duration<=0 ? 1 : Phaser.Math.Clamp((this.scene.time.now-this.roundZoomStart)/duration,0,1);
      const ease=t*t*(3-2*t);
      const scale=Phaser.Math.Linear(startScale,finalScale,ease);
      world.setScale(scale*b.aspect,scale);
      world.setPosition(VIEW.cx-(b.left+b.width/2)*world.scaleX,
        Phaser.Math.Linear(startY,finalY,ease));
      if(this.backdrop) {
        const bg=this.backdrop;
        const ratio=scale/startScale;
        bg.image.setScale(bg.scale*ratio);
        bg.image.setPosition(VIEW.cx+(bg.x-VIEW.cx)*ratio,
          world.y+(bg.y-startY)*ratio);
      }
      const nearY=world.y+(b.top+b.height*875/1211)*scale;
      this.projectAuthored(world.y+ropeTop*scale,nearY);
      if(this.backdrop) updateGymProjection(this.backdrop.image);
      world.sort('depth');
      return;
    }
    const on = tune.view.perspective >= 0.5 && this.scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
    if (on !== this.applied) {
      if (on) world.setPostPipeline(KEY);
      else world.resetPostPipeline();
      this.applied = on;
    }
    world.sort('depth'); // container children draw in list order, not by depth
    if (!on) return;
    const r = tune.ring;
    const v = this.scene.cameras.main.worldView;
    state.view = [v.x, v.y, v.width, v.height];
    state.ring = [r.left, r.top, r.right - r.left, r.bottom - r.top];
    state.sourceTopRatio=1;
    state.warp = [tune.view.topScale, tune.view.squash];
  }
}
