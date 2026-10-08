import Phaser from 'phaser';
import { skinItem } from '../shop/roster';
// Cosmetic only: never changes fighter ids or simulation stats.
const ranges:Record<string,[number,number]>={marco:[185,270],mia:[335,380],bruno:[85,175]};
export function skinReady(scene:Phaser.Scene,char:string,skin:string):boolean{
 const item=skinItem(char,skin);return !item||item.skinType!=='unique'||['head','torso','glove_left','glove_right','boot_left','boot_right'].every(p=>scene.textures.exists('punchies:part_'+item.rigGroup+'_'+p))&&scene.textures.exists('punchies:'+item.portraitKey);
}
export function skinTexture(scene:Phaser.Scene,char:string,skin:string,name:string):string{
 const item=skinItem(char,skin),base='punchies:'+name;
 if(!item)return base;
 if(item.skinType==='unique'){
  const variant=name.startsWith('portrait_')?'punchies:'+item.portraitKey:'punchies:'+name.replace('part_'+char+'_','part_'+item.rigGroup+'_');
  return scene.textures.exists(variant)?variant:base;
 }
 const key=base+':'+skin;if(scene.textures.exists(key)||!scene.textures.exists(base))return scene.textures.exists(key)?key:base;
 const src=scene.textures.get(base).getSourceImage() as HTMLImageElement;
 const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return base;
 ctx.drawImage(src,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),range=ranges[char];
 const target=Phaser.Display.Color.IntegerToColor(item.accent);const targetHue=Phaser.Display.Color.RGBToHSV(target.red,target.green,target.blue).h;
 for(let i=0;i<pixels.data.length;i+=4){if(!pixels.data[i+3])continue;const hsv=Phaser.Display.Color.RGBToHSV(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);let deg=hsv.h*360;if(range?.[1]>360&&deg<range[1]-360)deg+=360;
  if(!range||deg<range[0]||deg>range[1]||hsv.s<.35||hsv.v<.2)continue;
  const rgb=Phaser.Display.Color.HSVToRGB(targetHue,Math.max(.35,hsv.s*.70),Math.min(1,hsv.v*1.12));pixels.data[i]='r' in rgb?rgb.r:rgb.red;pixels.data[i+1]='g' in rgb?rgb.g:rgb.green;pixels.data[i+2]='b' in rgb?rgb.b:rgb.blue;
 }
 ctx.putImageData(pixels,0,0);scene.textures.addCanvas(key,canvas);return key;
}
