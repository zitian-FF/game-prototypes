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
  const kaiRoot=path.join(patchRoot,'kai'),kaiManifestPath=path.join(kaiRoot,'manifest.json');
  let kai;
  if(fs.existsSync(kaiManifestPath)){
    const sourceManifest=fs.readFileSync(kaiManifestPath),payload=JSON.parse(sourceManifest);
    const expected=['kai_emblems.webp','part_kai_boot_right.webp','part_kai_glove_right.webp','part_kai_head.webp','part_kai_torso.webp','portrait_kai.webp'];
    if(payload.character!=='kai'||!Array.isArray(payload.assets)||payload.assets.length!==expected.length||new Set(payload.assets.map(file=>file.name)).size!==expected.length||payload.assets.some(file=>!expected.includes(file.name)))throw Error('Kai stage payload must contain exactly the reviewed canonical files');
    const files=[];
    for(const file of payload.assets){
      const data=fs.readFileSync(path.join(kaiRoot,file.name));
      if(data.length!==file.bytes||hash(data)!==file.sha256)throw Error(`Kai stage source hash mismatch: ${file.name}`);
      const image=await sharp(data).metadata();
      if(!image.hasAlpha||image.width!==file.dimensions?.[0]||image.height!==file.dimensions?.[1])throw Error(`Kai geometry/alpha mismatch: ${file.name}`);
      if(file.name==='portrait_kai.webp'&&Math.max(image.width,image.height)>768)throw Error('Kai compact portrait exceeds reviewed 768px limit');
      if(file.name==='kai_emblems.webp'&&(image.width!==256||image.height!==64))throw Error('Kai badge atlas registration changed');
      const target=`loose/${file.name}`;
      fs.copyFileSync(path.join(kaiRoot,file.name),path.join(assets,target));
      const old=manifest.findIndex(entry=>entry.path===target);if(old>=0)manifest.splice(old,1);
      manifest.push({path:target,hash:file.sha256});files.push({path:target,bytes:data.length,sha256:file.sha256});
    }
    const mirrorPath=path.join(assets,'loose/part-mirrors.json'),mirrors=JSON.parse(fs.readFileSync(mirrorPath));
    // Canonical authored right parts supply the opposite hand/boot without duplicate bitmaps.
    mirrors.part_kai_glove_left={source:'part_kai_glove_right',axis:'y'};
    mirrors.part_kai_boot_left={source:'part_kai_boot_right',axis:'y'};
    const mirrorBytes=Buffer.from(JSON.stringify(mirrors));fs.writeFileSync(mirrorPath,mirrorBytes);
    const mirrorEntry=manifest.find(entry=>entry.path==='loose/part-mirrors.json');
    if(!mirrorEntry)throw Error('Base art manifest lacks mirror aliases');mirrorEntry.hash=hash(mirrorBytes);
    kai={sourceManifestSha256:hash(sourceManifest),files,totalBytes:files.reduce((sum,file)=>sum+file.bytes,0)};
  }
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
  return {scope:kai?'tee-indexed-and-kai-staging-preview':'tee-indexed-staging-pilot',baseArtSha256,archiveSha256,archiveBytes:archive.length,maskSha256:metadata.sha256,maskBytes:bytes.length,manifestSha256:hash(manifestBytes),preparedBase,...(kai?{kai}: {})};
}
