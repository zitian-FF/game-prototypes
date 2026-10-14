import type Phaser from 'phaser';
import {t} from '../i18n';
import {discordFeedbackAvailable,openDiscordFeedback} from '../portal/community';
import {titleButton} from './titleButton';

export function discordFeedbackButton(scene:Phaser.Scene,x:number,y:number,width:number):void {
  if(!discordFeedbackAvailable())return;
  const label=titleButton(scene,x,y,width,28,t('menu.feedback_discord'),openDiscordFeedback,false,130,'blue');
  label.setX(x+10).setScale(Math.min(1,(width-44)/Math.max(1,label.width)));
  const icon=scene.add.graphics().setDepth(131),ix=x-width/2+19;
  // Small controller/face silhouette: code-native, no extra bitmap or font glyph.
  const points=[[-6,-8],[-3,-7],[-2,-5],[2,-5],[3,-7],[6,-8],[9,-4],[11,4],[6,8],[3,6],[4,4],[-4,4],[-3,6],[-6,8],[-11,4],[-9,-4]]
    .map(([px,py])=>({x:ix+px*.75,y:y+py*.75}));
  icon.fillStyle(0xfff7e6).fillPoints(points,true);
  icon.fillStyle(0x5372d7).fillCircle(ix-3,y,1.7).fillCircle(ix+3,y,1.7);
  const hit=label.getData('bg') as Phaser.GameObjects.Rectangle;
  hit.on('pointerdown',()=>icon.setY(2)).on('pointerup',()=>icon.setY(0)).on('pointerout',()=>icon.setY(0));
  hit.once('destroy',()=>icon.destroy());
}
