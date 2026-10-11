import Phaser from 'phaser';
import {PIXEL_RATIO,VIEW} from '../render/pixelRatio';
import {titleButton} from './titleButton';
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
 lines.forEach((line,i)=>survivalText(scene,VIEW.cx,VIEW.top+119+i*33,line,17,w,i===0?'#8edfff':'#bed2ed',depth+2,30));
 actions.forEach((a,i)=>titleButton(scene,VIEW.cx,VIEW.bottom-45-(actions.length-1-i)*51,Math.min(290,w),42,a.label,a.run,false,depth+1,a.accent??'default',a.back?'back':'confirm'));
 const close=()=>{scene.children.list.filter(o=>!before.has(o)).forEach(o=>o.destroy());onClose?.();};
 const back=actions.find(a=>a.back);if(back)getNav(scene).modalBack(shade,back.run);
 return close;
}
