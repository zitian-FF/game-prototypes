import type Phaser from 'phaser';

export function shadeUi(color:number,factor:number):number{
  const channel=(shift:number)=>Math.min(255,Math.round(((color>>shift)&255)*factor));
  return (channel(16)<<16)|(channel(8)<<8)|channel(0);
}
/** Chunky painted enamel: dark silhouette, recessed lower edge, bright bevel and quiet grain. */
export function cartoonPanel(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number,r=10):void{
  g.fillStyle(0x050d20,.8).fillRoundedRect(x-2,y+4,w+4,h+3,r+2);
  g.fillStyle(0x050d20).fillRoundedRect(x-3,y-3,w+6,h+6,r+3);
  g.fillStyle(shadeUi(color,.65)).fillRoundedRect(x,y,w,h,r);
  g.fillStyle(color).fillRoundedRect(x+1,y+1,w-2,h-7,Math.max(3,r-1));
  g.fillStyle(0xffffff,.15).fillRoundedRect(x+5,y+4,w-10,Math.max(3,h*.18),Math.max(2,r-4));
  g.lineStyle(1,0xffffff,.09);
  for(let px=x+16;px<x+w-12;px+=31)g.lineBetween(px,y+h*.4,px+8,y+h*.35);
  g.lineStyle(2,shadeUi(color,1.4),.85).strokeRoundedRect(x+1,y+1,w-2,h-2,r);
  g.lineStyle(2,0x050d20).strokeRoundedRect(x-3,y-3,w+6,h+6,r+3);
}

/** Soft enamel buttons with one quiet edge and a shaded lower lip. */
export function cartoonButton(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number,r=10):void{
 r=Math.min(r,h/2);
 g.fillStyle(0x050d20,.28).fillRoundedRect(x,y+3,w,h,r);
 g.fillStyle(shadeUi(color,.68)).fillRoundedRect(x,y,w,h,r);
 g.fillStyle(color).fillRoundedRect(x+1,y+1,w-2,h-5,Math.max(2,r-1));
 g.fillStyle(0xffffff,.18).fillRoundedRect(x+3,y+2,w-6,h*.38,Math.max(2,r-2));
 g.lineStyle(1,shadeUi(color,.55),.65).strokeRoundedRect(x,y,w,h,r);
}
