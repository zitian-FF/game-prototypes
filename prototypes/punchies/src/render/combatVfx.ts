import type Phaser from 'phaser';

type Point={x:number;y:number};
const NAVY=0x101b32;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const quad=(x:number,y:number,length:number,width:number,angle:number):Point[]=>{
 const dx=Math.cos(angle),dy=Math.sin(angle);
 return [{x:x-dy*width,y:y+dx*width},{x:x+dx*length*.7-dy*width*.32,y:y+dy*length*.7+dx*width*.32},
  {x:x+dx*length,y:y+dy*length},{x:x+dy*width*.55,y:y-dx*width*.55}];
};
interface Burst {g:Phaser.GameObjects.Graphics;age:number;duration:number;size:number;palette:number[];rays:number;sweet:boolean;serial:number}

/** Bounded, scene-owned world-space bursts. No emitters, textures or tweens. */
export class CombatSparks {
 static readonly CAPACITY=8;
 private pool:Burst[];
 private serial=0;private peak=0;private disposed=false;
 constructor(private scene:Phaser.Scene){
  this.pool=Array.from({length:CombatSparks.CAPACITY},()=>({g:scene.add.graphics().setDepth(61).setVisible(false),age:0,duration:0,size:1,palette:[],rays:0,sweet:false,serial:0}));
  scene.events.on('update',this.update,this);
  scene.events.once('shutdown',this.destroy,this);
 }
 burst(x:number,y:number,dx:number,dy:number,size:number,palette:number[],rays:number):void {
  if(this.disposed)return;
  const slot=this.pool.find(b=>b.duration===0)??this.pool.reduce((a,b)=>a.serial<b.serial?a:b);
  Object.assign(slot,{age:0,duration:rays>4?220:145,size,palette,rays:Math.min(12,rays),sweet:rays>4,serial:++this.serial});
  slot.g.clear().setPosition(x,y).setRotation(Math.atan2(dy,dx)).setAlpha(1).setScale(1).setVisible(true);
  this.draw(slot);this.peak=Math.max(this.peak,this.pool.filter(b=>b.duration>0).length);
 }
 private update(_time:number,delta:number):void {
  for(const b of this.pool){if(!b.duration)continue;b.age+=Math.max(0,delta);
   if(b.age>=b.duration){b.duration=0;b.g.clear().setVisible(false);}else this.draw(b);
  }
 }
 private draw(b:Burst):void {
  const {g,size:s,palette:p}=b,t=clamp(b.age/b.duration),travel=1-Math.pow(1-t,3);
  g.clear();
  // Hard, asymmetric contact flare: it snaps open, then leaves directional shards.
  const flash=clamp(1-b.age/(b.sweet?85:55));
  if(flash>0){
   const r=s*(.8+Math.sin(clamp(b.age/42)*Math.PI/2)*.55),core=[
    {x:-9*r,y:0},{x:-3*r,y:-2*r},{x:-6*r,y:-9*r},{x:1*r,y:-4*r},
    {x:6*r,y:-12*r},{x:6*r,y:-3*r},{x:19*r,y:-1*r},{x:7*r,y:3*r},
    {x:10*r,y:10*r},{x:2*r,y:5*r},{x:-5*r,y:8*r},{x:-3*r,y:2*r}];
   g.fillStyle(b.sweet?p[2]:0xf4b96b,flash).fillPoints(core,true);
   g.lineStyle(1.25*s,NAVY,flash*.8).strokePoints(core,true);
   g.fillStyle(b.sweet?p[0]:p[1],flash).fillPoints(core.map(v=>({x:v.x*.46,y:v.y*.46})),true);
  }
  const fade=Math.pow(1-t,b.sweet?1.1:1.6);
  for(let i=0;i<b.rays;i++){
   const side=i%2===0?1:-1,angle=side*(.12+Math.floor(i/2)*.17)+(i%3-1)*.04;
   const length=(i%3===0?23:14)*s*(.75+travel*.55),distance=(7+travel*(20+(i%4)*7))*s;
   const x=Math.cos(angle)*distance,y=Math.sin(angle)*distance;
   const shape=quad(x,y,length,(b.sweet?1.6:1.1)*s,angle);
   g.fillStyle(b.sweet?p[2]:0xe8a265,fade).fillPoints(shape,true);
   g.fillStyle(b.sweet?p[0]:p[1],fade*.9).fillPoints(quad(x,y,length*.78,.55*s,angle),true);
  }
  // A few shaped flecks instead of an unbounded field of round particles.
  for(let i=0;i<(b.sweet?3:1);i++){
   const angle=(i-1)*.72,dist=(12+travel*(25+i*5))*s;
   g.fillStyle(p[1],fade*.8).fillPoints(quad(Math.cos(angle)*dist,Math.sin(angle)*dist,3*s,1*s,angle+.5),true);
  }
 }
 diagnostics(){return {sparkCapacity:this.pool.length,activeSparks:this.pool.filter(b=>b.duration>0).length,peakSparks:this.peak,sparkTweens:0,sparkTextures:0};}
 destroy():void {
  if(this.disposed)return;this.disposed=true;
  this.scene.events.off('update',this.update,this);
  for(const b of this.pool){b.duration=0;b.g.destroy();}this.pool=[];
 }
}

