import Phaser from 'phaser';
import {t} from '../i18n';
import {applyCameraPixelRatio,VIEW} from '../render/pixelRatio';
import {SurvivalViews} from '../render/survivalViews';
import {mainLook} from '../render/characterLook';
import {fighterGroups,whenGroupsReady} from '../render/art';
import {charName,type CharId} from '../sim/character';
import {createSimState} from '../sim/sim';
import {tune,TICK_RATE} from '../sim/tune';
import type {SimState} from '../sim/types';
import {survivalView,closestEnemy} from '../survival/sim';
import {SurvivalStore} from '../survival/save';
import type {SurvivalRun,SurvivalEvent,SurvivalEnemy} from '../survival/types';
import {store as portalStore} from '../portal/store';
import {setGameplay} from '../portal/gameplay';
import {loadShopDraft} from '../shop/draft';
import {availableFighters,equippedSkin} from '../shop/roster';
import {getNav} from '../ui/menuNav';
import {survivalText,survivalOverlay,survivalRunPanel,fitSurvivalText} from '../ui/survivalChrome';
import {startScreen} from '../ui/presentation';
import {FightStage} from './FightStage';
import {survivalBossHud} from '../ui/survivalBossHud';

interface SurvivalData {char?:CharId;skin?:string;run?:SurvivalRun;resume?:boolean}
export class SurvivalScene extends Phaser.Scene {
 private store!:SurvivalStore;
 private run!:SurvivalRun;
 private stage!:FightStage;
 private display!:SimState;
 private enemyViews!:SurvivalViews;

