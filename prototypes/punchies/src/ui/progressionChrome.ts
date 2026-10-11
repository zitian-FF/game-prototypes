import type Phaser from 'phaser';
import {t} from '../i18n';
import {PIXEL_RATIO,VIEW} from '../render/pixelRatio';
import {artImage} from '../render/art';
import type {Reward,LevelUp} from '../progress/rules';
import {titleName} from '../progress/titles';
import {titleButton} from './titleButton';
import {getNav} from './menuNav';

export function profileText(scene:Phaser.Scene,x:number,y:number,value:string,size:number,width:number,color='#fff1d5',depth=132):Phaser.GameObjects.Text {
 const text=scene.add.text(x,y,value,{fontFamily:'Arial, sans-serif',fontStyle:'bold',fontSize:size,color,align:'center',wordWrap:{width},resolution:PIXEL_RATIO,padding:{left:3,right:3,top:2,bottom:2}}).setOrigin(.5).setDepth(depth);
 if(text.width>width)text.setScale(width/text.width);
 return text;
}
/** Noninteractive typography, shared by menu, profile and results. */
export function equippedTitle(scene:Phaser.Scene,x:number,y:number,id:string,width:number,depth=132):Phaser.GameObjects.Text {
 return profileText(scene,x,y,titleName(id),14,width,'#caa2ff',depth);
}
export function xpMeter(scene:Phaser.Scene,x:number,y:number,width:number,depth=132) {
 const g=scene.add.graphics().setDepth(depth);
 const draw=(fraction:number)=>{
  const f=Math.max(0,Math.min(1,fraction));g.clear();
  g.fillStyle(0x060e20).fillRoundedRect(x-width/2,y-8,width,16,7);
  g.lineStyle(1.5,0x7a9abc).strokeRoundedRect(x-width/2,y-8,width,16,7);
  if(f>0){const w=Math.max(3,(width-6)*f);g.fillStyle(0x32c7df).fillRoundedRect(x-width/2+3,y-5,w,10,4);g.fillStyle(0xa6f4ff,.65).fillRoundedRect(x-width/2+3,y-5,w,3,2);}
 };
 return {object:g,draw};
}
export function rewardName(reward:Reward):string {
 if(reward.kind==='title')return t('profile.reward_title',{title:titleName(reward.id)});
 if(reward.kind==='skin')return t('profile.reward_veteran');
 return reward.kind==='skinChest'?t('profile.reward_skin_chest'):t('profile.reward_fighter_chest');
}
export function rewardIcon(scene:Phaser.Scene,reward:Reward,x:number,y:number,w:number,depth:number):void {
 if(reward.kind==='skinChest'||reward.kind==='fighterChest')artImage(scene,reward.kind==='skinChest'?'chest_skin_base':'chest_fighter_base',x,y,w,w*.72,depth);
 else artImage(scene,'icon_jab',x,y,w*.52,w*.64,depth);
}
/** Short, dismissible summary of rewards already granted by logic. */
export function progressionRewards(scene:Phaser.Scene,levels:LevelUp[],rewards:Reward[]):void {
 const before=new Set(scene.children.list),depth=500;
 const shade=scene.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x030a19,.9).setDepth(depth).setInteractive();
 const w=Math.min(530,VIEW.width-32);
 profileText(scene,VIEW.cx,VIEW.top+42,t('profile.level_up',{level:levels[levels.length-1]?.level??1}),28,w,'#ffe38b',depth+2);
 profileText(scene,VIEW.cx,VIEW.top+80,t('profile.rewards_earned'),15,w,'#a2dfff',depth+2);
 // All granted rewards remain listed even if a rare award crosses multiple levels.
 const rows=rewards.length?rewards.map(rewardName):[t('profile.keep_going')];
 const body=profileText(scene,VIEW.cx,VIEW.cy,rows.join('\n'),20,w-32,'#fff1d5',depth+2);
 const maxH=VIEW.height-174;if(body.height>maxH)body.setScale(Math.min(body.scaleX,maxH/body.height));
 const close=()=>scene.children.list.filter(o=>!before.has(o)).forEach(o=>o.destroy());
 titleButton(scene,VIEW.cx,VIEW.bottom-40,210,38,t('menu.done'),close,false,depth+1,'green');
 getNav(scene).modalBack(shade,close);
}