/** Authored curled tongues, with a red shell, golden body and cream hot core.
 * Drawn into the puppet's existing world-owned Graphics; arm pose/timing stay intact. */
export function drawUppercutFlame(g:Phaser.GameObjects.Graphics,root:Point,fist:Point,intensity:number,now:number,k:number,rig:{uppercutFireFlickerHz:number;uppercutFireWidth:number;uppercutFireLength:number}):void {
 if(intensity<=0)return;
 const len=Math.hypot(fist.x-root.x,fist.y-root.y)||1,dx=(fist.x-root.x)/len,dy=(fist.y-root.y)/len;
 const phase=now*rig.uppercutFireFlickerHz*Math.PI*2/1000;
 const width=rig.uppercutFireWidth*k*intensity*(1+.08*Math.sin(phase));
 const length=rig.uppercutFireLength*k*intensity;
 const point=(u:number,v:number):Point=>({x:fist.x+dx*u-dy*v,y:fist.y+dy*u+dx*v});
 const outline=[[-len,.08*width],[-len*.65,.42*width],[-8*k,.76*width],
  [.12*length,.89*width],[.40*length,.77*width],[.69*length,1.03*width],
  [.56*length,.44*width],[.29*length,.29*width],[.61*length,.19*width],
  [1.12*length,.31*width],[.90*length,-.06*width],[.43*length,-.15*width],
  [.67*length,-.62*width],[.47*length,-.56*width],[.11*length,-.36*width],
  [-7*k,-.70*width],[-len*.63,-.39*width]];
 const shape=(scale:number)=>outline.map(([u,v])=>point(u*scale,v*scale+Math.sin(phase)*width*.04));
 const alpha=Math.min(1,intensity*1.7),outer=shape(1);
 g.fillStyle(0xe44827,alpha).fillPoints(outer,true);
 g.lineStyle(1.3*k,NAVY,intensity*.9).strokePoints(outer,true);
 g.fillStyle(0xffa828,intensity).fillPoints(shape(.78),true);
 g.fillStyle(0xffe57b,intensity).fillPoints(shape(.53),true);
 // Narrow hot core flows from the covered forearm into the leading tongue.
 g.fillStyle(0xfff4ce,intensity).fillPoints([point(-len*.74,0),point(-6*k,width*.23),point(length*.65,width*.04),point(-2*k,-width*.15)],true);
 for(let i=0;i<3;i++){
  const t=(now*rig.uppercutFireFlickerHz/1000+i/3)%1;
  const p=point(length*(.8+t*.55),width*(i-1)*.55+Math.sin(phase+i)*width*.08);
  g.fillStyle(i===1?0xfff4ce:0xffb52a,intensity*(1-t)).fillPoints(quad(p.x,p.y,(3.8-2*t)*k,(1.5-t)*k,Math.atan2(dy,dx)),true);
 }
}
