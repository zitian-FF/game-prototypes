import Phaser from 'phaser';
import { artImage, artKey } from './art';
import { RingPerspective } from './perspective';

// Identical full-canvas registration across all five PNGs. The floor
// anchor describes playable canvas edges, not the transparent image bounds.
const SOURCE = { width: 1299, height: 1211, left: 186, top: 163, right: 1114, bottom: 875 };
const KEYS = ['arena_floor', 'arena_rear', 'arena_front', 'arena_near', 'arena_apron'];

export class ArenaArt {
  private images: Phaser.GameObjects.Image[];
  static create(scene: Phaser.Scene): ArenaArt | null {
    return KEYS.every(k=>artKey(scene,k)) ? new ArenaArt(scene) : null;
  }
  private constructor(private scene: Phaser.Scene) {
    this.images=KEYS.map((key,i)=>artImage(scene,key,0,0,SOURCE.width,SOURCE.height,[0,1,30,31,32][i])!);
  }
  // Title uses the same assembled ring without sim-dependent bounds.
  display(x: number,y: number,w: number,h: number): void {
    for(const image of this.images)image.setPosition(x,y).setDisplaySize(w,h);
  }
  displayTitle(x:number,y:number,w:number,h:number): void {
    this.display(x,y,w,h);
    const perspective=new RingPerspective(this.scene);
    perspective.take(this.images);
    perspective.projectAuthored(y-h/2+h*110/SOURCE.height,y-h/2+h*875/SOURCE.height);
    perspective.world?.sort('depth');
  }
  fitFloor(left:number,top:number,right:number,bottom:number): {left:number;top:number;width:number;height:number;aspect:number} {
    const sx=(right-left)/(SOURCE.right-SOURCE.left);
    const sy=(bottom-top)/(SOURCE.bottom-SOURCE.top);
    this.display(left+(SOURCE.width/2-SOURCE.left)*sx,top+(SOURCE.height/2-SOURCE.top)*sy,SOURCE.width*sx,SOURCE.height*sy);
    // Keep the exact title artwork, including post bases, apron and steps.
    // The world presentation restores its native aspect and fits the entire
    // assembly; simulation bounds remain unchanged.
    return {left:left-SOURCE.left*sx,top:top-SOURCE.top*sy,
      width:SOURCE.width*sx,height:SOURCE.height*sy,aspect:sy/sx};
  }
}
