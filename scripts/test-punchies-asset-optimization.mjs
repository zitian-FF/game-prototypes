import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import mirroredParts from '../prototypes/punchies/art/mirror-parts.mjs';

const root = 'prototypes/punchies/assets-src';
const out = 'public/prototypes/punchies/assets/loose';
const aliases = JSON.parse(fs.readFileSync(path.join(out, 'part-mirrors.json'), 'utf8'));
assert.deepEqual(aliases, await mirroredParts(root));
for (const [name, alias] of Object.entries(aliases)) {
  assert.ok(!fs.existsSync(path.join(out, `${name}.webp`)), 'mirror not downloaded');
  assert.ok(fs.existsSync(path.join(out, `${alias.source}.webp`)), 'canonical part available');
}
let converted = 0;
for (const file of fs.readdirSync(path.join(root, 'loose')).filter(f => f.endsWith('.png'))) {
  const target = path.join(out, `${path.parse(file).name}.webp`);
  if (!fs.existsSync(target)) continue;
  const original = path.join(root, 'loose', file);
  const a = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(a.info, b.info, `${file}: dimensions and channels preserved`);
  for (let i = 0; i < a.data.length; i += 4) {
    assert.equal(a.data[i + 3], b.data[i + 3], `${file}: alpha`);
    if (a.data[i + 3]) assert.ok(a.data.subarray(i, i + 3).equals(b.data.subarray(i, i + 3)), `${file}: visible RGB`);
  }
  assert.ok(fs.statSync(target).size < fs.statSync(original).size, 'conversion saves bytes');
  converted++;
}
console.log(`PASS: ${Object.keys(aliases).length} verified mirror aliases; ${converted} smaller images preserve dimensions, visible pixels and alpha`);
