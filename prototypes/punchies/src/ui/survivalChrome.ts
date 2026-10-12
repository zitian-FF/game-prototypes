import Phaser from 'phaser';
import {PIXEL_RATIO,VIEW} from '../render/pixelRatio';
import {titleButton} from './titleButton';
import {t} from '../i18n';
import {waistPortrait} from './profileAvatar';
import type {SurvivalRun} from '../survival/types';
import {getNav} from './menuNav';
export function survivalText(scene:Phaser.Scene,x:number,y:number,label:string,size:number,width:number,color='#fff1d1',depth=132,maxHeight=size*3):Phaser.GameObjects.Text {
 const o=scene.add.text(x,y,label,{fontFamily:'Arial',fontSize:size,fontStyle:'bold',color,align:'center',wordWrap:{width},padding:{left:6,right:6,top:4,bottom:4},resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(depth);
 o.setData('fitWidth',width).setData('fitHeight',maxHeight);fitSurvivalText(o);return o;
}
export function fitSurvivalText(o:Phaser.GameObjects.Text):void {o.setScale(1);o.setScale(Math.min(1,o.getData('fitWidth')/Math.max(1,o.width),o.getData('fitHeight')/Math.max(1,o.height)));}
export function survivalOverlay(scene:Phaser.Scene,heading:string,lines:string[],actions:{label:string;run:()=>void;accent?:'green'|'red'|'purple'|'default';back?:boolean}[],onClose?:()=>void):()=>void {
 const before=new Set(scene.children.list),depth=400,w=Math.min(610,VIEW.width-44);
 const shade=scene.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x050d20,.88).setDepth(depth).setInteractive();
 survivalText(scene,VIEW.cx,VIEW.top+62,heading,28,w,'#fff1d1',depth+2,66);
 const body=lines.flatMap(line=>line.split('\n')),bodyTop=VIEW.top+104;
 const buttonTop=VIEW.bottom-45-(actions.length-1)*51-24;
 const gap=Math.max(1,Math.min(33,(buttonTop-bodyTop)/Math.max(1,body.length)));
 body.forEach((line,i)=>survivalText(scene,VIEW.cx,bodyTop+gap*(i+.5),line,17,w,i===0?'#8edfff':'#bed2ed',depth+2,Math.max(1,gap-2)));
 actions.forEach((a,i)=>titleButton(scene,VIEW.cx,VIEW.bottom-45-(actions.length-1-i)*51,Math.min(290,w),42,a.label,a.run,false,depth+1,a.accent??'default',a.back?'back':'confirm'));
 const close=()=>{scene.children.list.filter(o=>!before.has(o)).forEach(o=>o.destroy());onClose?.();};
 const back=actions.find(a=>a.back);if(back)getNav(scene).modalBack(shade,back.run);
 return close;
}

export function survivalRunPanel(scene:Phaser.Scene,run:SurvivalRun,best:number,kind:'intermission'|'results',actions:{label:string;run:()=>void;accent?:'green'|'red'|'purple'|'default';back?:boolean}[]):()=>void {
 const before=new Set(scene.children.list),d=400,results=kind==='results',w=Math.min(744,VIEW.width-48),cx=results?VIEW.cx+w*.22:VIEW.cx,rw=results?w*.54:w*.84;
 const shade=scene.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x050d20,.87).setDepth(d).setInteractive();
 if(results)waistPortrait(scene,{fighter:run.fighter,skin:run.skin},VIEW.cx-w*.28,VIEW.bottom,w*.44,VIEW.height*.84,d+1);
 else scene.add.graphics().setDepth(d+1).fillStyle(0x14283e,.92).fillRoundedRect(cx-rw/2,VIEW.top+58,rw,VIEW.height-82,14);
 survivalText(scene,cx,VIEW.top+42,t(results?'survival.run_ended':'survival.wave_clear',{wave:run.wave}),28,rw,'#fff1d1',d+4,45);
 survivalText(scene,cx,VIEW.top+88,t(results?'survival.highest':'survival.wave_summary',results?{wave:run.clearedWave}:{kills:run.waveKills,healing:Number(run.healing.toFixed(1))}),18,rw-20,'#8edfff',d+4,37);
 survivalText(scene,cx,VIEW.top+124,results?t('survival.best',{wave:best}):t(run.bossChar?'survival.boss_defeated':'survival.next_wave',{wave:run.wave+1}),14,rw-20,'#ffe38b',d+4,30);
 survivalText(scene,cx,VIEW.top+163,t('survival.counter_partition',{total:run.totalKills,zombies:run.totalZombieKills,bosses:run.totalKills-run.totalZombieKills}),15,rw-26,'#bed2ed',d+4,40);
 survivalText(scene,cx,VIEW.top+207,t('survival.damage_summary',{dealt:Number(run.damageDealt.toFixed(1)),received:Number(run.damageReceived.toFixed(1))}),15,rw-26,'#bed2ed',d+4,40);
 if(results)survivalText(scene,cx,VIEW.top+242,t('survival.no_xp'),11,rw-20,'#839bb9',d+4,24);
 else if(run.bossChar)survivalText(scene,cx,VIEW.top+242,t('survival.next_wave',{wave:run.wave+1}),14,rw-20,'#ffe38b',d+4,24);
 const buttonWidth=results?Math.min(230,(w-24)/3):Math.min(240,(rw-16)/2);
 actions.forEach((a,i)=>titleButton(scene,results?VIEW.cx+(i-(actions.length-1)/2)*(buttonWidth+10):cx+(i-(actions.length-1)/2)*(buttonWidth+10),VIEW.bottom-32,buttonWidth,38,a.label,a.run,false,d+2,a.accent??'default',a.back?'back':'confirm'));
 const close=()=>scene.children.list.filter(o=>!before.has(o)).forEach(o=>o.destroy());
 const back=actions.find(a=>a.back);if(back)getNav(scene).modalBack(shade,back.run);
 return close;
}
