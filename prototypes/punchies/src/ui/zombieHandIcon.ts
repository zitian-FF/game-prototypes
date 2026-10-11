import type Phaser from 'phaser';

/** Bounded hand silhouette, consistent navy outline and two-tone green cel shading. */
export function zombieHandIcon(scene:Phaser.Scene,x:number,y:number,size:number,depth:number){
  const g=scene.add.graphics().setPosition(x-size/2,y-size/2).setScale(size/32).setDepth(depth);
  const hand=[{x:9,y:30},{x:8,y:23},{x:3,y:17},{x:3,y:13},{x:6,y:12},{x:10,y:16},{x:9,y:6},{x:11,y:3},{x:14,y:4},{x:15,y:13},{x:16,y:2},{x:19,y:1},{x:21,y:3},{x:21,y:13},{x:24,y:5},{x:27,y:5},{x:28,y:8},{x:26,y:16},{x:30,y:12},{x:32,y:14},{x:30,y:22},{x:24,y:26},{x:23,y:30}];
  g.fillStyle(0x9dcf68).fillPoints(hand,true).lineStyle(2,0x10213a).strokePoints(hand,true);
  g.fillStyle(0x588741).fillPoints([{x:10,y:23},{x:16,y:25},{x:24,y:23},{x:23,y:30},{x:9,y:30}],true);
  g.lineStyle(1.4,0xd2f2a0).lineBetween(17,5,18,15).lineBetween(11,17,14,21);
  return g;
}
