import Phaser from 'phaser';
import { artImage, artKey } from './art';

// Identical full-canvas registration across all five PNGs. The floor
// anchor describes playable canvas edges, not the transparent image bounds.
const SOURCE = { width: 1299, height: 1211, left: 186, top: 163, right: 1114, bottom: 875 };
const KEYS = ['arena_floor', 'arena_rear', 'arena_front', 'arena_near', 'arena_apron'];

export class ArenaArt {
  private images: Phaser.GameObjects.Image[];
  private gameRopes: Phaser.GameObjects.Image[] = [];
  private gameCaps: Phaser.GameObjects.Image[] = [];
  static create(scene: Phaser.Scene): ArenaArt | null {
    return [...KEYS,'arena_rope','arena_cap_neutral'].every(k=>artKey(scene,k)) ? new ArenaArt(scene) : null;
  }
  private constructor(private scene: Phaser.Scene) {
    this.images=KEYS.map((key,i)=>artImage(scene,key,0,0,SOURCE.width,SOURCE.height,[0,1,30,31,32][i])!);
  }
  // Title uses the same assembled ring without sim-dependent bounds.
  display(x: number,y: number,w: number,h: number): void {
    for(const image of this.images)image.setPosition(x,y).setDisplaySize(w,h);
  }
  fitFloor(left:number,top:number,right:number,bottom:number,c0:number,c1:number): void {
    const sx=(right-left)/(SOURCE.right-SOURCE.left);
    const sy=(bottom-top)/(SOURCE.bottom-SOURCE.top);
    this.display(left+(SOURCE.width/2-SOURCE.left)*sx,top+(SOURCE.height/2-SOURCE.top)*sy,SOURCE.width*sx,SOURCE.height*sy);
    // Gameplay uses native rope/cap crops from the same ring master. Its
    // fixed floor reaches the camera edge, so tall title-screen post bases
    // would clip. Reassemble the overhead hardware with round corner pads.
    this.images.slice(1).forEach(o=>o.setVisible(false));
    if (!this.gameRopes.length) {
      this.gameRopes=[1,30,30,30].map(d=>artImage(this.scene,'arena_rope',0,0,1,1,d)!);
      this.gameCaps=[0,1,2,3].map(i=>artImage(this.scene,'arena_cap_neutral',0,0,32,32,i<2?2:31)!);
      // ArenaArt's parts are created after FightStage gathers its world.
      const parent=this.images[0].parentContainer;
      if(parent)parent.add([...this.gameRopes,...this.gameCaps]);
    }
    const cx=(left+right)/2,cy=(top+bottom)/2,w=right-left,h=bottom-top;
    this.gameRopes[0].setPosition(cx,top-4).setDisplaySize(w+10,18);
    this.gameRopes[1].setPosition(cx,bottom-4).setDisplaySize(w+10,18);
    this.gameRopes[2].setPosition(left-4,cy).setDisplaySize(h+2,18).setRotation(Math.PI/2);
    this.gameRopes[3].setPosition(right+4,cy).setDisplaySize(h+2,18).setRotation(Math.PI/2);
    [[left-4,top-4],[right+4,top-4],[left-4,bottom-4],[right+4,bottom-4]]
      .forEach(([x,y],i)=>this.gameCaps[i].setPosition(x,y).setTint([c0,0xffffff,0xffffff,c1][i]));
  }
}
