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
  const width=Math.min(720,VIEW.width-24),column=(width-54)/2,offset=(width-30)/4;
  items.push(scene.add.graphics().setDepth(depth+1).fillStyle(0x17334a).fillRoundedRect(VIEW.cx-width/2,VIEW.cy-183,width,366,18));
  // Descriptions are passive typography. Only the two selectors and Back have hit areas.
  const text=(x:number,y:number,value:string,size=16,maxWidth=column,maxHeight=48,color='#fff4df')=>{
    const label=scene.add.text(x,y,value,{fontFamily:'Arial',fontSize:size,fontStyle:'bold',color,align:'center',wordWrap:{width:maxWidth,useAdvancedWrap:true},padding:{left:2,right:2,top:1,bottom:1},resolution:PIXEL_RATIO}).setOrigin(.5).setDepth(depth+2);
    label.setScale(Math.min(1,maxWidth/Math.max(1,label.width),maxHeight/Math.max(1,label.height)));items.push(label);return label;
  };
  text(VIEW.cx,VIEW.cy-151,t('controls.mode'),23,width-40,32);
  const modes=loadControlModes();
  for(const side of [0,1] as const){const x=VIEW.cx+(side===0?-offset:offset);
    text(x-column/2+18,VIEW.cy-108,`P${side+1}`,16,38,30);
    switches.push(controlModeSelector(scene,x+23,VIEW.cy-108,column-50,modes[side],mode=>saveControlMode(side,mode),depth+2));
  }
  for(const [i,mode] of (['modern','classic'] as const).entries()){
    const x=VIEW.cx+(i===0?-offset:offset);
    text(x,VIEW.cy-61,t('controls.'+mode),18,column,28,i===0?'#80e7f4':'#ffd68b');
    text(x,VIEW.cy-18,'+ '+t('controls.'+mode+'_pros'),14,column,54,'#a8efbd');
    text(x,VIEW.cy+41,'− '+t('controls.'+mode+'_cons'),14,column,60,'#ffc2aa');
  }
  text(VIEW.cx,VIEW.cy+99,t('controls.modern_note'),12,width-44,46,'#c4d9ee');
  text(VIEW.cx,VIEW.cy+134,t('controls.next_match'),12,width-44,20,'#a8bcd3');
  let closed=false;const close=()=>{if(closed)return;closed=true;switches.forEach(s=>s.destroy());items.forEach(i=>i.destroy());back();};
  const button=titleButton(scene,VIEW.cx,VIEW.cy+161,140,30,t('common.back'),close,false,depth+2,'default','back');items.push(button,button.getData('bg'));
  getNav(scene).modalBack(anchor,close);
}
