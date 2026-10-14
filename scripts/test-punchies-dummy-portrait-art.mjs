import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {applyDummyPortrait,DUMMY_PORTRAIT_HASHES} from './punchies-dummy-portrait-art.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'punchies-dummy-portrait-'));
for(const [profile,size] of [['standard',[1100,1166]],['compact',[730,768]]]){
  const dir=path.join(root,profile),loose=path.join(dir,'loose');fs.mkdirSync(loose,{recursive:true});
  const rig=['training_dummy_head.webp','training_dummy_body.webp','training_dummy_glove.webp'];
  for(const name of rig)fs.writeFileSync(path.join(loose,name),`unchanged ${name}`);
  fs.writeFileSync(path.join(loose,'portrait_training_dummy.png'),'rejected portrait');
  const entries=[{path:'loose/portrait_training_dummy.png',hash:'stale'},...rig.map(name=>({path:`loose/${name}`,hash:`keep ${name}`}))];
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(entries));
  const result=applyDummyPortrait(dir,profile);assert.equal(result.hash,DUMMY_PORTRAIT_HASHES[profile]);
  assert(result.bytes<200000,'portrait budget');assert(!fs.existsSync(path.join(loose,'portrait_training_dummy.png')));
  const bytes=fs.readFileSync(path.join(loose,'portrait_training_dummy.webp')),meta=await sharp(bytes).metadata();
  assert.deepEqual([meta.width,meta.height],size);assert(meta.hasAlpha);
  const {data,info}=await sharp(bytes).raw().toBuffer({resolveWithObject:true});
  assert.equal(data[3],0);assert.equal(data[(info.width-1)*4+3],0,'transparent upper margins');
  const after=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
  assert.equal(after.filter(e=>e.path.startsWith('loose/portrait_training_dummy.')).length,1);
  for(const name of rig){assert.equal(fs.readFileSync(path.join(loose,name),'utf8'),`unchanged ${name}`);assert.equal(after.find(e=>e.path===`loose/${name}`).hash,`keep ${name}`);}
  const before=fs.readFileSync(path.join(dir,'manifest.json'));applyDummyPortrait(dir,profile);assert.deepEqual(fs.readFileSync(path.join(dir,'manifest.json')),before);
}
console.log('PASS: dummy portrait profile hashes/dimensions/budget/alpha, stale portrait replacement, unchanged runtime rig and repeatable manifests.');
