import Phaser from 'phaser';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { navRegister } from './menuNav';
import { artImage } from '../render/art';

export function titleButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  label: string, onTap: () => void, primary = false, depth = 130): Phaser.GameObjects.Text {
  const g = scene.add.graphics().setDepth(depth);
  const draw = (hover = false) => {
    g.clear();
    g.fillStyle(0x070f21, 0.8).fillRoundedRect(x-w/2-3, y-h/2+4, w+6, h+2, 13);
    g.fillStyle(0x0b142b).fillRoundedRect(x-w/2-3, y-h/2-3, w+6, h+6, 13);
    g.fillStyle(primary ? (hover ? 0x218dff : 0x0870ec) : (hover ? 0x263f61 : 0x15263f), 0.98)
      .fillRoundedRect(x-w/2, y-h/2, w, h, 11);
    g.lineStyle(primary ? 2.5 : 1.5, primary ? 0x64d9ff : 0x8ba4c7, 0.95)
      .strokeRoundedRect(x-w/2, y-h/2, w, h, 11);
    g.lineStyle(1, 0xe5f3ff, primary ? 0.55 : 0.22).beginPath()
      .moveTo(x-w/2+13,y-h/2+4).lineTo(x+w/2-13,y-h/2+4).strokePath();
  };
  draw();
  // Retain Rectangle hit targets for existing keyboard/controller navigation.
  const hit = scene.add.rectangle(x,y,w,h,0,0).setDepth(depth).setInteractive({useHandCursor:true});
  hit.on('pointerover',()=>draw(true)).on('pointerout',()=>draw()).on('pointerdown',onTap);
  hit.on('destroy',()=>g.destroy());
  navRegister(scene,hit,onTap);
  if (primary) {
    artImage(scene,'icon_jab',x-w/2+29,y-1,27,34,depth+1);
    artImage(scene,'icon_cross',x-w/2+45,y+1,27,34,depth+1);
  }
  const text = scene.add.text(x+(primary?18:0),y,label,{fontFamily:'Arial, sans-serif',fontSize:`${primary?20:h<30?12:15}px`,
    fontStyle:'bold',color:'#fff7e6',stroke:'#0b1731',strokeThickness:primary?3:2,resolution:PIXEL_RATIO})
    .setOrigin(0.5).setDepth(depth+1);
  text.setData('bg',hit);
  return text;
}
