import Phaser from 'phaser';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { navRegister } from './menuNav';
import { artImage } from '../render/art';
import { cartoonButton } from './cartoonChrome';

export function titleButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  label: string, onTap: () => void, primary = false, depth = 130, accent: 'default' | 'green' | 'red' | 'purple' | 'teal' | 'blue' = 'default', role: 'back' | 'confirm' = 'confirm'): Phaser.GameObjects.Text {
  const g = scene.add.graphics().setDepth(depth);
  const draw = (hover = false) => {
    g.clear();
    const color=accent==='red'?0xde4565:accent==='green'?0x29b765:primary?0x168bf5:accent==='purple'?0x9460d2:accent==='teal'?0x149eab:accent==='blue'?0x5372d7:0x47739d;
    cartoonButton(g,x-w/2,y-h/2,w,h,color,9);
    if(hover)g.fillStyle(0xffffff,.1).fillRoundedRect(x-w/2,y-h/2,w,h,9);
  };
  draw();
  // Retain Rectangle hit targets for existing keyboard/controller navigation.
  const hit = scene.add.rectangle(x,y,w,h,0,0).setDepth(depth).setInteractive({useHandCursor:true});
  hit.on('pointerover',()=>draw(true)).on('pointerout',()=>draw()).on('pointerdown',onTap);
  hit.on('destroy',()=>g.destroy());
  navRegister(scene,hit,onTap,role);
  if (primary) {
    artImage(scene,'icon_jab',x-w/2+29,y-1,27,34,depth+1);
    artImage(scene,'icon_cross',x-w/2+45,y+1,27,34,depth+1);
  }
  const text = scene.add.text(x+(primary?18:0),y,label,{fontFamily:'Arial, sans-serif',fontSize:`${primary?20:h<30?12:15}px`,
    fontStyle:'bold',color:'#fff7e6',shadow:{offsetX:0,offsetY:2,color:'#23415a',blur:1,fill:true},resolution:PIXEL_RATIO})
    .setOrigin(0.5).setDepth(depth+1);
  text.setData('bg',hit);
  return text;
}
