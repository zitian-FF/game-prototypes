import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
const [standard,compact]=process.argv.slice(2);
const art=folder=>path.join(folder,'prototypes/punchies/assets');
const a=art(standard),b=art(compact);
const keys=folder=>JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'))).map(f=>f.path).sort();
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const record=folder=>JSON.parse(fs.readFileSync(path.join(folder,'prototypes/punchies/asset-profile.json')));
const records=[record(standard),record(compact)];
const maskKeys=['loose/materialmask_tee.json','loose/materialmask_tee.png'];
let compactMask=false;
if(records.some(r=>r.approvedContent?.features?.teeIndexedPortrait)){
  assert.equal(records[0].profile,'standard');assert.equal(records[1].profile,'compact');
  assert.equal(records[0].portal,records[1].portal);
  for(const r of records){assert.equal(r.approvedContent?.ownerApproved,true);assert.equal(r.approvedContent?.features?.teeIndexedPortrait,true);}
  assert.equal(records[0].approvedContent.reviewedStageSha,records[1].approvedContent.reviewedStageSha);
  const source=JSON.parse(fs.readFileSync('prototypes/punchies/asset-patches/materialmask_tee.json'));
  const overlay=records[1].approvedContent.overlay;
  assert.equal(records[0].approvedContent.overlay.maskFallback,'source-resolution palette');
  assert(maskKeys.every(k=>!keys(a).includes(k)&&keys(b).includes(k)),'standard fallback omits mask; compact requires both exact mask files');
  for(const folder of [a,b]){
    const manifestBytes=fs.readFileSync(path.join(folder,'manifest.json'));
    // Overlay provenance hashes the prepared archive, including the two
    // animation indexes embedded by Vite and removed from delivered assets.
    for(const entry of JSON.parse(manifestBytes))assert.equal(hash(fs.readFileSync(path.join(folder,entry.path))),entry.hash,`delivered manifest hash: ${entry.path}`);
  }
  const metadata=JSON.parse(fs.readFileSync(path.join(b,maskKeys[0]))),mask=fs.readFileSync(path.join(b,maskKeys[1]));
  assert.equal(hash(mask),source.sha256);assert.equal(mask.length,source.bytes);
  assert.equal(overlay.maskSha256,source.sha256);assert.equal(overlay.maskBytes,source.bytes);
  for(const key of ['target','dimensions','materialEncodingStep','coverageLevels','bytes','sha256','canonicalBase'])assert.deepEqual(metadata[key],source[key],`reviewed mask metadata: ${key}`);
  const image=await sharp(mask).metadata();assert(image.hasAlpha);assert.deepEqual([image.width,image.height],source.dimensions);
  const compactPortrait=fs.readFileSync(path.join(b,'loose/portrait_tee.webp')),geometry=await sharp(compactPortrait).metadata();
  const prepared={bytes:compactPortrait.length,sha256:hash(compactPortrait),dimensions:[geometry.width,geometry.height]};
  assert.deepEqual(prepared.dimensions,source.dimensions);assert.deepEqual(metadata.preparedBase,prepared);assert.deepEqual(overlay.preparedBase,prepared);
  const standardPortrait=fs.readFileSync(path.join(a,source.canonicalBase.path));
  assert.equal(hash(standardPortrait),source.canonicalBase.sha256);assert.equal(standardPortrait.length,source.canonicalBase.bytes,'standard retains canonical source pixels');
  compactMask=true;
}
assert.deepEqual(keys(a),keys(b).filter(k=>!compactMask||!maskKeys.includes(k)),'same reachable texture and animation keys except verified compact Tee mask');
for(const file of keys(a).filter(file=>file.endsWith('.json')&&file!=='manifest.json'||file.startsWith('loose/part_'))){
  assert(fs.readFileSync(path.join(a,file)).equals(fs.readFileSync(path.join(b,file))),`registration, palette source and aliases retained: ${file}`);
}
console.log('PASS: profiles share texture/animation keys, atlas geometry, mirror aliases and fighter part pixels; approved compact Tee mask and standard canonical fallback verified');
