import Phaser from 'phaser';
import {ArtBootScene,fighterGroups,whenGroupsReady} from '../prototypes/punchies/src/render/art';
import {FightStage} from '../prototypes/punchies/src/scenes/FightStage';
import {createSimState,step} from '../prototypes/punchies/src/sim/sim';
import {fighterSuper} from '../prototypes/punchies/src/sim/super';
import {NEUTRAL_INPUT,type SimEvent} from '../prototypes/punchies/src/sim/types';
import {tune} from '../prototypes/punchies/src/sim/tune';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
import {initLanguage} from '../prototypes/punchies/src/i18n/init';
await initLanguage();const params=new URLSearchParams(location.search),mode=params.get('mode')??'hit',capture=Number(params.get('frame')??24),buffalo=params.get('ability')==='buffalo',caster=buffalo?'tyke':'tee';let review:Review,ready=false,captured=false;
class Review extends Phaser.Scene {
 stage!:FightStage;sim=createSimState({timed:false,fighters:[{char:caster},{char:'marco'}]});acc=0;simEvents:SimEvent[]=[];dodged=false;launchTick:number|null=null;
 constructor(){super('CodeXReview');}
 create(){review=this;this.scene.stop('Menu');this.scene.stop('FirstFight');applyCameraPixelRatio(this);whenGroupsReady(this,fighterGroups([caster,'marco']),()=>{
  const [a,b]=this.sim.fighters;a.x=355;a.y=225;a.fx=1;a.fy=0;a.stars=fighterSuper(a).starCost;b.x=mode==='miss'?580:410;b.y=225;b.fx=-1;b.fy=0;b.health=500;
  this.stage=new FightStage(this,[buffalo?'TYKE':'G.P. TEE','MARCO · QA HP 500'],0,true);this.stage.hud.resourceRow=[0,1];this.stage.draw(this.sim,this.time.now,false);this.stage.persp.beginRound(this.time.now-tune.view.arena.roundZoomMs);ready=true;
 });}
 update(_time:number,delta:number){if(!ready)return;this.acc+=delta;
  while(this.acc>=1000/60){this.acc-=1000/60;const ability=this.sim.fighters[0].codeX;const dodge=mode==='dodge'&&ability&&ability.frame>=ability.tracks[0].startFrame-2&&!this.dodged;this.dodged||=!!dodge;
   const ev=step(this.sim,[{...NEUTRAL_INPUT,uppercut:this.sim.tick===0},{...NEUTRAL_INPUT,guard:mode==='guard',...(dodge?{my:100,dodge:true}:{})}],false);this.simEvents.push(...ev);this.stage.handleEvents(ev,this.sim);if(ev.some(e=>e.kind==='codeXLaunched'))this.launchTick=this.sim.tick;
  }
  this.stage.draw(this.sim,this.time.now,false);const ability=this.sim.fighters[0].codeX;
  document.getElementById('status')!.textContent=JSON.stringify({mode,ability:buffalo?'buffalo-hook':'code-x',punch:this.sim.fighters[0].punch?{type:this.sim.fighters[0].punch.type,frame:this.sim.fighters[0].punch.frame,buffaloUpper:this.sim.fighters[0].punch.buffaloUpper}:null,followup:this.simEvents.filter(e=>e.kind==='buffaloFollowup'),tick:this.sim.tick,frame:ability?.frame??null,launchTick:this.launchTick,health:this.sim.fighters[1].health,contact:this.simEvents.filter(e=>e.kind==='codeXContact'),hits:this.simEvents.filter(e=>e.kind==='hit').map(e=>({punch:e.punch,damage:e.damage})),render:(this.stage as any).fx.codeXShadows.diagnostics(),renderer:game.renderer.type,objects:this.children.list.length,world:this.stage.persp.world?.list.length,fixture:'actual neutral-input sim.step; target HP500 solely to keep visual demo alive'});
 }
}
class Boot extends ArtBootScene{create(){super.create();this.scene.launch('CodeXReview');}}
const game=new Phaser.Game({type:params.has('canvas')?Phaser.CANVAS:Phaser.AUTO,parent:'app',backgroundColor:'#081324',fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
game.scene.add('CodeXReview',Review,false);game.scene.add('ArtBoot',Boot,true);game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{if(!ready||captured)return;const ability=review.sim.fighters[0].codeX;const done=buffalo?(capture>=99?review.simEvents.some(e=>e.kind==='buffaloFollowup')&&!review.sim.fighters[0].punch:review.sim.fighters[0].punch?.buffaloUpper&&review.sim.fighters[0].punch.frame>=capture):(capture>=99?review.launchTick!==null&&!ability:ability&&ability.frame>=capture);
 if(done||review.sim.tick>180){captured=true;review.scene.pause();}});
