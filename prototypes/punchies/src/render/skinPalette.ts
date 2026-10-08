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
