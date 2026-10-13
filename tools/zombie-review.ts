import Phaser from 'phaser';
import {Puppet} from '../prototypes/punchies/src/render/puppet';
import {createSimState} from '../prototypes/punchies/src/sim/sim';
import {punchFist} from '../prototypes/punchies/src/render/punchMotion';
let paused=false,clock=0;
document.querySelector<HTMLButtonElement>('#pause')!.onclick=e=>{paused=!paused;(e.target as HTMLButtonElement).textContent=paused?'Resume':'Pause';};
class Review extends Phaser.Scene {
 private puppets:Puppet[]=[];
 private fighters=Array.from({length:2},()=>createSimState({fighters:[{},{}]}).fighters[0]);
 preload(){for(const part of ['head','torso','glove_right','boot_right'])this.load.image('punchies:part_zombie_'+part,'./zombie-review-assets/part_zombie_'+part+'.webp');}
 create(){
  for(const [part,axis] of [['glove','x'],['boot','y']] as const){const src=this.textures.get('punchies:part_zombie_'+part+'_right').getSourceImage() as HTMLImageElement;const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;const ctx=canvas.getContext('2d')!;ctx.translate(axis==='x'?src.width:0,axis==='y'?src.height:0);ctx.scale(axis==='x'?-1:1,axis==='y'?-1:1);ctx.drawImage(src,0,0);this.textures.addCanvas('punchies:part_zombie_'+part+'_left',canvas);}
  this.puppets=[new Puppet(this),new Puppet(this)];
  const g=this.add.graphics().setDepth(-1);for(let x=620;x<1000;x+=16)for(let y=65;y<500;y+=16)g.fillStyle(((x-620+y-65)/16)%2?0xd3d8e0:0xf0f2f6).fillRect(x,y,16,16);
  this.add.text(245,35,'COMPLETE ASSEMBLY',{fontSize:'18px',fontStyle:'bold'}).setOrigin(.5);
  this.add.text(520,35,'COMBAT SCALE',{fontSize:'16px',fontStyle:'bold'}).setOrigin(.5);
  this.add.text(805,35,'ALPHA PARTS',{fontSize:'18px',fontStyle:'bold'}).setOrigin(.5);
  for(const [part,x,y,scale] of [['head',705,170,1.15],['torso',900,170,1.15],['glove_right',700,330,1.1],['glove_left',890,330,1.1],['boot_right',705,448,1.15],['boot_left',890,448,1.15]] as const)this.add.image(x,y,'punchies:part_zombie_'+part).setScale(scale);
  document.querySelector('#status')!.textContent='Ready · no saves/gameplay';
 }
 update(_time:number,delta:number){
  if(!paused)clock+=Math.min(delta,40);
  document.querySelector('#status')!.textContent='Ready · '+Math.floor(clock)+' ms · no saves/gameplay';
  const pose=document.querySelector<HTMLSelectElement>('#pose')!.value;
  this.fighters.forEach((f,i)=>{
   const k=i===0?5:1.5;f.fx=0;f.fy=-1;f.x=i===0?245:520;f.y=290;
   const fists:[{x:number;y:number},{x:number;y:number}]=[{x:f.x-15*k,y:f.y-15*k},{x:f.x+15*k,y:f.y-15*k}];
   f.punch=null;
   if(pose==='guard'){fists[0]={x:f.x-8*k,y:f.y-25*k};fists[1]={x:f.x+8*k,y:f.y-25*k};}
   if(pose==='jab'){f.punch={type:'jab',hand:0,frame:Math.floor(clock/30)%28,startup:6,sourEarly:4,sweet:3,sour:3,recovery:12,whiffFrames:0,reach:38*k,startReach:15*k,damageMult:1,resolved:false,connected:false,buffed:false};fists[0]=punchFist(f,f.punch,k);}
   this.puppets[i].draw({f,visualId:'zombie',now:clock,k,alt:false,fists,fistColors:[0,0],baseColor:0,walk:clock/320,stride:pose==='walk'?1:0,vel:pose==='walk'?{x:.1,y:-.2}:{x:0,y:0},flashHead:false,flashBody:false,flashColor:0,dodging:false,guarding:pose==='guard',reviewLegsOnly:i===0&&document.querySelector<HTMLInputElement>('#joins')!.checked});
  });
 }
}
const game=new Phaser.Game({type:Phaser.CANVAS,width:1000,height:520,parent:'app',backgroundColor:'#182a41',fps:{forceSetTimeOut:true,target:60},scene:Review});
game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
window.setInterval(()=>{game.loop.resume();},500);

