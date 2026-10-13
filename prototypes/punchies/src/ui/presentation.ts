import Phaser from 'phaser';
import { tune } from '../sim/tune';
import { applyCameraPixelRatio, VIEW } from '../render/pixelRatio';

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function pulseLogo(scene: Phaser.Scene, logo: Phaser.GameObjects.Image): void {
  if (reducedMotion()) return;
  scene.tweens.add({ targets: logo, scaleX: logo.scaleX * tune.view.menu.logoPulseScale,
    scaleY: logo.scaleY * tune.view.menu.logoPulseScale, duration: tune.view.menu.logoPulseMs,
    ease: 'Sine.InOut', yoyo: true, repeat: -1 });
}

let serial = 0;
const pending = new WeakSet<Phaser.Scene>();

// Capture the outgoing canvas, then dissolve that still over the live new
// screen. The outgoing scene shuts down normally: no duplicate input, sim,
// or networking loops run during the visual transition.
export function startScreen(scene: Phaser.Scene, key: string, data?: object): void {
  if (pending.has(scene)) return;
  const duration = reducedMotion() ? 0 : tune.view.menu.crossfadeMs;
  if (duration <= 0) { scene.scene.start(key, data); return; }
  pending.add(scene);
  const renderer = scene.game.renderer;
  const texture = `screen-crossfade-${++serial}`;
  renderer.snapshot((image) => {
    pending.delete(scene);
    if (!scene.scene.isActive()) return;
    if (!(image instanceof HTMLImageElement)) { scene.scene.start(key, data); return; }
    scene.textures.addImage(texture, image);
    scene.scene.start(key, data);
    if (scene.scene.isActive('ScreenTransition')) scene.scene.get('ScreenTransition').scene.restart({texture,duration});
    else scene.scene.launch('ScreenTransition', { texture, duration });
  });
}

export class ScreenTransition extends Phaser.Scene {
  constructor() { super('ScreenTransition'); }
  create(data: { texture: string; duration: number }): void {
    applyCameraPixelRatio(this);
    this.scene.bringToTop();
    const cover = this.add.image(VIEW.cx, VIEW.cy, data.texture).setDisplaySize(VIEW.width, VIEW.height);
    // Absorb clicks on the fading outgoing controls.
    cover.setInteractive();
    this.tweens.add({ targets: cover, alpha: 0, duration: data.duration, ease: 'Sine.Out',
      onComplete: () => this.scene.stop() });
    this.events.once('shutdown', () => this.textures.remove(data.texture));
  }
}
