import { fightCueTiming } from '../sim/fightCue';
import type { WireProfile } from '../progress/alias';
import { titleName } from '../progress/titles';
import { portraitScaleFactor } from '../render/portraitScale';
import Phaser from 'phaser';
import { getLanguage, t } from '../i18n';
import { skinTexture } from '../render/skins';
import { artKey, artImage } from '../render/art';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { charName } from '../sim/character';
import { tune } from '../sim/tune';
import { reducedMotion } from './presentation';
import { clashFireImage,animateClashFire, type ClashFlames } from './clashFire';

export class MatchIntro {
  private cover: Phaser.GameObjects.Container;
  private portraits: Phaser.GameObjects.Container[] = [];
  private flames: ClashFlames;
  private vs: Phaser.GameObjects.Text;
  private complete = false;

  constructor(private scene: Phaser.Scene, chars: [string, string],skins:[string,string]=['default','default'],profiles:[WireProfile|null,WireProfile|null]=[null,null]) {
    this.cover = scene.add.container().setDepth(320);
    this.cover.add(scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x081326, 0.97).setInteractive());
    const gym=artImage(scene,'gym_background',VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0);
    if(gym)this.cover.add(gym.setTint(0x5c6373));
    this.cover.add(scene.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x03070d,0.62));
    chars.forEach((id,side)=>{
      const group=scene.add.container();
      const x=VIEW.cx+(side===0?-1:1)*VIEW.width*0.245;
      const key=skinTexture(scene,id,skins[side],`portrait_${id}`);
      if(scene.textures.exists(key)){
        const portrait=scene.add.image(x,VIEW.bottom+2,key).setOrigin(0.5,1).setFlipX((side===1)!==(id==='tyke'));
        // Loose portraits have different transparent margins: align visible pixels.
        const canvas=document.createElement('canvas');
        canvas.width=portrait.width; canvas.height=portrait.height;
        const context=canvas.getContext('2d',{willReadFrequently:true})!;
        context.drawImage(scene.textures.get(key).getSourceImage() as HTMLImageElement,0,0);
        const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
        let left=canvas.width,top=canvas.height,right=0,bottom=0;
        for(let y=0;y<canvas.height;y++) for(let px=0;px<canvas.width;px++){
          if(pixels[(y*canvas.width+px)*4+3]<16)continue;
          left=Math.min(left,px);top=Math.min(top,y);right=Math.max(right,px+1);bottom=Math.max(bottom,y+1);
        }
        if(right<=left||bottom<=top){left=0;top=0;right=canvas.width;bottom=canvas.height;}
        const height=VIEW.height*.88;
        const k=Math.min(height/(bottom-top),VIEW.width*0.43/(right-left))*portraitScaleFactor(id);
        portrait.setScale(k);
        portrait.x-=((side===1)!==(id==='tyke')?-1:1)*((left+right)/2-canvas.width/2)*k;
        portrait.y+=(canvas.height-bottom)*k;
        group.add(portrait);
      }
      const name=scene.add.text(x,VIEW.top+38,charName(id).toUpperCase(),{
        fontFamily:'Arial',fontSize:'22px',fontStyle:'bold',color:'#fff1d1',
        stroke:'#071326',strokeThickness:4,resolution:PIXEL_RATIO}).setOrigin(0.5);
      if(name.width>VIEW.width*0.40)name.setScale(VIEW.width*0.40/name.width);
      group.add(name);
      const profile=profiles[side];
      if(profile){
        for(const [y,label,color] of [[64,`${profile.alias} · ${t('profile.level',{level:profile.level})}`,'#fff1d1'],[86,titleName(profile.title),'#caa2ff']] as const){
          const status=scene.add.text(x,VIEW.top+y,label,{fontFamily:'Arial',fontSize:'14px',fontStyle:'bold',color,stroke:'#071326',strokeThickness:3,resolution:PIXEL_RATIO}).setOrigin(.5);
          status.setScale(Math.min(1,VIEW.width*.32/Math.max(1,status.width)));
          group.add(status);
        }
      }
      this.cover.add(group);this.portraits.push(group);
    });
    this.flames=clashFireImage(scene);this.cover.add(this.flames.root);
    this.vs=scene.add.text(VIEW.cx,VIEW.cy,'VS',{
      fontFamily:'Impact, Arial Black, sans-serif',fontSize:'88px',fontStyle:'bold italic',color:'#fff0ab',
      stroke:'#581721',strokeThickness:9,padding:{left:14,right:30,top:12,bottom:12},resolution:PIXEL_RATIO}).setOrigin(0.5).setAngle(-8);
    this.cover.add(this.vs);
  }

  draw(elapsedMs: number): void {
    if(this.complete)return;
    const cfg=tune.view.fightPresentation;
    if(elapsedMs>=cfg.showcaseMs){this.complete=true;this.cover.destroy(true);return;}
    const motion=!reducedMotion();
    const slide=motion?Phaser.Math.Easing.Cubic.Out(Math.min(1,elapsedMs/cfg.portraitSlideMs)):1;
    const charge=Math.max(0,Math.min(1,(elapsedMs-cfg.portraitSlideMs)/(cfg.showcaseMs-cfg.portraitSlideMs-cfg.vsExitMs)));
    this.portraits.forEach((p,i)=>{
      const sign=i===0?-1:1;
      const jitter=motion&&slide>=1?Math.sin(elapsedMs/cfg.vibrateMs+i*2)*cfg.vibratePixels*charge:0;
      p.x=sign*VIEW.width*0.55*(1-slide)+jitter;
      p.y=motion?Math.cos(elapsedMs/cfg.vibrateMs+i*3)*cfg.vibratePixels*0.3*charge:0;
      p.setScale(1+charge*0.035);
      p.y-=VIEW.bottom*charge*0.035;
    });
    const impact=Math.min(1,Math.max(0,(elapsedMs-cfg.portraitSlideMs)/cfg.impactMs));
    const exit=Math.max(0,Math.min(1,(elapsedMs-(cfg.showcaseMs-cfg.vsExitMs))/cfg.vsExitMs));
    const scale=1+0.35*(1-impact)+(motion?Math.pow(exit,3)*cfg.vsExitScale:0);
    this.vs.setAlpha(impact>0?1:0).setScale(scale);
    this.portraits.forEach(p=>p.setAlpha(1-exit));
    // Oversized VS covers the frame, then cuts away into the arena.
    this.cover.setAlpha(1);
    animateClashFire(this.flames,VIEW.cx,VIEW.cy+10,elapsedMs,cfg.portraitSlideMs,exit,motion,VIEW.width*.32);
  }
}

