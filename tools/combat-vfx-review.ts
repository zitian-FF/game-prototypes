import Phaser from 'phaser';
import {ArtBootScene,fighterGroups,whenGroupsReady} from '../prototypes/punchies/src/render/art';
import {FightStage} from '../prototypes/punchies/src/scenes/FightStage';
import {TrainingScene} from '../prototypes/punchies/src/scenes/TrainingScene';
import {MenuScene} from '../prototypes/punchies/src/scenes/MenuScene';
import {GameMenuScene} from '../prototypes/punchies/src/scenes/GameMenuScene';
import {ScreenTransition} from '../prototypes/punchies/src/ui/presentation';
import {createSimState} from '../prototypes/punchies/src/sim/sim';
import type {SimState} from '../prototypes/punchies/src/sim/types';
import {MatchIntro} from '../prototypes/punchies/src/ui/fightPresentation';
import {tune} from '../prototypes/punchies/src/sim/tune';
import {applyCameraPixelRatio,VIEW,PIXEL_RATIO} from '../prototypes/punchies/src/render/pixelRatio';
const params=new URLSearchParams(location.search),mode=params.get('mode')??'sweet',zoom=Number(params.get('zoom')??1);
let rounds=0;let restartRemaining=0;let drawCalls=0;let lastDrawCalls=0;let peakDrawCalls=0;
class TrainingReview extends TrainingScene {
 private lastHealth:number|null=null;
 update(time:number,delta:number){
  super.update(time,delta);const sim=(this as any).sim as SimState|undefined;if(!sim)return;
  const health=sim.fighters[1].health;
  if(this.lastHealth!==null&&health<this.lastHealth){
   const pool=(this as any).stage.fx.sparks;
   document.querySelector('#status')!.textContent=JSON.stringify({actualTrainingHit:true,damage:this.lastHealth-health,dummyHealth:health,...pool?.diagnostics(),drawCalls:lastDrawCalls});
   this.scene.pause();
  }
  this.lastHealth=health;
 }
}
class Review extends Phaser.Scene {
 private stage!:FightStage;private sim!:SimState;private built=false;private age=0;private intro?:MatchIntro;
 constructor(){super('VfxReview');}
 create(){applyCameraPixelRatio(this);this.built=false;this.age=0;whenGroupsReady(this,fighterGroups(['marco','mia']),()=>{
  this.sim=createSimState({timed:false,fighters:[{char:'marco'},{char:'mia'}]});this.sim.tick=1000;this.sim.fightStartTick=0;
  this.stage=new FightStage(this,['MARCO','MIA'],-1,false);
  this.stage.draw(this.sim,1000);(this.stage as any).persp.beginRound(this.time.now-tune.view.arena.roundZoomMs*zoom);
  if(mode==='upper')this.sim.fighters[0].punch={type:'uppercut',frame:12,startup:8,sourEarly:3,sweet:5,sour:4,recovery:20,whiffFrames:0,reach:45,startReach:18,damageMult:1,resolved:false,connected:false,buffed:false,hand:0};
  this.intro=mode==='vs'?new MatchIntro(this,['marco','mia']):undefined;this.built=true;this.emitHit();
 });}
 private emitHit(){if(mode==='upper'||mode==='vs')return;const target=this.sim.fighters[1];this.stage.handleEvents([{kind:'hit',attacker:0,x:target.x-8,y:target.y,punch:'cross',sweet:mode!=='sour',counter:false,row:'normal',damage:mode==='sour'?3:12,buffed:false}],this.sim);}
 update(time:number,delta:number){if(!this.built)return;this.stage.draw(this.sim,1000);this.age+=delta;
  if(mode==='vs'){this.intro?.draw(this.age);if(this.age>=Number(params.get('at')??1000)){this.updateStatus();this.scene.pause();}}else if(mode==='stress'){
   if(this.age<1000)this.emitHit();
   if(this.age>2400){this.updateStatus();if(restartRemaining>0){restartRemaining--;rounds++;this.age=0;this.scene.restart();}else this.scene.pause();}
  }else if(this.age>=48){this.updateStatus();if(restartRemaining>0){restartRemaining--;rounds++;this.scene.restart();}else this.scene.pause();}
 }
 private updateStatus(){const fx=(this.stage as any).fx;const diag=fx.sparks?.diagnostics?.();document.querySelector('#status')!.textContent=JSON.stringify({renderer:this.game.renderer.type,objects:this.children.list.length,worldObjects:(this.stage as any).persp.world?.list.length,tweens:this.tweens.getTweens().length,...diag,restarts:rounds,fps:Math.round(this.game.loop.actualFps),drawCalls:lastDrawCalls,peakDrawCalls});}
}
class Boot extends ArtBootScene {create(){super.create();for(const scene of this.game.scene.getScenes(true))if(scene.scene.key!=='ArtBoot')scene.scene.stop();this.scene.launch(mode==='training'?'Training':'VfxReview',{char:'marco'});}}
const game=new Phaser.Game({type:params.get('canvas')==='1'?Phaser.CANVAS:Phaser.AUTO,parent:'app',backgroundColor:'#081324',fps:{forceSetTimeOut:true,target:60},input:{activePointers:4},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO}});
const gl=(game.renderer as any).gl;if(gl){for(const name of ['drawArrays','drawElements']){const original=gl[name].bind(gl);gl[name]=(...args:any[])=>{drawCalls++;return original(...args);};}}
game.events.on(Phaser.Core.Events.PRE_RENDER,()=>drawCalls=0);game.events.on(Phaser.Core.Events.POST_RENDER,()=>{lastDrawCalls=drawCalls;peakDrawCalls=Math.max(peakDrawCalls,drawCalls);});
for(const [key,scene] of [['VfxReview',Review],['Training',TrainingReview],['Menu',MenuScene],['GameMenu',GameMenuScene],['ScreenTransition',ScreenTransition]] as const)game.scene.add(key,scene,false);
game.scene.add('ArtBoot',Boot,true);game.events.once('ready',()=>{game.canvas.tabIndex=0;game.canvas.focus();game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);game.loop.resume();});window.setInterval(()=>game.loop.resume(),500);
(document.querySelector('#mode') as HTMLSelectElement).value=mode;(document.querySelector('#zoom') as HTMLSelectElement).value=String(zoom);
document.querySelector('#show')!.addEventListener('click',()=>location.search=new URLSearchParams({mode:(document.querySelector('#mode') as HTMLSelectElement).value,zoom:(document.querySelector('#zoom') as HTMLSelectElement).value}).toString());
document.querySelector('#restart')!.addEventListener('click',()=>{const review=game.scene.getScene('VfxReview');restartRemaining=19;rounds=1;review.scene.resume();review.scene.restart();});
