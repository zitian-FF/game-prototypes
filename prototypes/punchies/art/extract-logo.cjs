// Extract original approved 1844x853 board logo; retain its source pixels.
// Usage: node extract-logo.cjs <approved-board.png> <logo.png>
const sharp=require('sharp');const fs=require('fs');const path=require('path');
if(!process.argv[2]||!process.argv[3])throw Error('Provide approved board and output logo paths');
(async()=>{const w=462,h=131;const {data}=await sharp(process.argv[2]).extract({left:365,top:465,width:w,height:h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});const seed=new Uint8Array(w*h),mask=new Uint8Array(w*h);
const outline=[[6,51],[20,32],[55,17],[75,20],[90,15],[116,14],[156,10],[172,15],[200,14],[220,19],[246,16],[270,18],[289,19],[300,16],[309,1],[328,11],[339,0],[350,17],[374,20],[390,24],[412,27],[449,41],[457,61],[450,93],[441,117],[415,130],[366,131],[258,119],[193,120],[119,126],[91,131],[46,131],[28,118],[17,92],[10,78]];
const inside=(x,y)=>{let c=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a[1]>y)!=(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
for(let i=0;i<seed.length;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];seed[i]=inside(i%w,Math.floor(i/w))&&(Math.max(r,g,b)>122||(r>75&&r>b*1.45))?1:0;}
for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(seed[y*w+x])for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(dx*dx+dy*dy<=10&&x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)mask[(y+dy)*w+x+dx]=1;
const exterior=new Uint8Array(w*h),q=[];const add=i=>{if(!mask[i]&&!exterior[i]){exterior[i]=1;q.push(i);}};for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}for(let k=0;k<q.length;k++){const i=q[k],x=i%w,y=Math.floor(i/w);if(x>0)add(i-1);if(x<w-1)add(i+1);if(y>0)add(i-w);if(y<h-1)add(i+w);}
for(let i=0;i<mask.length;i++)if(exterior[i]||(Math.floor(i/w)>118&&i%w>65&&i%w<375))data[i*4+3]=0;
fs.mkdirSync(path.dirname(process.argv[3]),{recursive:true});await sharp(data,{raw:{width:w,height:h,channels:4}}).png().toFile(process.argv[3]);})();
