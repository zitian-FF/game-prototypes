// Offline preparation. Standard runtime art and original masters are inputs only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import AdmZip from 'adm-zip';
const [originalZip,standardDir,output]=process.argv.slice(2);
if(!originalZip||!standardDir||!output)throw Error('Usage: prepare-punchies-compact.mjs original-art.zip standard-runtime-directory output-directory');
const original=new AdmZip(originalZip),zip=new AdmZip(),files=[];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const file of fs.readdirSync(standardDir,{recursive:true})){
  const source=path.join(standardDir,file);if(!fs.statSync(source).isFile()||file==='manifest.json')continue;
  const name=path.parse(file).name,relative=file.replaceAll('\\','/');
  let bytes=fs.readFileSync(source),rule='Standard registration and data retained';
  if(/\.(webp|png|jpg)$/.test(file)&&!name.startsWith('part_')){
    const master=relative.startsWith('loose/')?(original.getEntry(`loose/${name}.png`)??original.getEntry(`loose/${name}.webp`)):null;
    if(relative.startsWith('loose/')&&!master)throw Error(`Missing archived original for ${relative}`);
    // Atlas sheets are lossless standard output, so decoding them adds no loss.
    let image=sharp(master?master.getData():bytes);
    if(name==='portrait_tyke'||name==='portrait_longan'){
      const meta=await image.metadata();image=image.extract({left:0,top:0,width:meta.width,height:Math.round(meta.height*(name==='portrait_tyke'?.86:.75))});
    }
    const limit=name.startsWith('portrait_')?768:/^(arena_|ring$|.*background|gym_props)/.test(name)?960:null;
    if(limit)image=image.resize({width:limit,height:limit,fit:'inside',withoutEnlargement:true});
    const encoded=await image.webp({quality:relative.startsWith('atlas/')?65:name.startsWith('portrait_')?78:72,alphaQuality:100,effort:4}).toBuffer();
    bytes=encoded;
    rule=limit?`Original master, maximum ${limit}px; WebP ${name.startsWith('portrait_')?78:72}`:'Recompressed at original registration; WebP 65 atlas / 72 loose';
    if(relative.startsWith('atlas/')&&encoded.length>=fs.statSync(source).size){bytes=fs.readFileSync(source);rule='Lossless standard atlas retained; lossy encoding was larger';}
  }
  zip.addFile(relative,bytes);files.push({path:relative,bytes:bytes.length,sha256:hash(bytes),rule});
}
const manifest=files.map(file=>({path:file.path,hash:file.sha256}));
zip.addFile('manifest.json',Buffer.from(JSON.stringify(manifest,null,2)));
for(const entry of zip.getEntries())entry.header.time=new Date(2000,0,1);
const bytes=zip.toBuffer();fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'punchies_compact_assets.zip'),bytes);
fs.writeFileSync(path.join(output,'compact-art-inventory.json'),JSON.stringify({originalSha256:hash(fs.readFileSync(originalZip)),zipSha256:hash(bytes),zipBytes:bytes.length,files},null,2));
console.log(JSON.stringify({bytes:bytes.length,sha256:hash(bytes),runtimeBytes:files.reduce((n,f)=>n+f.bytes,0)}));
