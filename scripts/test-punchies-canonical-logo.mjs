import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {applyCanonicalLogo,LOGO_HASHES} from './punchies-logo-art.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'punchies-logo-'));
for (const [profile,size] of [['standard',[924,290]],['compact',[462,145]]]) {
  const dir=path.join(root,profile),loose=path.join(dir,'loose');fs.mkdirSync(loose,{recursive:true});
  fs.writeFileSync(path.join(loose,'logo.png'),'stale wordmark');
  fs.writeFileSync(path.join(loose,'punch_logo.webp'),'unrelated glove icon');
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify([{path:'loose/logo.png',hash:'stale'},{path:'loose/logo.webp',hash:'stale'},{path:'loose/punch_logo.webp',hash:'keep'}]));
  const result=applyCanonicalLogo(dir,profile);
  assert.equal(result.hash,LOGO_HASHES[profile]);
  assert(!fs.existsSync(path.join(loose,'logo.png')));
  assert.equal(fs.readFileSync(path.join(loose,'punch_logo.webp'),'utf8'),'unrelated glove icon');
  const entries=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  assert.equal(entries.filter(e=>/^loose\/logo\./.test(e.path)).length,1);
  assert.equal(entries.find(e=>e.path==='loose/punch_logo.webp').hash,'keep');
  const meta=await sharp(fs.readFileSync(path.join(loose,'logo.webp'))).metadata();assert.deepEqual([meta.width,meta.height],size);assert(meta.hasAlpha);
  const before=fs.readFileSync(path.join(dir,'manifest.json'));
  applyCanonicalLogo(dir,profile);assert.deepEqual(fs.readFileSync(path.join(dir,'manifest.json')),before,'idempotent');
  const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(loose,'logo.webp'))).digest('hex');assert.equal(hash,result.hash);
}
const inMemory=[{path:'loose/logo.png',hash:'stale'}];
applyCanonicalLogo(path.join(root,'memory'),'compact',inMemory);
assert.deepEqual(inMemory,[{path:'loose/logo.webp',hash:LOGO_HASHES.compact}]);
assert.throws(()=>applyCanonicalLogo(root,'unknown'),/Unknown logo profile/);
console.log('PASS: canonical profiles override stale archives, one texture registration, hash/dimension checks, glove icon preserved and repeatable manifests.');
