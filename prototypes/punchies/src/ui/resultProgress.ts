import type Phaser from 'phaser';
import {t} from '../i18n';
import {VIEW} from '../render/pixelRatio';
import type {MatchAward,Reward} from '../progress/rules';
import {tune} from '../sim/tune';
import {awardViews,xpFraction} from './progressionModel';
import {profileText,xpMeter,progressionRewards} from './progressionChrome';
import {titleButton} from './titleButton';
import {reducedMotion} from './presentation';

/** Consumes presentation data only; XP was awarded exactly once by the match scene. */
export function resultProgress(scene:Phaser.Scene,x:number,width:number,positionY=VIEW.bottom-175):void {
 const award=scene.registry.get('lastAward') as (MatchAward&{grantedRewards:Reward[]})|undefined;
 scene.registry.remove('lastAward');
 if(!award)return;
 const {before,after}=awardViews(award),y=positionY;
 const hasRewards=award.levelUps.length>0;
 const meterWidth=Math.min(width-24,hasRewards?width-106:width-24),center=x-(hasRewards?42:0);
 const label=profileText(scene,center,y-19,t('profile.result_xp',{xp:award.xpGained,level:before.level}),14,meterWidth,'#a0eaff',150);
 const meter=xpMeter(scene,center,y,meterWidth,150);meter.draw(xpFraction(before));
 if(hasRewards)titleButton(scene,x+width/2-46,y-1,84,32,t('profile.rewards'),()=>progressionRewards(scene,award.levelUps,award.grantedRewards??[]),false,150,'purple');
 const note=profileText(scene,x,y+20,after.maxed?t('profile.max'):award.capped?t('profile.daily_cap'):hasRewards?t('profile.level_up',{level:after.level}):t('profile.xp',{xp:after.xp,total:after.xpToNext}),13,width,award.capped?'#ff9eaa':'#d5e7fa',150);
 if(note.height>18)note.setScale(Math.min(note.scaleX,18/note.height));
 // Use existing approved result timings, with no gameplay delays or new rules.
 const duration=reducedMotion()?0:tune.view.fightPresentation.resultEnterMs;
 const segments=hasRewards?[1,xpFraction(after)]:[xpFraction(after)];
 let fraction=xpFraction(before),index=0;
 const next=()=>{
  if(!scene.scene.isActive())return;
  const state={fill:index===0?fraction:0},target=segments[index];
  scene.tweens.add({targets:state,fill:target,duration,ease:'Sine.Out',onUpdate:()=>meter.draw(state.fill),onComplete:()=>{
   index++;fraction=target;if(index<segments.length)next();else{label.setText(t('profile.result_xp',{xp:award.xpGained,level:after.level}));note.setAlpha(1);}
  }});
 };
 if(reducedMotion()){meter.draw(xpFraction(after));label.setText(t('profile.result_xp',{xp:award.xpGained,level:after.level}));}
 else scene.time.delayedCall(tune.view.fightPresentation.portraitSlideMs+duration,next);
}
