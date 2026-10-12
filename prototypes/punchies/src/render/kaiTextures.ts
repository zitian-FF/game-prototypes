import type Phaser from 'phaser';
import { recolourCourier, clearPortraitEmblem, COURIER_PALETTES } from './kaiPaletteKernel';

const paletteIds:Readonly<Record<string,keyof typeof COURIER_PALETTES>>={
 'skin-kai-kangaroo-turquoise':'kangaroo','skin-kai-grabber-green':'grabber','skin-kai-panda-pink':'panda',
};
/** One canonical right limb; recolour in source coordinates, then mirror Y.
 * Cached final canvases preserve source alpha and avoid per-frame painting. */
export function kaiTexture(scene:Phaser.Scene,skin:string,name:string):string {
 const palette=paletteIds[skin]??'base',left=name.endsWith('_left');
 const sourceName=left?name.replace(/_left$/,'_right'):name,base='punchies:'+sourceName;
 const key='punchies:'+name+':kai-mask-v2:'+palette;
 if(scene.textures.exists(key))return key;
 if(!scene.textures.exists(base))return 'punchies:'+name;
 const src=scene.textures.get(base).getSourceImage() as HTMLImageElement;
 const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return base;
 ctx.drawImage(src,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 const source=new Uint8ClampedArray(pixels.data);
 const part=sourceName==='portrait_kai'?'portrait':sourceName.replace('part_kai_','');
 recolourCourier(pixels.data,part,canvas.width,canvas.height,palette);
 if(part==='portrait'&&palette!=='base')clearPortraitEmblem(pixels.data,source,canvas.width,canvas.height);
 ctx.putImageData(pixels,0,0);
 if(part==='head'||part==='portrait'&&palette!=='base'){
  const atlasKey='punchies:kai_emblems';if(!scene.textures.exists(atlasKey))return base;
  const atlas=scene.textures.get(atlasKey).getSourceImage() as HTMLImageElement;
  const index=Object.keys(COURIER_PALETTES).indexOf(palette);
  if(part==='head'){
   const w=Math.round(canvas.width*.29);
   ctx.save();ctx.translate(Math.round(canvas.width*.59),Math.round(canvas.height*.5));ctx.rotate(-Math.PI/2);
   ctx.drawImage(atlas,index*64,0,64,64,-w/2,-w/2,w,w);ctx.restore();
  }else{
   // Contain a square badge in the same authored portrait forehead box.
   const w=Math.round(canvas.width*.115),h=Math.round(canvas.height*.083),side=Math.min(w,h);
   ctx.drawImage(atlas,index*64,0,64,64,Math.round(canvas.width*.707)+(w-side)/2,Math.round(canvas.height*.105)+(h-side)/2,side,side);
  }
 }
 if(left){const mirrored=document.createElement('canvas');mirrored.width=canvas.width;mirrored.height=canvas.height;
  const m=mirrored.getContext('2d');if(!m)return base;m.translate(0,canvas.height);m.scale(1,-1);m.drawImage(canvas,0,0);scene.textures.addCanvas(key,mirrored);
 }else scene.textures.addCanvas(key,canvas);
 return key;
}
