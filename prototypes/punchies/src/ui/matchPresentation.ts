import Phaser from 'phaser';
import { artImage } from '../render/art';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { tune } from '../sim/tune';
import { reducedMotion } from './presentation';
import { titleButton } from './titleButton';
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
}, score?: [number, number]): Phaser.GameObjects.Text {
  getNav(scene).engage();
  const before=new Set(scene.children.list);
  const panel=scene.add.graphics().setDepth(129);
  panel.fillStyle(0x071326,0.88).fillRoundedRect(VIEW.cx-195,VIEW.cy-81,390,203,19);
  panel.lineStyle(2,0x6886ae,0.85).strokeRoundedRect(VIEW.cx-195,VIEW.cy-81,390,203,19);
  panel.lineStyle(1,0xdceafa,0.24).lineBetween(VIEW.cx-171,VIEW.cy-74,VIEW.cx+171,VIEW.cy-74);
  const color=headline==='DEFEAT'?'#ff827a':headline==='DRAW'?'#dbe9fa':'#ffe08b';
  const heading=scene.add.text(VIEW.cx,VIEW.cy-43,headline,{fontFamily:'Impact, Arial Black, sans-serif',fontSize:'40px',
    fontStyle:'bold italic',color,stroke:'#071024',strokeThickness:5,resolution:PIXEL_RATIO})
    .setOrigin(0.5).setDepth(150);
  if(score)scene.add.text(VIEW.cx,VIEW.cy-2,score.join('  —  '),{fontFamily:'Arial',fontSize:'18px',fontStyle:'bold',
    color:'#dbe9fa',resolution:PIXEL_RATIO}).setOrigin(0.5).setDepth(150);
  const rematch=titleButton(scene,VIEW.cx,VIEW.cy+39,232,34,'REMATCH',actions.rematch,false,150,'green');
  titleButton(scene,VIEW.cx-94,VIEW.cy+88,172,30,'CHANGE BOXER',actions.changeBoxer,false,150);
  titleButton(scene,VIEW.cx+94,VIEW.cy+88,172,30,'MAIN MENU',actions.menu,false,150);
  if(!reducedMotion()){
    const objects=scene.children.list.filter(o=>!before.has(o));
    objects.forEach(o=>(o as Phaser.GameObjects.Text).setAlpha(0));
    scene.tweens.add({targets:objects,alpha:1,duration:tune.view.fightPresentation.resultEnterMs,ease:'Sine.Out'});
    heading.setScale(1.12);
    scene.tweens.add({targets:heading,scale:1,duration:tune.view.fightPresentation.resultEnterMs,ease:'Cubic.Out'});
  }
  return rematch;
}
