import Phaser from 'phaser';
import type { LangCode } from '../i18n/languages';

/** Canvas flags avoid Windows rendering flag emoji as two letters. */
export function languageFlag(scene: Phaser.Scene, code: LangCode, x: number, y: number, depth: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({x,y}).setDepth(depth);
  const rect = (color:number,a:number,b:number,w:number,h:number) => g.fillStyle(color).fillRect(a,b,w,h);
  rect(0xffffff,-12,-8,24,16);
  if(code==='en') {
    rect(0x244884,-12,-8,24,16);
    g.lineStyle(4,0xffffff).lineBetween(-12,-8,12,8).lineBetween(-12,8,12,-8);
    g.lineStyle(1.5,0xd52a39).lineBetween(-12,-8,12,8).lineBetween(-12,8,12,-8);
    rect(0xffffff,-3,-8,6,16);rect(0xffffff,-12,-3,24,6);
    rect(0xd52a39,-1.5,-8,3,16);rect(0xd52a39,-12,-1.5,24,3);
  } else if(code==='ja') g.fillStyle(0xc82d41).fillCircle(0,0,4.5);
  else if(code==='zh') {
    rect(0xde2936,-12,-8,24,16);
    const star=(cx:number,cy:number,r:number) => {
      const points=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.4:r;return {x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr};});
      g.fillStyle(0xffde00).fillPoints(points,true);
    };
    star(-6,-3,3);star(-1,-6,1);star(1,-3,1);star(1,0,1);star(-1,2,1);
  } else if(code==='es') {
    rect(0xaa151b,-12,-8,24,16);rect(0xf1bf00,-12,-4,24,8);
    rect(0xaa151b,-5,-2,3,4);rect(0xffffff,-4,-1,1,2);
  } else if(code==='ar') {
    rect(0x087c40,-12,-8,24,16);
    // Saudi Arabia: tiny calligraphic inscription and sword at icon scale.
    g.lineStyle(1,0xffffff);
    for(let i=-6;i<=6;i+=2)g.lineBetween(i,-3,i,-.5);
    g.lineBetween(-6,-.5,6,-.5).lineBetween(-7,4,7,4).lineBetween(6,3,7,4);
  } else {
    g.fillStyle(0xcd2e3a).fillCircle(0,0,4);
    g.fillStyle(0x0047a0).slice(0,0,4,0,Math.PI,false).fillPath();
    g.fillStyle(0xcd2e3a).fillCircle(-2,0,2);g.fillStyle(0x0047a0).fillCircle(2,0,2);
    g.lineStyle(1,0x171717);
    for(const side of [-1,1])for(const row of [-1,1])for(let i=0;i<3;i++){
      const cx=side*8,cy=row*5+i-1;g.lineBetween(cx-1.5,cy-1,cx+1.5,cy+1);
    }
  }
  g.lineStyle(1,0x17283f,.55).strokeRect(-12,-8,24,16);
  return g;
}
