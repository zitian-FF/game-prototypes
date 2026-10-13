import type Phaser from 'phaser';
import type {Fighter} from '../sim/types';
import {wavePosition} from '../sim/waveMotion';
import {normalHurtRadius} from '../sim/geometry';
import {reducedMotion} from '../ui/presentation';
import {waveMotionTexture,WAVE_ART} from './waveMotionTexture';
/** Adapter supplies authoritative world position/phase; this renderer never integrates speed or creates hits. */
export interface WavePresentation {id:number;phase:'startup'|'travel';frame:number;startup:number;x:number;y:number;fx:number;fy:number;radius:number}
export function wavePresentation(f:Fighter):WavePresentation|null {
 if(f.health<=0||!f.wave)return null;const w=f.wave,pos=wavePosition(w),socket=w.launched?0:normalHurtRadius(f);
 return {id:w.activationId,frame:w.frame,startup:w.startup,fx:w.fx,fy:w.fy,radius:w.radius,...pos,x:pos.x+w.fx*socket,y:pos.y+w.fy*socket};
}
interface Contact {image:Phaser.GameObjects.Image;tick:number;x:number;y:number;angle:number;strength:number}
export class WaveMotionVfx {
 private bodies:Phaser.GameObjects.Image[]=[];private contacts:Contact[]=[];private cursor=0;private disposed=false;private lastTick=-1;private active=0;
 constructor(private scene:Phaser.Scene){const key=waveMotionTexture(scene);
  for(let i=0;i<2;i++)this.bodies.push(scene.add.image(0,0,key,'wave-0').setDepth(66).setOrigin(WAVE_ART.coreX/WAVE_ART.width,WAVE_ART.coreY/WAVE_ART.height).setVisible(false));
  for(let i=0;i<4;i++)this.contacts.push({image:scene.add.image(0,0,key,'impact').setDepth(67).setOrigin(WAVE_ART.coreX/WAVE_ART.width,WAVE_ART.coreY/WAVE_ART.height).setVisible(false),tick:-1000,x:0,y:0,angle:0,strength:0});
  scene.events.once('shutdown',this.destroy,this);
 }
 contact(tick:number,x:number,y:number,fx:number,fy:number,strength:number){if(this.disposed)return;this.syncTick(tick);const c=this.contacts[this.cursor++%this.contacts.length];Object.assign(c,{tick,x,y,angle:Math.atan2(fy,fx),strength});}
 draw(sources:readonly WavePresentation[],tick:number,finished=false){if(this.disposed)return;
  this.syncTick(tick);
  const motion=!reducedMotion(),live=finished?[]:sources.slice(0,2);this.active=live.length;
  this.bodies.forEach((image,i)=>{const p=live[i];if(!p){image.setVisible(false);return;}
   const startup=p.phase==='startup',charge=Math.max(0,Math.min(1,p.frame/Math.max(1,p.startup))),scale=startup?(motion?.22+.25*charge:.4):p.radius/WAVE_ART.coreRadius;
   image.setFrame(startup?'startup':'wave-'+(motion?Math.floor(p.frame/3)%4:0)).setPosition(p.x,p.y).setRotation(Math.atan2(p.fy,p.fx)).setScale(scale).setAlpha(startup?.25+.65*charge:1).setVisible(true);
  });
  for(const c of this.contacts){const age=tick-c.tick,visible=!finished&&age>=0&&age<8;c.image.setVisible(visible);if(!visible)continue;
   c.image.setPosition(c.x,c.y).setRotation(c.angle).setScale((motion?.35+age*.055:.45)*c.strength).setAlpha((1-age/8)*c.strength);
  }
  if(finished)this.contacts.forEach(c=>c.tick=-1000);
 }
 private syncTick(tick:number){if(tick<this.lastTick)this.contacts.forEach(c=>{c.tick=-1000;c.image.setVisible(false);});this.lastTick=tick;}
 diagnostics(){return{waveCapacity:2,waveActive:this.active,waveObjects:this.disposed?0:6,waveWorldParented:[...this.bodies,...this.contacts.map(c=>c.image)].filter(i=>!!i.parentContainer).length};}
 destroy(){if(this.disposed)return;this.disposed=true;this.active=0;this.scene.events.off('shutdown',this.destroy,this);[...this.bodies,...this.contacts.map(c=>c.image)].forEach(i=>i.destroy());this.bodies=[];this.contacts=[];}
}