 private waveText!:Phaser.GameObjects.Text;
 private killsText!:Phaser.GameObjects.Text;
 private bossWaveMode=false;
 private acc=0;private built=false;private saveFailed=false;
 private panel: string|null=null;private closePanel:(()=>void)|null=null;
 constructor(){super('Survival');}
 create(data:SurvivalData):void {
  applyCameraPixelRatio(this);this.store=new SurvivalStore(portalStore);this.built=false;this.acc=0;this.panel=null;this.closePanel=null;this.saveFailed=false;
  try{
   const owned=loadShopDraft(),fighter=availableFighters(owned).includes(data.char??'marco')?(data.char??'marco'):'marco';
   this.run=data.run??this.store.begin({fighter,skin:equippedSkin(owned,fighter,data.skin),seed:crypto.getRandomValues(new Uint32Array(1))[0],runId:crypto.randomUUID()});
   if(data.resume&&this.run.status==='intermission')this.store.advance(this.run);
  }catch{this.showInitialError();return;}
  whenGroupsReady(this,fighterGroups([this.run.fighter,'marco']),()=>this.build());
  const resumeGameplay=()=>setGameplay(this.built&&this.run.status==='active'&&!this.saveFailed);
  this.events.on('resume',resumeGameplay);
  this.events.once('shutdown',()=>{
   this.events.off('resume',resumeGameplay);
   setGameplay(false);
   if(this.run?.status==='active')try{this.store.abandon(this.run);}catch{/* Failed writes are surfaced before explicit save/exit; shutdown cannot show UI. */}
  });
 }
 private showInitialError():void {
  survivalOverlay(this,t('survival.save_error'),[t('survival.save_error_detail')],[{label:t('common.back'),run:()=>startScreen(this,'SurvivalEntry'),back:true}]);
 }
 private build():void {
  if(!this.textures.exists('punchies:part_zombie_head')){
   survivalOverlay(this,t('survival.unavailable'),[t('survival.unavailable_detail')],[{label:t('common.back'),run:()=>startScreen(this,'SurvivalEntry'),back:true}]);return;
  }
  this.display=createSimState({timed:false,fighters:[{char:this.run.fighter},{char:'marco'}]});this.display.fightStartTick=0;
  this.stage=new FightStage(this,[charName(this.run.fighter),''],0,true,[this.run.skin,'default']);this.stage.hideOpponent=true;this.enemyViews=new SurvivalViews(this,color=>this.stage.createFighterView(color));
  this.stage.setCodeXRenderSources(()=>this.run.status==='active'&&this.run.tick>=this.run.fightStartTick?[this.run.player,...this.run.enemies.filter(e=>e.kind==='boss'&&(e.fighter.codeX||e.fighter.wave||e.fighter.eagle)&&e.fighter.health>0).map(e=>e.fighter)]:[]);
  this.bossWaveMode=false;
  this.waveText=survivalText(this,VIEW.cx+VIEW.width*.23,VIEW.top+23,'',17,VIEW.width*.34,'#fff1d1',93,22);
  this.killsText=survivalText(this,VIEW.cx+VIEW.width*.23,VIEW.top+47,'',13,VIEW.width*.34,'#8edfff',93,19);
  this.built=true;setGameplay(this.run.status==='active');
 }
 private displayPair(enemy?:SurvivalEnemy):SimState {
  return {...this.display,tick:this.run.tick,fightStartTick:this.run.fightStartTick,hitstop:this.run.hitstop,result:null,fighters:[this.run.player,enemy?.fighter??this.display.fighters[1]]};
 }
 private handleSurvivalEvents(events:SurvivalEvent[],before:Map<string,SurvivalEnemy>):void {
  for(const item of events){
   if(item.kind==='kill'){this.enemyViews.kill(item,this.time.now);continue;}if(item.kind!=='combat')continue;
   const enemy=this.run.enemies.find(e=>e.id===item.entityIds[1])??before.get(item.entityIds[1]);
   this.stage.handleEvents([item.event],this.displayPair(enemy));
   if(item.event.kind==='hit'&&item.event.attacker===0)this.enemyViews.flash(item.entityIds[1],this.time.now,item.event.row==='vulnerable'?'head':'body');
  }
 }
 update(time:number,delta:number):void {
  if(!this.built)return;
  this.stage.pollDevices();
  this.stage.setSeries({bestOf:1,roundNumber:this.run.wave,wins:[0,0]});
  this.stage.inputBlocked=this.run.tick<this.run.fightStartTick||this.run.status!=='active'||this.saveFailed;
  if(this.run.status==='active'&&!this.saveFailed){
   this.acc=Math.min(this.acc+delta,1000/TICK_RATE*5);
   while(this.acc>=1000/TICK_RATE){
    this.acc-=1000/TICK_RATE;
    const before=new Map(this.run.enemies.map(e=>[e.id,e]));
    try{this.handleSurvivalEvents(this.store.step(this.run,this.stage.sampleLocal()),before);}catch{this.saveFailed=true;break;}
    if(this.run.status!=='active'){this.acc=0;break;}
   }
  }
  const view=survivalView(this.run);
  this.stage.inputBlocked=view.ready||view.status!=='active'||this.saveFailed;
  this.stage.setSeries({bestOf:1,roundNumber:this.run.wave,wins:[0,0]});
  this.stage.survivalHud(view.secondsLeft,survivalBossHud(view));this.stage.draw(this.displayPair(closestEnemy(this.run)),time,false);
  this.enemyViews.draw(this.run.enemies,time);
  const bossWave=view.waveMode==='boss';
  if(bossWave!==this.bossWaveMode){this.bossWaveMode=bossWave;this.waveText.setPosition(VIEW.cx+VIEW.width*.23,VIEW.top+(bossWave?16:23)).setFontSize(bossWave?11:17).setData('fitHeight',bossWave?18:22);}
  this.waveText.setText(t('survival.wave',{wave:view.wave})+(bossWave?' · '+t('survival.kills',{kills:view.waveKills}):''));
  this.killsText.setVisible(!bossWave).setText(t('survival.kills',{kills:view.waveKills}));
  [this.waveText,this.killsText].forEach(fitSurvivalText);
  if(this.saveFailed)this.showSaveError();
  else if(view.status==='intermission')this.showIntermission();
  else if(view.status==='ended')this.showDefeat();
 }
 private resetPanel():void {this.closePanel?.();this.closePanel=null;this.panel=null;this.acc=0;getNav(this).fightMode=true;this.stage.inputBlocked=false;setGameplay(true);}
 private showSaveError():void {
  if(this.panel==='save-error')return;
  this.closePanel?.();this.panel='save-error';getNav(this).fightMode=false;setGameplay(false);
  this.closePanel=survivalOverlay(this,t('survival.save_error'),[t('survival.save_error_detail')],[{label:t('survival.retry_save'),accent:'green',run:()=>{
   try{if(this.run.status==='intermission')this.store.checkpoint(this.run);else if(this.run.status==='ended')this.store.finish(this.run);else return;this.saveFailed=false;this.closePanel?.();this.closePanel=null;this.panel=null;}catch{/* Keep the visible failure state. */}
  }},{label:t('common.back'),back:true,run:()=>startScreen(this,'SurvivalEntry')}]);
 }
 private showIntermission():void {
  if(this.panel==='intermission')return;
  this.panel='intermission';getNav(this).fightMode=false;setGameplay(false);
  const view=survivalView(this.run),next=view.wave+1;
  this.closePanel=survivalRunPanel(this,this.run,this.store.best()?.clearedWave??0,'intermission',[{label:t('survival.continue'),accent:'green',run:()=>{try{this.store.advance(this.run);this.resetPanel();}catch{this.saveFailed=true;this.showSaveError();}}},
   {label:t('survival.save_exit'),back:true,run:()=>{try{if(this.store.saveAndExit(this.run))startScreen(this,'Menu');else {this.saveFailed=true;this.showSaveError();}}catch{this.saveFailed=true;this.showSaveError();}}}]);
 }
 private showDefeat():void {
  if(this.panel==='defeat')return;
  this.panel='defeat';getNav(this).fightMode=false;setGameplay(false);
  this.closePanel=survivalRunPanel(this,this.run,this.store.best()?.clearedWave??0,'results',[{label:t('survival.try_again'),accent:'green',run:()=>this.scene.restart({char:this.run.fighter,skin:this.run.skin})},
   {label:t('survival.choose_fighter'),accent:'purple',run:()=>startScreen(this,'CharSelect',{mode:'survival'})},
   {label:t('pause.return_to_main_menu_2'),back:true,run:()=>startScreen(this,'Menu')}]);
 }
}
