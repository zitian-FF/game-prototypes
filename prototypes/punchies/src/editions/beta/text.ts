import type Phaser from 'phaser';
import {PIXEL_RATIO} from '../../render/pixelRatio';
/** Passive typography; no economy/progression imports in the Beta profile. */
export function profileText(scene:Phaser.Scene,x:number,y:number,value:string,size:number,width:number,color='#fff1d5',depth=132):Phaser.GameObjects.Text {
 const text=scene.add.text(x,y,value,{fontFamily:'Arial, sans-serif',fontStyle:'bold',fontSize:size,color,align:'center',wordWrap:{width},resolution:PIXEL_RATIO,padding:{left:3,right:3,top:2,bottom:2}}).setOrigin(.5).setDepth(depth);
 if(text.width>width)text.setScale(width/text.width);return text;
}
