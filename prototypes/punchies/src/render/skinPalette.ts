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
export function recolourStarter(data:Uint8ClampedArray,char:string,name:string,width:number,height:number):void{
  const portrait=name.startsWith('portrait_'),head=name.endsWith('_head'),tail=name.includes('ponytail');
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const [h,s,v]=hsv(data[i],data[i+1],data[i+2]);
    if(s<.22||v<.16)continue;
    const x=(i/4%width)/width,y=Math.floor(i/4/width)/height;
    let out:[number,number,number]|null=null;
    if(char==='marco'){
      if(h>=185&&h<=270)out=rgb(188,s,v);
      else if(h>=12&&h<=48&&((portrait&&x>.43&&y>.14&&y<.35)||(head&&x<.72)))out=rgb(225,s*.18,v*.40);
    }else if(char==='mia'){
      if(h>=335||h<=12)out=rgb(278,s,v);
      else if(h>=35&&h<=65&&(head||tail||(portrait&&y<.58)))out=rgb(25,Math.max(.5,s*.85),v*.55);
    }else if(char==='bruno'){
      if(h>=85&&h<=175)out=rgb(48,s,v);
      // Exclude copper hair/beard: their orange hues overlap skin.
      else if(h>=12&&h<=38&&v>.38&&((head&&x>.79)||(portrait&&!(x>.33&&x<.65&&(y<.23||(y>.31&&y<.55&&x<.61))))))out=rgb(h,s,v*.82);
    }
    if(out){data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];}
  }
}
import { PALETTES } from './paletteCatalog';

/** Material masks exclude skin, hair, tattoos, outlines and transparent pixels. */
export function recolourPalette(data:Uint8ClampedArray,char:string,skin:string,name:string,width:number,height:number):void {
  const palette=PALETTES[skin]; if(!palette||palette.boxer!==char)return;
  if(STARTER_SKINS.includes(skin)){recolourStarter(data,char,name,width,height);return;}
  const portrait=name.startsWith('portrait_'),head=name.endsWith('_head'),tail=name.includes('ponytail');
  if((head||tail)&&char==='tee')return;
  const glove=name.includes('glove'),boot=name.includes('boot'),torso=name.endsWith('_torso');
  // Connected material islands prevent rectangular colour seams through a glove or garment.
  const mask=new Uint8Array(width*height),visited=new Uint8Array(mask.length);
  for(let pixel=0;pixel<mask.length;pixel++){
    const i=pixel*4,[h,s,v]=hsv(data[i],data[i+1],data[i+2]);if(!data[i+3]||v<.17)continue;
    const red=(h>=335||h<=12)&&s>.25;
    const coloured=char==='marco'?h>=185&&h<=270&&s>.25:char==='mia'?red:char==='bruno'?h>=85&&h<=175&&s>.25:char==='tee'?red:char==='tyke'?h>=32&&h<=75&&s>.28:char==='dragon'?red:char==='longan'?h>=65&&h<=175&&s>.22:false;
    const neutral=s<.20&&v>.22&&(torso||glove||boot||portrait)&&['tee','tyke','dragon','longan'].includes(char);
    if(coloured)mask[pixel]=1;else if(neutral)mask[pixel]=2;
  }
  for(let seed=0;seed<mask.length;seed++){
    if(!mask[seed]||visited[seed])continue;
    const island=[seed];visited[seed]=1;let sumX=0,sumY=0,minY=height;
    for(let k=0;k<island.length;k++){
      const p=island[k],x=p%width,y=Math.floor(p/width);sumX+=x;sumY+=y;minY=Math.min(minY,y);
      for(const q of [x>0?p-1:-1,x<width-1?p+1:-1,y>0?p-width:-1,y<height-1?p+width:-1])if(q>=0&&!visited[q]&&mask[q]===mask[seed]){visited[q]=1;island.push(q);}
    }
    const x=sumX/island.length/width,y=sumY/island.length/height;
    if(mask[seed]===2&&portrait){
      if(char==='dragon'&&y<.33)continue;
      if(char==='tee'&&(minY/height<.34||x<.3||x>.8))continue;
      if(char==='tyke'&&y<.84)continue;
      if(char==='longan'&&y<.32)continue;
    }
    const portraitGlove=portrait&&(char==='marco'?((x<.47&&y<.34)||(x>.65&&y>.39&&y<.74)):char==='mia'?((x>.61&&y>.43&&y<.72)||(x>.34&&x<.68&&y>.64&&y<.91)):char==='bruno'?((x>.66&&y>.22&&y<.63)||(x<.44&&y>.65)):char==='tyke'?y<.84:char==='dragon'?mask[seed]===1:char==='longan'?y<.82:((x<.5&&y>.58&&y<.83)||(x>.6&&y>.4&&y<.69)));
    const target=glove||portraitGlove||((char==='dragon'||char==='tyke')&&mask[seed]===1)?palette.gloves:palette.kit;
    const [th,ts,tv]=hsv(target>>16&255,target>>8&255,target&255);
    for(const pixel of island){const i=pixel*4,[,s,v]=hsv(data[i],data[i+1],data[i+2]);const out=rgb(th,ts*Math.min(1,s>.2?s/.75:1),Math.min(1,v*(s>.2?Math.max(.7,tv):tv)));data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];}
  }
}
