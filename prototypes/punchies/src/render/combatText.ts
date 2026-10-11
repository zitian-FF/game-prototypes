import type Phaser from 'phaser';
import {PIXEL_RATIO} from './pixelRatio';
type Kind='damage'|'label'|'shaky';
interface Slot {text:Phaser.GameObjects.Text;kind:Kind;x:number;y:number;age:number;life:number;serial:number;style:string}
/** Bounded canvas-text reuse for multi-target impacts; no per-impact tweens. */
export class CombatText {
 private pool:Slot[]=[];private serial=0;private disposed=false;
 constructor(private scene:Phaser.Scene){
  for(let i=0;i<20;i++)this.pool.push({text:scene.add.text(0,0,'',{fontFamily:'monospace',fontSize:17,fontStyle:'bold',stroke:'#000000',strokeThickness:3,resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(i<12?72:70).setVisible(false),kind:'label',x:0,y:0,age:0,life:0,serial:0,style:''});
  scene.events.on('update',this.update,this);scene.events.once('shutdown',this.destroy,this);
 }
 show(kind:Kind,x:number,y:number,value:string,color:string,size:number):void {
  if(this.disposed)return;
  const slots=this.pool.slice(kind==='damage'?0:12,kind==='damage'?12:20);
  const s=slots.find(s=>!s.life)??slots.reduce((a,b)=>a.serial<b.serial?a:b);
  Object.assign(s,{kind,x,y,age:0,life:kind==='damage'?900:kind==='shaky'?750:700,serial:++this.serial});
  const style=`${color}:${size}:${kind}`;
  if(s.style!==style){s.text.setStyle({color,fontSize:size,strokeThickness:kind==='damage'?5:kind==='shaky'?4:3});s.style=style;}
  s.text.setText(value).setPosition(x,y).setDepth(kind==='damage'?72:kind==='shaky'?75:70).setAlpha(1).setScale(kind==='damage'?1.6:kind==='shaky'?1.4:1).setVisible(true);
 }
 private update(_time:number,delta:number){
  for(const s of this.pool){if(!s.life)continue;s.age+=Math.max(0,delta);
   if(s.age>=s.life){s.life=0;s.text.setVisible(false);continue;}
   if(s.kind==='damage'){
    const u=Math.min(1,s.age/110)-1,back=1+2.70158*u*u*u+1.70158*u*u;
    const fade=Math.max(0,(s.age-380)/520),f=fade*fade*fade;
    s.text.setScale(s.age<110?1.6-.6*back:1).setPosition(s.x,s.y-26*f).setAlpha(1-f);
   }else if(s.kind==='label'){
    const f=Math.max(0,(s.age-250)/450);s.text.setPosition(s.x,s.y-18*f).setAlpha(1-f);
   }else{
    const k=1-s.age/750,amp=4*k;
    s.text.setPosition(s.x+Math.sin(s.age*.09+s.serial)*amp,s.y-(1-k)*12+Math.cos(s.age*.13+s.serial)*amp).setAlpha(Math.min(1,k*1.6)).setScale(1+.4*k*k);
   }
  }
 }
 diagnostics(){return {combatTextCapacity:this.pool.length,activeCombatText:this.pool.filter(s=>s.life>0).length,combatTextTweens:0};}
 destroy(){if(this.disposed)return;this.disposed=true;this.scene.events.off('update',this.update,this);for(const s of this.pool)s.text.destroy();this.pool=[];}
}
