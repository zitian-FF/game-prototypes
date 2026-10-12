import type Phaser from 'phaser';
import {STAGING_BUILD} from '../buildFlags';
export interface IndexedPortraitMask {width:number;height:number;material:Uint8Array;coverage:Uint8Array}
/** ID byte encoded as48×material in PNG RGB: survives low-alpha Canvas rounding. */
export function decodeIndexedPortraitMask(rgba:Uint8ClampedArray,width:number,height:number):IndexedPortraitMask|null {
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||rgba.length!==width*height*4)return null;
 const material=new Uint8Array(width*height),coverage=new Uint8Array(width*height);
 for(let i=0;i<material.length;i++){const p=i*4,a=rgba[p+3];if(!a)continue;const id=Math.round(rgba[p]/48);
  if(id<0||id>4||Math.abs(rgba[p]-id*48)>12||Math.abs(rgba[p+1]-rgba[p])>3||Math.abs(rgba[p+2]-rgba[p])>3)return null;
  material[i]=id;coverage[i]=a;
 }return {width,height,material,coverage};
}
/** In-place one-time composition. Skin/hair/outline/highlight source RGBA stays exact. */
export function applyIndexedPortraitMask(base:Uint8ClampedArray,tinted:Uint8ClampedArray,mask:IndexedPortraitMask):boolean {
 const count=mask.width*mask.height;if(base.length!==count*4||tinted.length!==base.length||mask.material.length!==count||mask.coverage.length!==count)return false;
 for(let i=0;i<count;i++){const p=i*4,id=mask.material[i],amount=id>=1&&id<=3?mask.coverage[i]/255:0;
  for(let c=0;c<3;c++)tinted[p+c]=amount===0?base[p+c]:amount===1?tinted[p+c]:Math.round(base[p+c]+(tinted[p+c]-base[p+c])*amount);
  tinted[p+3]=base[p+3];
 }return true;
}
const decoded=new WeakMap<object,IndexedPortraitMask|null>();
const decodeStats={successfulDecodeCount:0,cacheHits:0,lastDecodeMs:0,totalDecodeMs:0,lastDecodedMaterialBytes:0,lastDecodedCoverageBytes:0};
const decodeClock=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
/** Staging QA only: immutable snapshot, no source pixels, no reset or per-frame listener. */
export function stagingIndexedMaskDiagnostics(){return STAGING_BUILD?Object.freeze({...decodeStats}):null;}

export function stagingTeePortraitMask(scene:Phaser.Scene,width:number,height:number):IndexedPortraitMask|null {
 if(!STAGING_BUILD||!scene.textures.exists('punchies:materialmask_tee'))return null;
 const source=scene.textures.get('punchies:materialmask_tee').getSourceImage() as HTMLImageElement;
 // Never resize/index-interpolate a mismatched compact source. Packaging must preserve canonical geometry.
 if(source.width!==width||source.height!==height)return null;
 if(decoded.has(source)){const cached=decoded.get(source)!;if(cached)decodeStats.cacheHits++;return cached;}
 const started=decodeClock();
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx){decoded.set(source,null);return null;}ctx.drawImage(source,0,0);
 const mask=decodeIndexedPortraitMask(ctx.getImageData(0,0,width,height).data,width,height);decoded.set(source,mask);
 if(mask){const elapsed=Math.max(0,decodeClock()-started);decodeStats.successfulDecodeCount++;decodeStats.lastDecodeMs=elapsed;decodeStats.totalDecodeMs+=elapsed;decodeStats.lastDecodedMaterialBytes=mask.material.byteLength;decodeStats.lastDecodedCoverageBytes=mask.coverage.byteLength;}
 return mask;
}

/** Put the one-time decode under the existing boot splash, never first roster motion. */
export function warmStagingTeePortraitMask(scene:Phaser.Scene):void {
 if(!STAGING_BUILD||!scene.textures.exists('punchies:portrait_tee'))return;
 const source=scene.textures.get('punchies:portrait_tee').getSourceImage() as HTMLImageElement;
 stagingTeePortraitMask(scene,source.width,source.height);
}
