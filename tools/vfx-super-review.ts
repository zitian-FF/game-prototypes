import Phaser from 'phaser';
import {ArtBootScene,fighterGroups,whenGroupsReady} from '../prototypes/punchies/src/render/art';
import {FightStage} from '../prototypes/punchies/src/scenes/FightStage';
import {createSimState,arenaCombat} from '../prototypes/punchies/src/sim/sim';
import {fighterSuper,superReady} from '../prototypes/punchies/src/sim/super';
import {NEUTRAL_INPUT,type SimEvent} from '../prototypes/punchies/src/sim/types';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
import {initLanguage} from '../prototypes/punchies/src/i18n/init';
await initLanguage();
const params=new URLSearchParams(location.search);
let mode=params.get('mode')??'lost',review:Review,ready=false,captured=false;
class Review extends Phaser.Scene {
 stage!:FightStage;sim=createSimState({timed:false,fighters:[{char:'marco'},{char:'mia'}]});age=0;triggered=false;eventTrace:SimEvent[]=[];
 constructor(){super('SuperVfxReview');}
 create(){review=this;this.scene.stop('Menu');this.scene.stop('FirstFight');applyCameraPixelRatio(this);
  whenGroupsReady(this,fighterGroups(['marco','mia']),()=>{
   this.sim.fighters.forEach((f,i)=>{f.x=i?485:365;f.y=225;f.fx=i?-1:1;f.fy=0;f.stars=fighterSuper(f).starCost;});
   this.stage=new FightStage(this,['MARCO','MIA'],0,true);this.stage.hud.resourceRow=[0,1];ready=true;
  });
 }
 trigger(){this.triggered=true;const s=this.sim,[a,b]=s.fighters;const events:SimEvent[]=[];
  if(mode==='spent')arenaCombat.processInput(s,1,{...NEUTRAL_INPUT,uppercut:true},events);
  else if(mode!=='charged'){
   a.stars=0;if(mode==='sweet')b.stars=0;
   if(mode==='interrupted')arenaCombat.processInput(s,1,{...NEUTRAL_INPUT,uppercut:true},events);
   arenaCombat.processInput(s,0,{...NEUTRAL_INPUT,jab:true},events);
   if(mode==='whiff')for(let i=0;i<100;i++)arenaCombat.advanceTimers(s,0,NEUTRAL_INPUT,events);
   else if(a.punch){a.punch.frame=a.punch.startup;arenaCombat.resolveContact(s,{attacker:0,sweet:mode!=='sour',core:true,x:b.x-15,y:b.y},['normal','normal'],[false,mode==='interrupted'],[false,false],s.fighters.map(f=>f.exhausted),events);}
  }
  this.eventTrace=events;this.stage.handleEvents(events,s);
 }
 update(_time:number,delta:number){if(!this.stage)return;this.age+=delta;if(!this.triggered&&this.age>=150)this.trigger();this.stage.draw(this.sim,this.time.now,false);
  document.getElementById('status')!.textContent=JSON.stringify({mode,age:Math.round(this.age),eventKinds:this.eventTrace.map(e=>e.kind),stars:this.sim.fighters.map(f=>f.stars),ready:this.sim.fighters.map(superReady),symbol:(this.stage.fx as any).symbols.diagnostics(),lightning:(this.stage.hud as any).superLightning.map((f:any)=>f.diagnostics()),objects:this.children.list.length,world:(this.stage as any).persp.world.list.length,renderer:game.renderer.type,contactFixture:'production resolver with forced contact, not a controller collision test'});
 }
}
class Boot extends ArtBootScene {create(){super.create();this.scene.launch('SuperVfxReview');}}
const game=new Phaser.Game({type:params.has('canvas')?Phaser.CANVAS:Phaser.AUTO,parent:'app',backgroundColor:'#081324',fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
game.scene.add('SuperVfxReview',Review,false);game.scene.add('ArtBoot',Boot,true);
game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-mode]'))button.addEventListener('click',()=>{if(!ready)return;mode=button.dataset.mode!;ready=false;captured=false;review.scene.restart();});
const capture=Number(params.get('at')??220);
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{if(ready&&!captured&&review.age>=capture){captured=true;review.scene.pause();}});
