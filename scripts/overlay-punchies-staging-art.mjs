import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export async function overlayStagingArt(assets,cache,baseArtSha256,portal){
  if(process.env.PUNCHIES_STAGING!=='on')return null;
  const patchRoot=path.resolve('prototypes/punchies/asset-patches');
  const metadataPath=path.join(patchRoot,'materialmask_tee.json');
  if(!fs.existsSync(metadataPath))return null;
  if(portal!=='web')throw Error('The reviewed staging mask pilot is web-only');
  const metadata=JSON.parse(fs.readFileSync(metadataPath));
  const bytes=fs.readFileSync(path.join(patchRoot,'materialmask_tee.png'));
  if(metadata.target!=='loose/materialmask_tee.png'||bytes.length!==metadata.bytes||hash(bytes)!==metadata.sha256)throw Error('Staging mask payload does not match the reviewed manifest');
  const mask=await sharp(bytes).metadata();
  const portraitPath=path.join(assets,'loose/portrait_tee.webp'),portrait=fs.readFileSync(portraitPath),base=await sharp(portrait).metadata();
  if(mask.width!==766||mask.height!==700||mask.width!==base.width||mask.height!==base.height||metadata.dimensions[0]!==mask.width||metadata.dimensions[1]!==mask.height)throw Error('Staging mask and compact portrait geometry differ');
  const preparedBase={bytes:portrait.length,sha256:hash(portrait),dimensions:[base.width,base.height]};
  fs.copyFileSync(path.join(patchRoot,'materialmask_tee.png'),path.join(assets,metadata.target));
  const preparedMetadata=Buffer.from(JSON.stringify({...metadata,preparedBase},null,2));
  fs.writeFileSync(path.join(assets,'loose/materialmask_tee.json'),preparedMetadata);
  const manifestPath=path.join(assets,'manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath)).filter(entry=>!entry.path.startsWith('loose/materialmask_tee.'));
  manifest.push({path:metadata.target,hash:metadata.sha256},{path:'loose/materialmask_tee.json',hash:hash(preparedMetadata)});
  manifest.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const manifestBytes=Buffer.from(JSON.stringify(manifest));fs.writeFileSync(manifestPath,manifestBytes);
  // A deterministic stored ZIP records the exact stage payload without changing R2.
  const zip=new AdmZip();
  for(const name of [...manifest.map(entry=>entry.path),'manifest.json'].sort()){
    if(name!=='manifest.json'&&!/^(loose|atlas)\/[A-Za-z0-9_.-]+$/.test(name))throw Error('Unexpected staging art path');
    const file=fs.readFileSync(path.join(assets,name));zip.addFile(name,file);
    if(name!=='manifest.json'&&hash(file)!==manifest.find(entry=>entry.path===name)?.hash)throw Error(`Staging manifest mismatch: ${name}`);
    const entry=zip.getEntry(name);entry.header.method=0;entry.header.time=new Date(2000,0,1,0,0,0);
  }
  const archive=zip.toBuffer(),archiveSha256=hash(archive),archivePath=path.join(cache,`tee-stage-art-${archiveSha256}.zip`);
  fs.writeFileSync(archivePath,archive);
  if(!new AdmZip(archive).getEntry(metadata.target).getData().equals(bytes))throw Error('Staging ZIP altered mask bytes');
  return {scope:'tee-indexed-staging-pilot',baseArtSha256,archiveSha256,archiveBytes:archive.length,maskSha256:metadata.sha256,maskBytes:bytes.length,manifestSha256:hash(manifestBytes),preparedBase};
}