export function knockoutWords(scene: Phaser.Scene): () => void {
  const labels = getLanguage() === 'en' || getLanguage() === 'pseudo'
    ? [t('fight.knock'), t('fight.out')]
    : [t('fight.knockout')];
  return impactWords(scene, labels, tune.view.fightPresentation.koHoldMs);
}

export function fightWord(scene: Phaser.Scene) {
  const timing=fightCueTiming();
  return impactWords(scene,[t('common.fight')],timing.entranceMs,timing.fadeMs,true);
}

function impactWords(scene: Phaser.Scene, labels: string[], holdMs: number, fadeMs = tune.view.fightPresentation.fadeMs, manual=false): (() => void) & {draw:(age:number)=>void} {
  const cfg=tune.view.fightPresentation;
  const cover=scene.add.container().setDepth(150);
  const paint=scene.add.graphics();cover.add(paint);
  const words=labels.map((word,i)=>{
    const y=labels.length===1?VIEW.cy-16:VIEW.cy-38+i*72;
    paint.fillStyle(0x10182d,0.9).fillPoints([
      {x:VIEW.cx-169,y:y-27},{x:VIEW.cx+154,y:y-34},
      {x:VIEW.cx+174,y:y+25},{x:VIEW.cx-158,y:y+31}],true);
    paint.fillStyle(0xc42d43,0.85).fillPoints([
      {x:VIEW.cx-174,y:y+22},{x:VIEW.cx+155,y:y+13},{x:VIEW.cx+177,y:y+16},
      {x:VIEW.cx+162,y:y+20},{x:VIEW.cx+181,y:y+23},{x:VIEW.cx+153,y:y+25},
      {x:VIEW.cx+169,y:y+28},{x:VIEW.cx-164,y:y+34}],true);
    const text=scene.add.text(VIEW.cx,y,word,{fontFamily:'Impact, Arial Black, sans-serif',
      fontSize:i===0?'66px':'78px',fontStyle:'bold italic',color:i===0?'#fff1d1':'#ffcf53',
      stroke:'#091326',strokeThickness:6,padding:{left:14,right:30,top:12,bottom:12},resolution:PIXEL_RATIO}).setOrigin(0.5).setAngle(-5).setAlpha(0);
    cover.add(text);return text;
  });
  paint.setAlpha(0);
  const strokeTargets: object[]=[];
  const timers=manual?[]:words.map((text,i)=>scene.time.delayedCall(i*cfg.koWordGapMs,()=>{
    paint.setAlpha(1);text.setAlpha(1).setScale(reducedMotion()?1:1.6);
    scene.tweens.add({targets:text,scale:1,duration:reducedMotion()?0:cfg.impactMs,ease:'Cubic.Out'});
    if(!reducedMotion()){
      const stroke={width:0};strokeTargets.push(stroke);text.setCrop(0,0,0,text.height);
      scene.tweens.add({targets:stroke,width:text.width,duration:cfg.impactMs,
        onUpdate:()=>text.setCrop(0,0,stroke.width,text.height),onComplete:()=>text.setCrop()});
    }
  }));
  if(!manual)scene.tweens.add({targets:cover,alpha:0,delay:holdMs,duration:fadeMs});
  let cleaned=false;
  const cleanup=()=>{
    if(cleaned)return;
    cleaned=true;
    expiry?.remove(false);
    timers.forEach(timer=>timer.remove(false));
    scene.tweens.killTweensOf([cover,...words,...strokeTargets]);
    cover.destroy(true);
  };
  const expiry=manual?null:scene.time.delayedCall(holdMs+fadeMs,cleanup);
  const draw=(age:number)=>{
    if(cleaned)return;
    if(age>=holdMs+fadeMs){cleanup();return;}
    const progress=Math.max(0,Math.min(1,age/Math.max(1,cfg.impactMs)));
    paint.setAlpha(1);cover.setAlpha(age<holdMs?1:Math.max(0,1-(age-holdMs)/Math.max(1,fadeMs)));
    for(const word of words){
      word.setAlpha(1).setScale(reducedMotion()?1:1+.6*Math.pow(1-progress,3));
      if(reducedMotion()||progress>=1)word.setCrop();else word.setCrop(0,0,word.width*progress,word.height);
    }
  };
  return Object.assign(cleanup,{draw});
}
