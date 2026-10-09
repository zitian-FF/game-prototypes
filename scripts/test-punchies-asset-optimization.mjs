import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import mirroredParts from '../prototypes/punchies/art/mirror-parts.mjs';
const root='prototypes/punchies/assets-src', out='public/prototypes/punchies/assets';
// Read the real catalogs without launching esbuild or loading gameplay/portal services.
function catalog(file, require = () => { throw new Error(`Unexpected catalog import in ${file}`); }) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require });
  return exports;
}
const { CHARACTER_IDS } = catalog('prototypes/punchies/src/sim/character.ts', () => ({}));
const palettes = catalog('prototypes/punchies/src/render/paletteCatalog.ts');
const { SHOP_ITEMS } = catalog('prototypes/punchies/src/shop/draft.ts', id => {
  if (id === '../render/paletteCatalog') return palettes;
  if (id === './draft-config.json') return { default: JSON.parse(fs.readFileSync('prototypes/punchies/src/shop/draft-config.json', 'utf8')) };
  if (id === '../portal/store') return {};
  if (id === '../portal/keys') return catalog('prototypes/punchies/src/portal/keys.ts');
  throw new Error(`Unexpected shop catalog import: ${id}`);
});
const uniqueSkins = SHOP_ITEMS.filter(item => item.skinType === 'unique' && !item.artPending);
const rigs = new Set([...CHARACTER_IDS, ...uniqueSkins.map(item => item.rigGroup)]);
const aliases=JSON.parse(fs.readFileSync(path.join(out,'loose/part-mirrors.json')));
assert.deepEqual(aliases,await mirroredParts(root),'all approved mirror mappings survive master archival');
for(const [name,alias] of Object.entries(aliases)){
  const match = /^part_(.+)_(glove|boot)_left$/.exec(name);
  assert(match && rigs.has(match[1]), `mirror belongs to a catalog rig limb: ${name}`);
  assert.equal(alias.source, `part_${match[1]}_${match[2]}_right`, `same-rig opposite limb: ${name}`);
  assert(['x', 'y'].includes(alias.axis), `supported mirror axis: ${name}`);
  assert(!aliases[alias.source], `mirror source is a direct texture: ${name}`);
  for (const ext of ['.png', '.webp']) assert(!fs.existsSync(path.join(out,'loose',name+ext)), `mirrored target is deduplicated: ${name}`);
  const file = path.join(out,'loose',`${alias.source}.webp`);
  assert(fs.existsSync(file), `mirror source shipped: ${name}`);
  const transform = alias.axis === 'x' ? 'flop' : 'flip';
  const source = await sharp(path.join(root,'loose',`${alias.source}.webp`))[transform]().ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const target = await sharp(file)[transform]().ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual(target.info, source.info, `mirrored dimensions preserved: ${name}`);
  for (let i=0;i<source.data.length;i+=4) {
    assert.equal(target.data[i+3], source.data[i+3], `mirrored alpha preserved: ${name}`);
    if (source.data[i+3]>0) for (let channel=0;channel<3;channel++) assert.equal(target.data[i+channel], source.data[i+channel], `visible mirrored pixels preserved: ${name}`);
  }
}
for(const char of rigs){
  for(const part of ['head','torso','glove_left','glove_right','boot_left','boot_right']){
    const key=`part_${char}_${part}`;
    assert(aliases[key]||fs.existsSync(path.join(out,'loose',`${key}.webp`)),`complete rig: ${key}`);
  }
}
for (const key of [...CHARACTER_IDS.map(char => `portrait_${char}`), ...uniqueSkins.map(item => item.portraitKey)]) {
  assert(fs.existsSync(path.join(out,'loose',`${key}.webp`)), `catalog portrait shipped: ${key}`);
}
for(const file of fs.readdirSync(path.join(out,'loose')).filter(f=>f.startsWith('portrait_'))){
  const image=await sharp(path.join(out,'loose',file)).metadata();
  assert(image.hasAlpha,'portrait transparency retained');
  assert(Math.max(image.width,image.height)<=1280,'portrait screen-resolution cap');
  assert(fs.statSync(path.join(out,'loose',file)).size<1_000_000,'portrait transfer budget');
}
for(const key of ['arena_floor','arena_rear','arena_front','arena_near','arena_apron']){
  const file=fs.readdirSync(path.join(root,'loose')).find(f=>path.parse(f).name===key);
  const source=await sharp(path.join(root,'loose',file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const target=await sharp(path.join(out,'loose',`${key}.webp`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(source.info.width,1299);assert.equal(source.info.height,1211);
  assert.deepEqual(source.info,target.info);
  for(let i=0;i<source.data.length;i+=4){
    assert.equal(source.data[i+3],target.data[i+3],'ring alpha unchanged');
    if(source.data[i+3]>0)for(let channel=0;channel<3;channel++)assert.equal(source.data[i+channel],target.data[i+channel],'visible ring pixels unchanged');
  }
}
for(const file of fs.readdirSync(path.join(out,'atlas')).filter(f=>/^atlas.*\.json$/.test(f))){
  const atlas=JSON.parse(fs.readFileSync(path.join(out,'atlas',file)));
  for(const texture of atlas.textures??[]){
    assert(texture.image.endsWith('.webp'));assert(fs.existsSync(path.join(out,'atlas',texture.image)));
    const meta=await sharp(path.join(out,'atlas',texture.image)).metadata();
    assert(meta.width<=2048&&meta.height<=2048);
    assert.equal(meta.width,texture.size.w);assert.equal(meta.height,texture.size.h);
  }
}
console.log(`PASS: ${CHARACTER_IDS.length} fighter and ${uniqueSkins.length} approved unique-skin rigs/portraits, ${Object.keys(aliases).length} approved aliases with lossless mirror pixels, portrait budget, registered lossless ring and portable WebP atlases`);
