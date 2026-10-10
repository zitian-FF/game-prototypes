import { portraitScaleFactor } from '../render/portraitScale';
import Phaser from 'phaser';
import { t } from '../i18n';
import { artImage } from '../render/art';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { tune } from '../sim/tune';
import { reducedMotion } from './presentation';
import { titleButton } from './titleButton';
import { getNav } from './menuNav';
import { skinTexture } from '../render/skins';
import { portraitBounds } from '../render/portraitBounds';
import { winnerName, winnerQuote, type ResultWinner } from './winnerQuotes';
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
}, score?: [number, number], winner?: ResultWinner, kind: 'victory' | 'defeat' | 'draw' = 'victory'): Phaser.GameObjects.Text {
  getNav(scene).engage();
  const before=new Set(scene.children.list);
  const defeat=kind==='defeat';
  const draw=kind==='draw';
  const panel=scene.add.graphics().setDepth(129);
  panel.fillStyle(0x050d20,.72).fillRect(VIEW.left,VIEW.top,VIEW.width,VIEW.height);
  const shield=scene.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x000000,0).setDepth(130).setInteractive();
  // Portrait and result UI float over the darkened gameplay, without a panel.
  const portraitKey=winner?skinTexture(scene,winner.char,winner.skin??'default',`portrait_${winner.char}`):null;
  const hasWinner=!!winner&&!draw;
  const width=hasWinner?Math.min(360,VIEW.width*.45):396;
  const textX=hasWinner?VIEW.left+VIEW.width*.70:VIEW.cx;
  let portrait:Phaser.GameObjects.Image|null=null;
  if(hasWinner&&portraitKey&&scene.textures.exists(portraitKey)){
    portrait=scene.add.image(VIEW.left+VIEW.width*.25,VIEW.bottom,portraitKey).setDepth(140);
    const bounds=portraitBounds(scene,portraitKey);
    const scale=Math.min(VIEW.width*.46/(bounds.right-bounds.left),VIEW.height*.92/(bounds.bottom-bounds.top))*portraitScaleFactor(winner!.char);
    portrait.setFlipX(winner!.char==='tyke').setOrigin(winner!.char==='tyke'?1-(bounds.left+bounds.right)/2/portrait.width:(bounds.left+bounds.right)/2/portrait.width,bounds.bottom/portrait.height).setScale(scale);
  }
  const color=defeat?'#ff879e':draw?'#edf7ff':'#ffe08b';
  const heading=scene.add.text(textX,hasWinner?VIEW.top+VIEW.height*.16:VIEW.cy-46,headline,{fontFamily:'Impact, Arial Black, sans-serif',fontSize:headline.length>10?'42px':'56px',
    fontStyle:'bold italic',color,stroke:'#071024',strokeThickness:5,padding:{left:14,right:26,top:10,bottom:10},resolution:PIXEL_RATIO})
    .setOrigin(0.5).setDepth(150);
  if(score)scene.add.text(textX,hasWinner?VIEW.top+VIEW.height*.28:VIEW.cy+5,score.join('  —  '),{fontFamily:'Arial Black, Arial',fontSize:'28px',fontStyle:'bold',
    color:'#fff7e6',stroke:'#0b1731',strokeThickness:3,padding:{left:8,right:8,top:3,bottom:3},resolution:PIXEL_RATIO}).setOrigin(0.5).setDepth(150);
  if(hasWinner){
    scene.add.text(textX,VIEW.top+VIEW.height*.37,winnerName(winner!.char),{fontFamily:'Arial Black, Arial',fontSize:'20px',color:'#91dfff',resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(150);
    scene.add.text(textX,VIEW.top+VIEW.height*.48,`“${winnerQuote(winner!.char)}”`,{fontFamily:'Arial',fontSize:'20px',fontStyle:'italic',color:'#fff1d5',align:'center',wordWrap:{width:width-24},padding:{left:4,right:8,top:3,bottom:3},resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(150);
  }
  const rematch=titleButton(scene,textX,VIEW.bottom-126,280,38,t('match.rematch'),actions.rematch,false,150,'green');
  const change=titleButton(scene,textX,VIEW.bottom-78,280,38,t('match.change_boxer'),actions.changeBoxer,false,150);
  const menu=titleButton(scene,textX,VIEW.bottom-30,280,38,t('match.main_menu'),actions.menu,false,150,'red','back');
  if(!reducedMotion()){
    let alive=true;scene.events.once('shutdown',()=>{alive=false;});
    const details=scene.children.list.filter(o=>!before.has(o)&&o!==panel&&o!==shield&&o!==portrait&&o!==heading) as Phaser.GameObjects.Image[];
    const hits=[rematch,change,menu].map(t=>t.getData('bg') as Phaser.GameObjects.Rectangle);
    details.forEach(o=>o.setAlpha(0).setVisible(false));hits.forEach(hit=>hit.disableInteractive());
    const reveal=()=>{
      if(!alive)return;
      details.forEach(o=>o.setVisible(true));
      scene.tweens.add({targets:details,alpha:1,duration:tune.view.fightPresentation.resultEnterMs,ease:'Sine.Out',onComplete:()=>{
        if(alive)hits.forEach(hit=>hit.setInteractive({useHandCursor:true}));
      }});
    };
    if(portrait){const x=portrait.x;portrait.setX(x-VIEW.width*.65);scene.tweens.add({targets:portrait,x,duration:tune.view.fightPresentation.portraitSlideMs,ease:'Cubic.Out'});}
    heading.setX(textX+VIEW.width*.65);
    scene.tweens.add({targets:heading,x:textX,duration:tune.view.fightPresentation.portraitSlideMs,ease:'Cubic.Out',onComplete:reveal});
  }
  return rematch;
}
