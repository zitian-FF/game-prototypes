import Phaser from 'phaser';
import { artKey } from '../render/art';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { charName } from '../sim/character';
import { tune } from '../sim/tune';
import { reducedMotion } from './presentation';

export class MatchIntro {
  private cover: Phaser.GameObjects.Container;
  private portraits: Phaser.GameObjects.Container[] = [];
  private flames: Phaser.GameObjects.Graphics;
  private vs: Phaser.GameObjects.Text;
  private complete = false;

  constructor(private scene: Phaser.Scene, chars: [string, string]) {
    this.cover = scene.add.container().setDepth(320);
    this.cover.add(scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x081326, 0.97).setInteractive());
    const panels = scene.add.graphics();
    panels.fillStyle(0x123d72).fillPoints([
      {x:VIEW.left,y:VIEW.top},{x:VIEW.cx+40,y:VIEW.top},
      {x:VIEW.cx-40,y:VIEW.bottom},{x:VIEW.left,y:VIEW.bottom}],true);
    panels.fillStyle(0x6b2338).fillPoints([
      {x:VIEW.cx+40,y:VIEW.top},{x:VIEW.right,y:VIEW.top},
      {x:VIEW.right,y:VIEW.bottom},{x:VIEW.cx-40,y:VIEW.bottom}],true);
    panels.lineStyle(2,0xffdc85,0.5).lineBetween(VIEW.cx+40,VIEW.top,VIEW.cx-40,VIEW.bottom);
    this.cover.add(panels);
    chars.forEach((id,side)=>{
      const group=scene.add.container();
      const x=VIEW.cx+(side===0?-1:1)*VIEW.width*0.245;
      const key=artKey(scene,`portrait_${id}`);
      if(key){
        const portrait=scene.add.image(x,VIEW.bottom-58,key).setOrigin(0.5,1).setFlipX(side===1);
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
        const height=VIEW.height*({bruno:0.76,marco:0.70,mia:0.64}[id]??0.7);
        const k=Math.min(height/(bottom-top),VIEW.width*0.34/(right-left));
        portrait.setScale(k);
        portrait.x-=(side===1?-1:1)*((left+right)/2-canvas.width/2)*k;
        portrait.y+=(canvas.height-bottom)*k;
        group.add(portrait);
      }
      const name=scene.add.text(x,VIEW.bottom-29,charName(id).toUpperCase(),{
        fontFamily:'Arial',fontSize:'22px',fontStyle:'bold',color:'#fff1d1',
        stroke:'#071326',strokeThickness:4,resolution:PIXEL_RATIO}).setOrigin(0.5);
      if(name.width>VIEW.width*0.40)name.setScale(VIEW.width*0.40/name.width);
      group.add(name);
      this.cover.add(group);this.portraits.push(group);
    });
    this.flames=scene.add.graphics();this.cover.add(this.flames);
    this.vs=scene.add.text(VIEW.cx,VIEW.cy,'VS',{
      fontFamily:'Impact, Arial Black, sans-serif',fontSize:'88px',fontStyle:'bold italic',color:'#fff0ab',
      stroke:'#581721',strokeThickness:9,resolution:PIXEL_RATIO}).setOrigin(0.5).setAngle(-8);
    this.cover.add(this.vs);
  }

  draw(elapsedMs: number): void {
    if(this.complete)return;
    const cfg=tune.view.fightPresentation;
    if(elapsedMs>=cfg.showcaseMs){this.complete=true;this.cover.destroy(true);return;}
    const motion=!reducedMotion();
    const slide=motion?Phaser.Math.Easing.Cubic.Out(Math.min(1,elapsedMs/cfg.portraitSlideMs)):1;
    this.portraits.forEach((p,i)=>p.x=(i===0?-1:1)*VIEW.width*0.55*(1-slide));
    const impact=Math.min(1,Math.max(0,(elapsedMs-cfg.portraitSlideMs)/cfg.impactMs));
    this.vs.setAlpha(impact>0?1:0).setScale(motion?1+0.35*(1-impact):1);
    const fade=Math.min(1,(cfg.showcaseMs-elapsedMs)/cfg.fadeMs);
    this.cover.setAlpha(fade);
    this.flames.clear();
    if(impact<=0)return;
    for(let i=0;i<7;i++){
      const x=VIEW.cx-54+i*18;
      const wave=motion?Math.sin(elapsedMs/85+i*2.4):0;
      const h=60+(i%3)*20+wave*9;
      const y=VIEW.cy+44;
      const points=[[-14,0],[-17,-h*0.30],[-8,-h*0.60],[4+wave*4,-h],
        [3,-h*0.54],[15,-h*0.29],[14,0]].map(([dx,dy])=>new Phaser.Math.Vector2(x+dx,y+dy));
      this.flames.fillStyle(i%2?0xff6a21:0xffb22e,0.88)
        .fillPoints(new Phaser.Curves.Spline(points).getPoints(32),true);
      this.flames.fillStyle(0xffe77d,0.9).fillEllipse(x,y-18,12,39);
    }
  }
}

export function knockoutWords(scene: Phaser.Scene): () => void {
  const cfg=tune.view.fightPresentation;
  const cover=scene.add.container().setDepth(150);
  const paint=scene.add.graphics();cover.add(paint);
  const words=['KNOCK','OUT'].map((word,i)=>{
    const y=VIEW.cy-38+i*72;
    paint.fillStyle(0x10182d,0.9).fillPoints([
      {x:VIEW.cx-169,y:y-27},{x:VIEW.cx+154,y:y-34},
      {x:VIEW.cx+174,y:y+25},{x:VIEW.cx-158,y:y+31}],true);
    paint.fillStyle(0xc42d43,0.85).fillPoints([
      {x:VIEW.cx-174,y:y+22},{x:VIEW.cx+155,y:y+13},{x:VIEW.cx+177,y:y+16},
      {x:VIEW.cx+162,y:y+20},{x:VIEW.cx+181,y:y+23},{x:VIEW.cx+153,y:y+25},
      {x:VIEW.cx+169,y:y+28},{x:VIEW.cx-164,y:y+34}],true);
    const text=scene.add.text(VIEW.cx,y,word,{fontFamily:'Impact, Arial Black, sans-serif',
      fontSize:i===0?'66px':'78px',fontStyle:'bold italic',color:i===0?'#fff1d1':'#ffcf53',
      stroke:'#091326',strokeThickness:6,resolution:PIXEL_RATIO}).setOrigin(0.5).setAngle(-5).setAlpha(0);
    cover.add(text);return text;
  });
  paint.setAlpha(0);
  const strokeTargets: object[]=[];
  const timers=words.map((text,i)=>scene.time.delayedCall(i*cfg.koWordGapMs,()=>{
    paint.setAlpha(1);text.setAlpha(1).setScale(reducedMotion()?1:1.6);
    scene.tweens.add({targets:text,scale:1,duration:reducedMotion()?0:cfg.impactMs,ease:'Cubic.Out'});
    if(!reducedMotion()){
      const stroke={width:0};strokeTargets.push(stroke);text.setCrop(0,0,0,text.height);
      scene.tweens.add({targets:stroke,width:text.width,duration:cfg.impactMs,
        onUpdate:()=>text.setCrop(0,0,stroke.width,text.height),onComplete:()=>text.setCrop()});
    }
  }));
  scene.tweens.add({targets:cover,alpha:0,delay:cfg.koHoldMs,duration:cfg.fadeMs});
  return ()=>{
    timers.forEach(timer=>timer.remove(false));
    scene.tweens.killTweensOf([cover,...words,...strokeTargets]);
    cover.destroy(true);
  };
}
