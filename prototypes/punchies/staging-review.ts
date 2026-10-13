import Phaser from 'phaser';
declare const __PUNCHIES_STAGING_QA__: boolean;
if(!__PUNCHIES_STAGING_QA__)throw Error('Staging QA was not enabled at build time');
document.body.dataset.stagingQa='PUNCHIES_STAGE_QA_ONLY';
import {ArtBootScene,fighterGroups,whenGroupsReady} from './src/render/art';
import {FightStage} from './src/scenes/FightStage';
import {createSimState,arenaCombat} from './src/sim/sim';
import {fighterSuper,superReady} from './src/sim/super';
import {tune} from './src/sim/tune';
import {NEUTRAL_INPUT,type SimEvent} from './src/sim/types';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from './src/render/pixelRatio';
import {initLanguage} from './src/i18n/init';
import {initPortal,saveResetReceipt} from './src/portal/index';
void initPortal().then(()=>initLanguage()).then(()=>{
const params=new URLSearchParams(location.search);
let mode=params.get('mode')??'lost',review:Review,ready=false,captured=false;
class Review extends Phaser.Scene {
 stage!:FightStage;sim=createSimState({timed:false,fighters:[{char:'marco'},{char:'mia'}]});age=0;triggered=false;eventTrace:SimEvent[]=[];
 constructor(){super('SuperVfxReview');}
 create(){review=this;ready=false;this.age=0;this.triggered=false;this.eventTrace=[];this.sim=createSimState({timed:false,fighters:[{char:'marco'},{char:'mia'}]});this.scene.stop('Menu');this.scene.stop('FirstFight');applyCameraPixelRatio(this);
  whenGroupsReady(this,fighterGroups(['marco','mia']),()=>{
   this.sim.fighters.forEach((f,i)=>{f.x=i?425:365;f.y=225;f.fx=i?-1:1;f.fy=0;f.stars=(i===0&&['sweet','sour','interrupted'].includes(mode))||(i===1&&mode==='sweet')?0:fighterSuper(f).starCost;});
   this.stage=new FightStage(this,['MARCO','MIA'],0,true);(this.stage as any).hud.resourceRow=[0,1];this.sim.tick=100;this.stage.draw(this.sim,this.time.now,false);
   (this.stage as any).persp.beginRound(this.time.now-tune.view.arena.roundZoomMs);ready=true;
  });
 }
 trigger(){this.triggered=true;const s=this.sim,[a,b]=s.fighters;const events:SimEvent[]=[];
  if(mode==='spent')arenaCombat.processInput(s,1,{...NEUTRAL_INPUT,uppercut:true},events);
  else if(mode!=='charged'){
   if(mode==='interrupted')arenaCombat.processInput(s,1,{...NEUTRAL_INPUT,uppercut:true},events);
   arenaCombat.processInput(s,0,{...NEUTRAL_INPUT,jab:true},events);
   if(mode==='whiff')for(let i=0;i<100;i++)arenaCombat.advanceTimers(s,0,NEUTRAL_INPUT,events);
   else if(a.punch){a.punch.frame=a.punch.startup;arenaCombat.resolveContact(s,{attacker:0,sweet:mode!=='sour',core:true,x:b.x-15,y:b.y},['normal','normal'],[false,mode==='interrupted'],[false,false],s.fighters.map(f=>f.exhausted),events);}
  }
  this.eventTrace=events;this.stage.handleEvents(events,s);
 }
 update(_time:number,delta:number){if(!ready||!this.stage)return;this.age+=delta;if(!this.triggered&&this.age>=150)this.trigger();this.stage.draw(this.sim,this.time.now,false);
  document.getElementById('status')!.textContent=JSON.stringify({reset:saveResetReceipt(),mode,age:Math.round(this.age),eventKinds:this.eventTrace.map(e=>e.kind),stars:this.sim.fighters.map(f=>f.stars),ready:this.sim.fighters.map(superReady),symbol:((this.stage as any).fx as any).symbols.diagnostics(),lightning:((this.stage as any).hud as any).superLightning.map((f:any)=>f.diagnostics()),objects:this.children.list.length,world:(this.stage as any).persp.world.list.length,renderer:game.renderer.type,contactFixture:'production resolver with forced contact, not a controller collision test'});
 }
}
class Boot extends ArtBootScene {create(){super.create();this.scene.launch('SuperVfxReview');}}
const game=new Phaser.Game({type:params.has('canvas')?Phaser.CANVAS:Phaser.AUTO,parent:'app',backgroundColor:'#081324',fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
game.scene.add('SuperVfxReview',Review,false);game.scene.add('ArtBoot',Boot,true);
game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-mode]'))button.addEventListener('click',()=>{if(!ready)return;mode=button.dataset.mode!;ready=false;captured=false;review.scene.restart();});
const capture=Number(params.get('at')??220);
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{if(ready&&!captured&&review.age>=capture){captured=true;review.scene.pause();let frame=document.querySelector<HTMLImageElement>('#captured-frame');if(!frame){frame=document.createElement('img');frame.id='captured-frame';frame.alt='Actual rendered staging QA frame';frame.style.position='fixed';frame.style.inset='0';frame.style.width='100%';frame.style.height='100%';frame.style.objectFit='contain';frame.style.pointerEvents='none';document.body.append(frame)}frame.src=game.canvas.toDataURL('image/png')}});



});
