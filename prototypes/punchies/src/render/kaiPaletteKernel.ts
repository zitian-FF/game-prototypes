// Approved Kai courier palettes. Skin protection is absolute; used by cached staging cosmetics.
export const COURIER_PALETTES={
 base:{name:'Base',colour:0xffd21a,emblem:'mei'},
 kangaroo:{name:'Kangaroo Turquoise',colour:0x00ccbc,emblem:'kangaroo'},
 grabber:{name:'Grabber Green',colour:0x00b14f,emblem:'hand'},
 panda:{name:'Panda Pink',colour:0xd70f64,emblem:'panda'},
} as const;
type P=readonly (readonly [number,number])[];
// Explicit skin/hair protection; yellow fabric/helmet is selected only outside it.
const protectedPortrait:readonly P[]=[
 // Face / hair, traced inside the helmet and jacket boundaries.
 [[.552,.237],[.64,.215],[.825,.245],[.878,.302],[.857,.37],[.785,.431],[.704,.457],[.617,.416],[.562,.355]],
 // Exposed neck and chest only; collar and lapels remain recolourable.
 [[.509,.397],[.538,.387],[.576,.410],[.599,.444],[.609,.475],[.636,.500],[.644,.537],[.649,.565],[.608,.553],[.586,.537],[.576,.500],[.561,.479],[.540,.454]],
 // Forward elbow / forearm up to the glove cuff.
 [[.010,.483],[.036,.476],[.083,.474],[.130,.484],[.172,.510],[.190,.549],[.181,.572],[.151,.583],[.128,.600],[.117,.622],[.088,.611],[.052,.586],[.024,.551]],
 // Rear forearm below its cuff.
 [[.849,.579],[.936,.566],[.978,.639],[.986,.701],[.948,.76],[.904,.79],[.851,.775],[.803,.724],[.813,.669]],
 // Exposed fingers around the forward fist, not the yellow jacket behind it.
 [[.414,.609],[.438,.617],[.448,.644],[.437,.667],[.421,.66]],
 [[.401,.662],[.427,.678],[.407,.706],[.382,.714],[.365,.697]],
 [[.371,.697],[.396,.718],[.369,.745],[.343,.75],[.326,.727]],
 [[.33,.724],[.355,.748],[.329,.763],[.305,.763],[.292,.75]],
 // Raised fist fingers / thumb, excluding glove trim and nearby collar.
 [[.764,.415],[.785,.408],[.803,.413],[.807,.434],[.809,.463],[.825,.474],[.824,.491],[.801,.494],[.785,.479],[.779,.457],[.762,.485],[.741,.483],[.733,.470],[.735,.454],[.750,.444],[.759,.439]],
];
function inside(x:number,y:number,p:P){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [xi,yi]=p[i],[xj,yj]=p[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)yes=!yes;}return yes;}
function hsv(r:number,g:number,b:number){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=d===0?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;return[(h*60+360)%360,max?d/max:0,max];}
function rgb(h:number,s:number,v:number){const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c,a=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return a.map(n=>Math.round((n+m)*255));}
const masks=new Map<string,Uint8Array>();
export function courierMask(name:string,width:number,height:number){const key=name+':'+width+'x'+height,old=masks.get(key);if(old)return old;const mask=new Uint8Array(width*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const xx=(x+.5)/width,yy=(y+.5)/height;const skin=name==='portrait'?protectedPortrait.some(p=>inside(xx,yy,p)):name==='head'?xx>.90&&yy>.35&&yy<.67:name.includes('glove')?(xx>.84||(xx>.43&&yy<.20)):name.includes('boot')?xx<.19&&yy>.24&&yy<.73:false;mask[y*width+x]=skin?0:1;}if(masks.size>=8)masks.delete(masks.keys().next().value!);masks.set(key,mask);return mask;}
export function recolourCourier(data:Uint8ClampedArray,name:string,width:number,height:number,skin:keyof typeof COURIER_PALETTES){
 if(skin==='base')return;const p=COURIER_PALETTES[skin],target=hsv(p.colour>>16&255,p.colour>>8&255,p.colour&255),mask=courierMask(name,width,height),cache=new Map<number,number>();
 for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const r=data[i],g=data[i+1],b=data[i+2],key=(mask[i/4]<<24)|(r<<16)|(g<<8)|b,old=cache.get(key);if(old!==undefined){data[i]=old>>16&255;data[i+1]=old>>8&255;data[i+2]=old&255;continue;}
  const [h,s,v]=hsv(r,g,b);let out=[r,g,b];
  // No white/near-white blanket recolour. Cream highlights, black leather,
  // navy outline, turquoise trim, hair and warm skin remain source pixels.
  // Protected skin is an absolute exclusion, including warm highlights.
  const garmentHighlight=mask[i/4]&&(name==='torso'||(name==='portrait'&&Math.floor(i/4/width)/height>.38))&&h>=28&&h<=80&&s>.08&&s<=.45&&v>.84;
  if(garmentHighlight){out=rgb(target[0],target[1]*s*.65,v);}
  else if(mask[i/4]&&h>=28&&(name!=='portrait'||h>=40||s>.82)&&h<=74&&s>.45&&v>.20&&b/Math.max(1,r)<.40){const saturation=target[1]*Math.min(1,s/.75);out=rgb(target[0],saturation,v*target[2]);}
  data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];if(cache.size<50000)cache.set(key,out[0]<<16|out[1]<<8|out[2]);
 }
}
/** Restore only the base forehead ink, row-interpolating helmet colours.
 * Called on recoloured portrait before a compact code/vector emblem is drawn. */
export function clearPortraitEmblem(data:Uint8ClampedArray,source:Uint8ClampedArray,width:number,height:number){
 const x0=Math.floor(width*.675),x1=Math.ceil(width*.81),y0=Math.floor(height*.104),y1=Math.ceil(height*.212);
 // Exact forehead surface above the authored visor curve. Restore the local
 // flat material plane, retaining cream specular shapes and the thin navy rim.
 const surface=(x:number,y:number)=>{const xx=x/width,yy=y/height;const rim=.179+1.216*(xx-.664)*(xx-.664);return yy<rim-.0025&&!(xx>=.783+1.55*(yy-.104)&&yy<.13);};
 for(let y=y0;y<y1;y++){
  const samples:number[][]=[[],[],[]];for(let x=Math.floor(width*.66);x<Math.ceil(width*.85);x++){const i=(y*width+x)*4,[h,s,v]=hsv(source[i],source[i+1],source[i+2]);if(source[i+3]>128&&h>=40&&h<=74&&s>.60&&v>.88)for(let c=0;c<3;c++)samples[c].push(data[i+c]);}
  if(!samples[0].length)continue;const colour=samples.map(values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]);
  for(let x=x0;x<x1;x++){const i=(y*width+x)*4,[,s,v]=hsv(source[i],source[i+1],source[i+2]);if(source[i+3]>128&&surface(x,y)&&!(v>.9&&s<.3))for(let c=0;c<3;c++)data[i+c]=colour[c];}
 }
}


