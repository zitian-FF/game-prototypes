import Phaser from 'phaser';
import {ArtBootScene,fighterGroups,whenGroupsReady} from '../prototypes/punchies/src/render/art';
import {FightStage} from '../prototypes/punchies/src/scenes/FightStage';
import {createSimState,step} from '../prototypes/punchies/src/sim/sim';
import {fighterSuper} from '../prototypes/punchies/src/sim/super';
import {NEUTRAL_INPUT,type SimEvent} from '../prototypes/punchies/src/sim/types';
import {tune} from '../prototypes/punchies/src/sim/tune';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
import {initLanguage} from '../prototypes/punchies/src/i18n/init';
await initLanguage();const params=new URLSearchParams(location.search),mode=params.get('mode')??'travel',codeX=params.has('code-x'),eagle=params.has('eagle'),caster=eagle?'captain':codeX?'tee':'dragon',capture=Number(params.get('frame')??18);let ready=false,captured=false,review:Review;
class Review extends Phaser.Scene {
 stage!:FightStage;sim=createSimState({timed:false,fighters:[{char:caster},{char:'marco'}]});acc=0;trace:SimEvent[]=[];launched=false;finishTick:number|null=null;
 constructor(){super('WaveReview');}
 create(){review=this;this.scene.stop('Menu');this.scene.stop('FirstFight');applyCameraPixelRatio(this);whenGroupsReady(this,fighterGroups([caster,'marco']),()=>{
  const [a,b]=this.sim.fighters;a.x=340;a.y=225;a.fx=1;a.fy=0;a.stars=fighterSuper(a).starCost;b.x=codeX?395:550;b.y=mode==='travel'?290:225;b.fx=-1;b.fy=0;
  this.stage=new FightStage(this,[eagle?'CAPTAIN EAGLE':codeX?'G.P. TEE':'DRAGON','MARCO'],0,true);this.stage.hud.resourceRow=[0,1];this.stage.draw(this.sim,this.time.now,false);this.stage.persp.beginRound(this.time.now-tune.view.arena.roundZoomMs);ready=true;
 });}
 update(_now:number,delta:number){if(!ready)return;this.acc+=delta;while(this.acc>=1000/60){this.acc-=1000/60;
  const e=step(this.sim,[{...NEUTRAL_INPUT,uppercut:this.sim.tick===0},{...NEUTRAL_INPUT,guard:mode==='guard'&&(!codeX||!!this.sim.fighters[0].codeX)}],false);this.trace.push(...e);this.stage.handleEvents(e,this.sim);this.launched||=e.some(e=>e.kind==='waveLaunched'||e.kind==='codeXLaunched'||e.kind==='eagleLaunched');if(e.some(e=>e.kind==='waveFinished'||e.kind==='codeXFinished'||e.kind==='eagleFinished'))this.finishTick=this.sim.tick;
 }
 this.stage.draw(this.sim,this.time.now,false);const a=this.sim.fighters[0],fx=(this.stage as any).fx;
 document.getElementById('status')!.textContent=JSON.stringify({mode,codeX,eagle,eagleState:a.eagle,tick:this.sim.tick,wave:a.wave,codeXFrame:a.codeX?.frame??null,health:this.sim.fighters[1].health,stamina:this.sim.fighters[1].stamina,events:this.trace.filter(e=>['waveLaunched','waveContact','waveFinished','codeXContact','eagleLaunched','eagleContact','eagleFinished'].includes(e.kind)),waveRender:fx.waveVfx.diagnostics(),eagleRender:fx.eagleVfx.diagnostics(),codeXRender:fx.codeXShadows.diagnostics(),renderer:game.renderer.type,fixture:'real sim.step and FightStage; explicit positions/chargedSUPER only, no forced contacts'});
 }
}
class Boot extends ArtBootScene{create(){super.create();this.scene.launch('WaveReview');}}
const game=new Phaser.Game({type:params.has('canvas')?Phaser.CANVAS:Phaser.AUTO,parent:'app',backgroundColor:'#081324',fps:{forceSetTimeOut:true,target:60},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
game.scene.add('WaveReview',Review,false);game.scene.add('ArtBoot',Boot,true);game.events.once('ready',()=>{game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{if(!ready||captured)return;const a=review.sim.fighters[0],ability=eagle?a.eagle:codeX?a.codeX:a.wave,done=capture>=99?review.finishTick!==null&&review.sim.tick>=review.finishTick+9:ability&&ability.frame>=capture;
 if(done||review.sim.tick>150){captured=true;review.scene.pause();}});
