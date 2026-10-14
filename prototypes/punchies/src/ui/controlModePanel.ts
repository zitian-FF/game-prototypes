import type Phaser from 'phaser';
import {VIEW,PIXEL_RATIO} from '../render/pixelRatio';
import {t} from '../i18n';
import {loadControlModes,saveControlMode} from '../input/controlPreferences';
import {controlModeSelector} from './controlModeSelector';
import {getNav} from './menuNav';
import {titleButton} from './titleButton';

export function controlModePanel(scene:Phaser.Scene,back:()=>void):void {
  const depth=410,items:Phaser.GameObjects.GameObject[]=[],switches:ReturnType<typeof controlModeSelector>[]=[];
  const anchor=scene.add.rectangle(VIEW.cx,VIEW.cy,VIEW.width,VIEW.height,0x071020,.9).setDepth(depth).setInteractive();items.push(anchor);
  items.push(scene.add.graphics().setDepth(depth+1).fillStyle(0x17334a).fillRoundedRect(VIEW.cx-210,VIEW.cy-145,420,290,18));
  const text=(x:number,y:number,value:string,size=16)=>{const label=scene.add.text(x,y,value,{fontFamily:'Arial',fontSize:`${size}px`,fontStyle:'bold',color:'#fff4df',resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(depth+2);items.push(label);return label;};
  text(VIEW.cx,VIEW.cy-108,t('controls.mode'),23);
  const modes=loadControlModes();
  for(const side of [0,1] as const){const y=VIEW.cy-43+side*66;
    text(VIEW.cx-132,y,`P${side+1}`,16);
    switches.push(controlModeSelector(scene,VIEW.cx+34,y,250,modes[side],mode=>saveControlMode(side,mode),depth+2));
  }
  const notice=text(VIEW.cx,VIEW.cy+73,t('controls.next_match'),12);notice.setScale(Math.min(1,370/Math.max(1,notice.width)));
  let closed=false;const close=()=>{if(closed)return;closed=true;switches.forEach(s=>s.destroy());items.forEach(i=>i.destroy());back();};
  const button=titleButton(scene,VIEW.cx,VIEW.cy+115,140,30,t('common.back'),close,false,depth+2,'default','back');items.push(button,button.getData('bg'));
  getNav(scene).modalBack(anchor,close);
}
