import Phaser from 'phaser';
import {t} from '../i18n';
import {applyCameraPixelRatio,VIEW} from '../render/pixelRatio';
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
  const store=new SurvivalStore(portalStore),w=Math.min(660,VIEW.width-48);
  survivalText(this,VIEW.cx,VIEW.top+42,t('survival.heading'),28,w);
  survivalText(this,VIEW.cx,VIEW.top+101,t('survival.instructions'),17,w,'#bed2ed',132,48);
  survivalText(this,VIEW.cx,VIEW.top+146,t('survival.boss_every',{n:config.bossEveryWaves}),15,w,'#ffe38b',132,27);
  survivalText(this,VIEW.cx,VIEW.top+180,t('survival.best',{wave:store.best()?.clearedWave??0}),17,w,'#8edfff',132,28);
  let resume:ResumeResult;
  try{resume=store.loadResume();}catch{survivalOverlay(this,t('survival.save_error'),[t('survival.save_error_detail')],[{label:t('common.back'),run:()=>startScreen(this,'Menu'),back:true}]);return;}
  const newRun=()=>{
   if(resume.kind==='ready'||resume.kind==='incompatible'){
    let close=()=>{};close=survivalOverlay(this,t('survival.new_run'),[t('survival.replace_checkpoint')],[{label:t('common.cancel'),run:()=>close(),back:true},{label:t('survival.choose_fighter'),run:()=>startScreen(this,'CharSelect',{mode:'survival'}),accent:'green'}]);
   }else startScreen(this,'CharSelect',{mode:'survival'});
  };
  if(resume.kind==='ready')titleButton(this,VIEW.cx,VIEW.bottom-145,290,42,t('survival.resume',{wave:resume.run.wave+1}),()=>startScreen(this,'Survival',{run:resume.run,resume:true}),true);
  else if(resume.kind!=='none')survivalText(this,VIEW.cx,VIEW.bottom-142,({abandoned:t('survival.resume_abandoned'),corrupt:t('survival.resume_corrupt'),incompatible:t('survival.resume_incompatible')})[resume.kind],14,w,resume.kind==='incompatible'?'#ff9eaa':'#bed2ed',132,34);
  titleButton(this,VIEW.cx,VIEW.bottom-95,290,42,t('survival.new_run'),newRun,false,130,'green');
  const back=titleButton(this,VIEW.cx,VIEW.bottom-45,190,38,t('common.back'),()=>startScreen(this,'Menu'),false,130,'default','back');
  getNav(this).modalBack(back.getData('bg'),()=>startScreen(this,'Menu'));
 }
}
