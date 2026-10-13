import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';
const root=path.join(process.argv[2],'prototypes/punchies');
const profile=JSON.parse(fs.readFileSync(path.join(root,'asset-profile.json')));
const overlay=profile.staging?profile.stageArtOverlay:profile.approvedContent?.overlay;assert(overlay?.kai,'Kai provenance must be recorded');
const files=overlay.kai.files;assert.equal(files.length,6);
for(const file of files){
 const bytes=fs.readFileSync(path.join(root,'assets',file.path));
 assert.equal(bytes.length,file.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
 const image=await sharp(bytes).metadata();assert(image.hasAlpha);
 if(file.path.endsWith('portrait_kai.webp'))assert(Math.max(image.width,image.height)<=768);
 if(file.path.endsWith('kai_emblems.webp'))assert.deepEqual([image.width,image.height],[256,64]);
}
const aliases=JSON.parse(fs.readFileSync(path.join(root,'assets/loose/part-mirrors.json')));
assert.deepEqual(aliases.part_kai_glove_left,{source:'part_kai_glove_right',axis:'y'});
assert.deepEqual(aliases.part_kai_boot_left,{source:'part_kai_boot_right',axis:'y'});
console.log('PASS delivered Kai stage files: exact canonical hashes/alpha/portrait limit/badge registration and mirror aliases');
