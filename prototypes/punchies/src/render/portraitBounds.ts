import type Phaser from 'phaser';
const boundsCache=new Map<string,{left:number;top:number;right:number;bottom:number}>();
export function portraitBounds(scene:Phaser.Scene,key:string):{left:number;top:number;right:number;bottom:number}{
  const cached=boundsCache.get(key);if(cached)return cached;
  const src=scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(src,0,0);
  const data=ctx.getImageData(0,0,src.width,src.height).data;
  let left=src.width,top=src.height,right=0,bottom=0;
  for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++)if(data[(y*src.width+x)*4+3]>=16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  const bounds=right>left?{left,top,right,bottom}:{left:0,top:0,right:src.width,bottom:src.height};
  boundsCache.set(key,bounds);return bounds;
}
