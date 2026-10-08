import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
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
  const defeat=headline==='DEFEAT';
  const draw=headline==='DRAW';
  if (defeat) sfx.defeat(); else if (!draw) sfx.victory();
  const panel=scene.add.graphics().setDepth(129);
  panel.fillStyle(0x050d20,.42).fillRect(VIEW.left,VIEW.top,VIEW.width,VIEW.height);
  // Quiet backing for information; raised enamel is reserved for actions.
  panel.fillStyle(0x102139,.94).fillRoundedRect(VIEW.cx-198,VIEW.cy-90,396,217,18);
  const color=defeat?'#ff879e':draw?'#edf7ff':'#ffe08b';
  const heading=scene.add.text(VIEW.cx,VIEW.cy-46,headline,{fontFamily:'Impact, Arial Black, sans-serif',fontSize:headline.length>10?'32px':'42px',
    fontStyle:'bold italic',color,stroke:'#071024',strokeThickness:5,padding:{left:14,right:26,top:10,bottom:10},resolution:PIXEL_RATIO})
    .setOrigin(0.5).setDepth(150);
  if(score)scene.add.text(VIEW.cx,VIEW.cy+5,score.join('  —  '),{fontFamily:'Arial Black, Arial',fontSize:'22px',fontStyle:'bold',
    color:'#fff7e6',stroke:'#0b1731',strokeThickness:3,padding:{left:8,right:8,top:3,bottom:3},resolution:PIXEL_RATIO}).setOrigin(0.5).setDepth(150);
  const rematch=titleButton(scene,VIEW.cx,VIEW.cy+49,264,36,'REMATCH',actions.rematch,false,150,'green');
  titleButton(scene,VIEW.cx-94,VIEW.cy+99,172,30,'CHANGE BOXER',actions.changeBoxer,false,150);
  titleButton(scene,VIEW.cx+94,VIEW.cy+99,172,30,'MAIN MENU',actions.menu,false,150,'red');
  if(!reducedMotion()){
    const objects=scene.children.list.filter(o=>!before.has(o));
    objects.forEach(o=>(o as Phaser.GameObjects.Text).setAlpha(0));
    scene.tweens.add({targets:objects,alpha:1,duration:tune.view.fightPresentation.resultEnterMs,ease:'Sine.Out'});
    heading.setScale(1.12);
    scene.tweens.add({targets:heading,scale:1,duration:tune.view.fightPresentation.resultEnterMs,ease:'Cubic.Out'});
  }
  return rematch;
}
