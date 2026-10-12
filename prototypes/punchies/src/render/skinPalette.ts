// Deterministic cosmetics: retain source alpha, outlines and shading.
export const STARTER_SKINS = ['skin-marco-cyan', 'skin-mia-violet', 'skin-bruno-gold'];
export function limbSkin(char: string, skin: string, original: number): number {
  return char === 'bruno' && skin === 'skin-bruno-gold' ? 0xc57b47 : original;
}
function hsv(r:number,g:number,b:number):[number,number,number]{
  r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=d===0?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return [(h*60+360)%360,max===0?0:d/max,max];
}
function rgb(h:number,s:number,v:number):[number,number,number]{
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
  const a=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return a.map(n=>Math.round((n+m)*255)) as [number,number,number];
}

import { PALETTES } from './paletteCatalog';
import { portraitMaterialMask } from './materialMasks';
import { teeMaterialMask } from './teeMaterials';

/** Broad material membership avoids excluding noisy/antialiased source shades. */
function coloured(char:string,h:number,s:number):boolean {
  if(s<.08)return false;
  return char==='marco'?h>=175&&h<=285:char==='mia'||char==='dragon'||char==='tee'?h>=335||h<=10:char==='bruno'?h>=72&&h<=180:char==='tyke'?h>=28&&h<=80:char==='longan'?h>=60&&h<=180:false;
}
function tint(h:number,s:number,v:number,target:[number,number,number]):[number,number,number] {
  const [th,ts,tv]=target;
  // Keep local luminance/shading; low-saturation highlights stay pale.
  return rgb(th,ts*Math.min(1,s/.65),Math.min(1,v*Math.max(.72,tv)));
}
export function recolourStarter(data:Uint8ClampedArray,char:string,name:string,width:number,height:number):void {
  const id=char==='marco'?'skin-marco-cyan':char==='mia'?'skin-mia-violet':'skin-bruno-gold';
  recolourPalette(data,char,id,name,width,height);
}
/** Semantic masks protect skin, hair, trim, tattoos and source navy outlines. */
export function recolourPalette(data:Uint8ClampedArray,char:string,skin:string,name:string,width:number,height:number):void {
  const palette=PALETTES[skin];if(!palette||palette.boxer!==char)return;
  const starter=STARTER_SKINS.includes(skin),portrait=name.startsWith('portrait_');
  const teeMask=char==='tee'?teeMaterialMask(name,width,height):null;
  const material=teeMask??(portrait?portraitMaterialMask(char,width,height):null);
  const shades=portrait||teeMask?new Map<number,number>():null;
  const kitHsv=hsv(palette.kit>>16&255,palette.kit>>8&255,palette.kit&255),gloveHsv=hsv(palette.gloves>>16&255,palette.gloves>>8&255,palette.gloves&255);
  const head=name.endsWith('_head'),tail=name.includes('ponytail'),glove=name.includes('glove'),boot=name.includes('boot'),torso=name.endsWith('_torso');
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const r=data[i],g=data[i+1],b=data[i+2];
    if(Math.max(r,g,b)<40)continue; // authored navy outline stays exact
    const flags=material?.[i/4]??0,shadeKey=(flags<<24)|(r<<16)|(g<<8)|b;
    const cached=shades?.get(shadeKey);
    if(cached!==undefined){data[i]=cached>>16&255;data[i+1]=cached>>8&255;data[i+2]=cached&255;continue;}
    const [h,s,v]=hsv(r,g,b);

    if(teeMask){
      // Only neutral cloth/leather inside authored boundaries. Red tabs, warm
      // skin/antialiasing and all head/tail pixels retain their original RGBA.
      let out:[number,number,number]|null=null;
      if(flags&&s<.6&&v>.09&&!(h<100&&s>.12)&&!(flags!==4&&v>=.8)){
        const target=flags===2?gloveHsv:kitHsv;
        const white=flags===4;
        // White fabric remains shaded fabric; a highlight on BLACK fabric is
        // neutral. Continuous rolloffs avoid compression-induced colour specks.
        const light=white?1-Math.max(0,(v-.82)/.18)*.8:Math.max(0,1-(v-.48)/.32);
        const neutral=Math.max(0,Math.min(1,(.60-s)/.30));
        const dark=Math.max(0,Math.min(1,(v-40/255)/.18));
        const colour=rgb(target[0],target[1]*.65*light*neutral*dark,Math.min(1,v*(white?.96:Math.max(.88,target[2]))));
        out=colour;
      }
      if(out){data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];}
      if(shades&&shades.size<50000)shades.set(shadeKey,(data[i]<<16)|(data[i+1]<<8)|data[i+2]);
      continue;
    }
    const x=(i/4%width+.5)/width,y=(Math.floor(i/4/width)+.5)/height;
    // The exposed face wedge is not helmet material, including its compressed
    // reddish/grey edge pixels. Hair recolouring must never spill into it.
    if(head&&['marco','mia'].includes(char)&&x>.88&&y>.28&&y<.68)continue;
    if(portrait&&char==='mia'&&((flags&8)!==0)&&r>g&&g>=b&&g/r>.45)continue;
    const hair=portrait?((flags&4)!==0):tail||(head&&(char==='marco'?x<.83:char==='mia'?x<.85:true));
    const trim=portrait&&((flags&16)!==0)&&s<.3;
    let out:[number,number,number]|null=null;
    if(starter&&char==='marco'&&hair&&!trim&&(h<85||s<.18)&&v<.88){
      // The whole brown/grey hair material, including its low-saturation shading.
      out=rgb(225,s*.15,v*.4);
    }else if(starter&&char==='mia'&&hair&&!trim&&h>=25&&h<=85&&!(portrait&&((flags&8)!==0))){
      out=rgb(25,Math.max(.35,s*.85),v*.55);
    }else if(starter&&char==='bruno'&&!trim&&h>=8&&h<=48&&s>.12&&v>.2&&
      (portrait?((flags&8)!==0)&&!hair:torso||(head&&x>.82&&y>.25&&y<.54))){
      out=rgb(h,s,v*.82);
    }else if(!trim&&coloured(char,h,s)&&!(char==='tyke'&&(head||(torso&&x>.25)))){
      const gear=portrait?(char==='dragon'||((flags&2)!==0)?'glove':['marco','mia','bruno'].includes(char)||((flags&1)!==0)?'kit':null):
        glove?'glove':(torso||boot||head||tail)?'kit':null;
      if(gear)out=tint(h,s,v,gear==='glove'||char==='dragon'?gloveHsv:kitHsv);
    }else if(!trim&&s<.22&&v>.22&&['tee','tyke','dragon','longan'].includes(char)){
      // Neutral garments/wraps have explicit regions; white hair and faces never qualify.
      const kit=portrait?((flags&1)!==0)&&!hair:torso||boot;
      const wraps=char==='longan'&&(glove||(portrait&&((flags&2)!==0)));
      const darkGlove=char==='tee'&&(glove||(portrait&&((flags&2)!==0)))&&v<.65;
      if(kit||wraps||darkGlove){const [th,ts,tv]=wraps||darkGlove?gloveHsv:kitHsv;out=rgb(th,ts,Math.min(1,v*tv));}
    }
    if(out){data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];}
    if(shades&&shades.size<50000)shades.set(shadeKey,(data[i]<<16)|(data[i+1]<<8)|data[i+2]);
  }
}
