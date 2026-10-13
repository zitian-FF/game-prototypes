import type Phaser from 'phaser';
import type {Fighter} from '../sim/types';
import {eaglePosition} from '../sim/eaglePunch';
import {punchFist} from '../sim/fistPath';
import {fighterScale} from '../sim/geometry';
import {reducedMotion} from '../ui/presentation';
import {eagleFireTexture,EAGLE_ART} from './eagleFireTexture';
export interface EaglePresentation {id:number;frame:number;startup:number;dashFrames:number;phase:'startup'|'dash'|'recovery';x:number;y:number;gloveX:number;gloveY:number;fx:number;fy:number;startX:number;startY:number}
export function eaglePresentation(f:Fighter):EaglePresentation|null {
 if(f.health<=0||!f.eagle||!f.punch?.eagleSuper)return null;const e=f.eagle,body=eaglePosition(e),glove=punchFist(f,f.punch,fighterScale(f)),phase=body.phase;
 if(phase!=='startup'&&phase!=='dash'&&phase!=='recovery')return null;
 return {id:e.activationId,frame:e.frame,startup:e.startup,dashFrames:e.dashFrames,...body,phase,gloveX:glove.x,gloveY:glove.y,fx:f.fx,fy:f.fy,startX:e.startX,startY:e.startY};
}
interface Actor {charge:Phaser.GameObjects.Image;fire:Phaser.GameObjects.Image;trail:Phaser.GameObjects.Image}
interface Impact {image:Phaser.GameObjects.Image;tick:number;x:number;y:number;strength:number}
export class EagleFireVfx {
 private actors:Actor[]=[];private impacts:Impact[]=[];private cursor=0;private lastTick=-1;private disposed=false;private active=0;
 constructor(private scene:Phaser.Scene){const key=eagleFireTexture(scene),image=(frame:string,depth:number)=>scene.add.image(0,0,key,frame).setDepth(depth).setVisible(false);
  for(let i=0;i<2;i++)this.actors.push({charge:image('charge',64).setOrigin(EAGLE_ART.gloveX/EAGLE_ART.width,.5),fire:image('fire-0',65).setOrigin(EAGLE_ART.gloveX/EAGLE_ART.width,.5),trail:image('trail',63).setOrigin(1,.5)});
  for(let i=0;i<4;i++)this.impacts.push({image:image('impact',67),tick:-1000,x:0,y:0,strength:0});scene.events.once('shutdown',this.destroy,this);
 }
 contact(tick:number,x:number,y:number,strength:number){if(this.disposed)return;this.syncTick(tick);Object.assign(this.impacts[this.cursor++%4],{tick,x,y,strength});}
 draw(sources:readonly EaglePresentation[],tick:number,finished=false){if(this.disposed)return;this.syncTick(tick);const motion=!reducedMotion(),live=finished?[]:sources.slice(0,2);this.active=live.length;
  this.actors.forEach((a,i)=>{const p=live[i];if(!p){[a.charge,a.fire,a.trail].forEach(o=>o.setVisible(false));return;}
   const startup=p.phase==='startup',progress=Math.max(0,Math.min(1,p.frame/Math.max(1,p.startup))),tail=Math.max(0,1-Math.max(0,p.frame-p.startup-p.dashFrames)/4),angle=Math.atan2(p.fy,p.fx);
   a.charge.setPosition(p.gloveX,p.gloveY).setRotation(angle).setScale(motion?.32+.3*progress:.48).setAlpha(.3+.65*progress).setVisible(startup);
   a.fire.setFrame('fire-'+(motion?Math.floor(p.frame/3)%4:0)).setPosition(p.gloveX,p.gloveY).setRotation(angle).setScale(motion?.7:.55).setAlpha((motion?.95:.6)*tail).setVisible(!startup&&tail>0);
   const dx=p.x-p.startX,dy=p.y-p.startY,distance=Math.hypot(dx,dy);
   a.trail.setPosition(p.x,p.y).setRotation(Math.atan2(dy,dx)).setDisplaySize(Math.min(90,distance),motion?22:12).setAlpha((motion?.65:.3)*tail).setVisible(!startup&&distance>0&&tail>0);
  });
  for(const b of this.impacts){const age=tick-b.tick,visible=!finished&&age>=0&&age<8;b.image.setVisible(visible);if(visible)b.image.setPosition(b.x,b.y).setScale((motion?.45+age*.05:.55)*b.strength).setAlpha((1-age/8)*b.strength);}
  if(finished)this.impacts.forEach(b=>b.tick=-1000);
 }
 private syncTick(tick:number){if(tick<this.lastTick)this.impacts.forEach(b=>{b.tick=-1000;b.image.setVisible(false);});this.lastTick=tick;}
 diagnostics(){return {eagleCapacity:2,eagleActive:this.active,eagleObjects:this.disposed?0:10,eagleWorldParented:this.objects().filter(i=>!!i.parentContainer).length};}
 private objects(){return [...this.actors.flatMap(a=>[a.charge,a.fire,a.trail]),...this.impacts.map(b=>b.image)];}
 destroy(){if(this.disposed)return;this.disposed=true;this.active=0;this.scene.events.off('shutdown',this.destroy,this);this.objects().forEach(i=>i.destroy());this.actors=[];this.impacts=[];}
}
