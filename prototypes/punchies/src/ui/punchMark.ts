import type Phaser from 'phaser';
import { artKey } from '../render/art';

/** One canonical star-free glove asset. No per-screen redraws or alternative emblems. */
export function punchMark(scene:Phaser.Scene,x:number,y:number,size:number):Phaser.GameObjects.Image|null{
  const key=artKey(scene,'punch_logo');
  if(!key)return null;
  const mark=scene.add.image(x,y,key);mark.setScale(size/Math.max(mark.width,mark.height));return mark;
}
