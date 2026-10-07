import Phaser from 'phaser';
import { artImage } from '../render/art';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { tune } from '../sim/tune';
import { reducedMotion } from './presentation';
import { makeButton } from '../scenes/FightStage';
import { getNav } from './menuNav';
let splashSerial = 0;

// Freeze the round scene while a short logo splash dissolves over the arena.
// Restart/reset at full coverage; the new arena fades in beneath the captured splash.
export function roundSplash(scene: Phaser.Scene, next: () => void): () => void {
  let cancelled = false;
  const cover = scene.add.container().setDepth(1000);
  const bg = scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x101b32).setInteractive();
  cover.add(bg);
  const stamps: { image: Phaser.GameObjects.Image; x: number }[] = [];
  for (let row = 0; row < Math.ceil(VIEW.height / 90) + 2; row++) {
    for (let col = 0; col < Math.ceil(VIEW.width / 190) + 2; col++) {
      const x = VIEW.left - 190 + col * 190 + row % 2 * 95;
      const image = artImage(scene, 'logo', x, VIEW.top - 45 + row * 90, 145, 42, 1000);
      if (image) { image.setAngle(-12).setAlpha(0.09); cover.add(image); stamps.push({ image, x }); }
    }
  }
  const logo = artImage(scene, 'logo', VIEW.cx, VIEW.cy, 300, 85, 1001);
  if (logo) cover.add(logo);
  let offset = 0;
  const drift = (_time: number, delta: number) => {
    if (reducedMotion()) return;
    offset = (offset + delta * tune.view.menu.loadingDrift / 1000) % 190;
    stamps.forEach((s) => s.image.x = s.x - offset);
  };
  scene.events.on('update', drift);
  scene.events.once('shutdown', () => scene.events.off('update', drift));
  cover.setAlpha(reducedMotion() ? 1 : 0);
  scene.tweens.add({ targets: cover, alpha: 1, duration: reducedMotion() ? 0 : tune.view.menu.crossfadeMs, ease: 'Sine.InOut' });
  const timer = scene.time.delayedCall(tune.view.roundSplashMs, () => {
    if (cancelled) return;
    if (reducedMotion()) { next(); return; }
    const texture = `round-splash-${++splashSerial}`;
    scene.game.renderer.snapshot((image) => {
      if (cancelled || !scene.scene.isActive()) return;
      if (!(image instanceof HTMLImageElement)) { next(); return; }
      scene.textures.addImage(texture, image);
      next();
      scene.scene.launch('ScreenTransition', { texture, duration: tune.view.menu.crossfadeMs });
    });
  });
  return () => {
    cancelled = true;
    timer.remove(false);
    scene.events.off('update', drift);
    cover.destroy(true);
  };
}

export function matchResult(scene: Phaser.Scene, headline: string, actions: {
  rematch: () => void; changeBoxer: () => void; menu: () => void;
}): Phaser.GameObjects.Text {
  getNav(scene).engage();
  scene.add.rectangle(VIEW.cx, VIEW.cy + 22, 380, 182, 0x0b1731, 0.78).setDepth(129);
  scene.add.text(VIEW.cx, VIEW.cy - 33, headline, { fontFamily: 'Arial, sans-serif', fontSize: '36px',
    fontStyle: 'bold', color: '#fff1d1', stroke: '#071024', strokeThickness: 5, resolution: PIXEL_RATIO })
    .setOrigin(0.5).setDepth(150);
  const rematch = makeButton(scene, VIEW.cx, VIEW.cy + 27, 220, 'REMATCH', actions.rematch, 34, 14);
  makeButton(scene, VIEW.cx - 94, VIEW.cy + 75, 172, 'CHANGE BOXER', actions.changeBoxer, 30, 12);
  makeButton(scene, VIEW.cx + 94, VIEW.cy + 75, 172, 'MAIN MENU', actions.menu, 30, 12);
  return rematch;
}
