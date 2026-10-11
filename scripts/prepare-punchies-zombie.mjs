// Review-only extraction. Never writes to the live runtime or R2.
import sharp from 'sharp';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]??'outputs/zombie-v1');
const source=path.join(root,'masters/generated-sheet.png');
const meta=await sharp(source).metadata();
const parts=path.join(root,'masters/parts/zombie'),runtime=path.join(root,'runtime/loose');
await mkdir(parts,{recursive:true});await mkdir(runtime,{recursive:true});
const cuts={head:[0,0,690,765],torso:[690,0,meta.width-690,765],glove_right:[0,765,690,meta.height-765],boot_right:[690,765,meta.width-690,meta.height-765]};
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const inventory=[];
for(const [part,[left,top,width,height]] of Object.entries(cuts)){
 const {data,info}=await sharp(source).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=width,y0=height,x1=-1,y1=-1;
 // Generated sheet has alpha 1..8 dust in empty gutters. Locate visible art,
 // retaining two pixels of real antialiasing around its bounds.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*info.channels+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 if(x1<0)throw new Error(`Empty part ${part}`);
 x0=Math.max(0,x0-2);y0=Math.max(0,y0-2);x1=Math.min(width-1,x1+2);y1=Math.min(height-1,y1+2);
 const master=await sharp(source).extract({left:left+x0,top:top+y0,width:x1-x0+1,height:y1-y0+1}).png().toBuffer();
 const file=path.join(parts,part+'.png');await writeFile(file,master);
 const m=await sharp(master).metadata();
 const size=part==='boot_right'?{width:84}: {height:part==='head'?120:part==='torso'?128:96};
 const prepared=await sharp(master).resize({...size,kernel:'lanczos3'}).webp({lossless:true,effort:6}).toBuffer();
 const key=`part_zombie_${part}`,out=path.join(runtime,key+'.webp');await writeFile(out,prepared);
 const r=await sharp(prepared).metadata();
 inventory.push({key,source:'generated-sheet.png',master:`parts/zombie/${part}.png`,sourceCrop:{left:left+x0,top:top+y0,width:m.width,height:m.height},masterSha256:hash(master),runtimeSha256:hash(prepared),runtimeBytes:prepared.length,runtimeSize:[r.width,r.height]});
}
const mirrors={part_zombie_glove_left:{source:'part_zombie_glove_right',axis:'x'},part_zombie_boot_left:{source:'part_zombie_boot_right',axis:'y'}};
await writeFile(path.join(runtime,'part-mirrors.json'),JSON.stringify(mirrors,null,2)+'\n');
const sourceBytes=await readFile(source);
await writeFile(path.join(root,'inventory.json'),JSON.stringify({sourceSha256:hash(sourceBytes),sourceSize:[meta.width,meta.height],parts:inventory,mirrors,runtimeBytes:inventory.reduce((n,p)=>n+p.runtimeBytes,0)+(await stat(path.join(runtime,'part-mirrors.json'))).size,registration:{headOrigin:[.49,.5],torsoOrigin:[.5,.5],gloveOrigin:[.5,.5],gloveAxis:Math.PI/2,bootOrigin:[.5,.5],skin:'#9dbc61',preparedSizes:'existing Punchies contract; standard and compact share prepared pixels'}},null,2)+'\n');
console.log(JSON.stringify(inventory.map(({key,runtimeSize,runtimeBytes})=>({key,runtimeSize,runtimeBytes})),null,2));
