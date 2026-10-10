import Phaser from 'phaser';
import { skinItem } from '../shop/roster';
import { recolourPalette } from './skinPalette';
// Cosmetic only: never changes fighter ids or simulation stats.
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
 ctx.drawImage(src,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 recolourPalette(pixels.data,char,skin,name,canvas.width,canvas.height);
 ctx.putImageData(pixels,0,0);scene.textures.addCanvas(key,canvas);return key;
}
