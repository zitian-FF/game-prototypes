import Phaser from 'phaser';
import {t} from '../i18n';
import {applyCameraPixelRatio,VIEW} from '../render/pixelRatio';
import {charName} from '../sim/character';
import {avatarImage} from '../ui/profileAvatar';
import {whenGroupsReady} from '../render/art';
import {backdrop} from '../render/art';
import {store as portalStore} from '../portal/store';
import {SurvivalStore,type ResumeResult} from '../survival/save';
import config from '../survival/config.json';
import {survivalText,survivalOverlay} from '../ui/survivalChrome';
import {getNav} from '../ui/menuNav';
import {titleButton} from '../ui/titleButton';
import {startScreen} from '../ui/presentation';
export class SurvivalEntryScene extends Phaser.Scene {
 constructor(){super('SurvivalEntry');}
 create():void {
  applyCameraPixelRatio(this);backdrop(this,0,'gym_background');this.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071126,.86).setDepth(120);
  const store=new SurvivalStore(portalStore),w=Math.min(760,VIEW.width-48),left=VIEW.cx-w/2,gap=18,lw=w*.49,rw=w-lw-gap,rx=left+lw+gap,top=VIEW.top+82,h=VIEW.height-115;
  survivalText(this,VIEW.cx,VIEW.top+36,t('survival.heading'),28,w);
  this.add.graphics().setDepth(130).fillStyle(0x15283e,.9).fillRoundedRect(left,top,lw,h,14).fillRoundedRect(rx,top,rw,h,14);
  survivalText(this,left+lw/2,top+30,t('survival.survive'),20,lw-28,'#ffe38b');
  survivalText(this,left+lw/2,top+86,t('survival.instructions'),17,lw-36,'#bed2ed',132,76);
  survivalText(this,left+lw/2,top+148,t('survival.boss_every',{n:config.bossEveryWaves}),15,lw-32,'#ffe38b',132,42);
  survivalText(this,left+lw/2,top+h-32,t('survival.best',{wave:store.best()?.clearedWave??0}),16,lw-26,'#8edfff',132,36);
  let resume:ResumeResult;
  try{resume=store.loadResume();}catch{survivalOverlay(this,t('survival.save_error'),[t('survival.save_error_detail')],[{label:t('common.back'),run:()=>startScreen(this,'Menu'),back:true}]);return;}
  survivalText(this,rx+rw/2,top+25,t('survival.checkpoint'),17,rw-24,'#8edfff');
  if(resume.kind==='ready'){
   const run=resume.run;avatarImage(this,{fighter:run.fighter,skin:run.skin},rx+rw/2,top+81,106,67,132);
   if(!this.textures.exists('punchies:portrait_'+run.fighter))whenGroupsReady(this,[run.fighter],()=>{if(this.scene.isActive())avatarImage(this,{fighter:run.fighter,skin:run.skin},rx+rw/2,top+81,106,67,132);});
   survivalText(this,rx+rw/2,top+126,charName(run.fighter),16,rw-24);
   survivalText(this,rx+rw/2,top+155,t('survival.checkpoint_summary',{waves:run.clearedWave,kills:run.totalKills}),13,rw-24,'#bed2ed',132,34);
  }else survivalText(this,rx+rw/2,top+100,resume.kind==='none'?t('survival.no_checkpoint'):({abandoned:t('survival.resume_abandoned'),corrupt:t('survival.resume_corrupt'),incompatible:t('survival.resume_incompatible')})[resume.kind],15,rw-30,'#bed2ed',132,100);
  const newRun=()=>{
   if(resume.kind==='ready'||resume.kind==='incompatible'){
    let close=()=>{};close=survivalOverlay(this,t('survival.new_run'),[t('survival.replace_checkpoint')],[{label:t('common.cancel'),run:()=>close(),back:true},{label:t('survival.choose_fighter'),run:()=>startScreen(this,'CharSelect',{mode:'survival'}),accent:'green'}]);
   }else startScreen(this,'CharSelect',{mode:'survival'});
  };
  if(resume.kind==='ready')titleButton(this,rx+rw/2,top+h-76,rw-32,40,t('survival.resume',{wave:resume.run.wave+1}),()=>startScreen(this,'Survival',{run:resume.run,resume:true}),false,130,'green');
  titleButton(this,rx+rw/2,top+h-28,rw-32,40,t('survival.new_run'),newRun,false,130,resume.kind==='ready'?'default':'green');
  const back=titleButton(this,VIEW.left+70,VIEW.top+30,112,38,t('common.back'),()=>startScreen(this,'Menu'),false,130,'default','back');
  getNav(this).modalBack(back.getData('bg'),()=>startScreen(this,'Menu'));
 }
}
