import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import mirroredParts from '../prototypes/punchies/art/mirror-parts.mjs';
const root='prototypes/punchies/assets-src', out='public/prototypes/punchies/assets';
const aliases=JSON.parse(fs.readFileSync(path.join(out,'loose/part-mirrors.json')));
assert.deepEqual(aliases,await mirroredParts(root));
assert.equal(Object.keys(aliases).length,10,'all approved mirrors survive master archival');
for(const [name,alias] of Object.entries(aliases)){
  assert(!fs.existsSync(path.join(out,'loose',`${name}.webp`)));
  assert(fs.existsSync(path.join(out,'loose',`${alias.source}.webp`)));
}
for(const char of ['marco','mia','bruno','tee','tyke','dragon','longan','marco_mcclassic','mia_flaming_kunoichi']){
  for(const part of ['head','torso','glove_left','glove_right','boot_left','boot_right']){
    const key=`part_${char}_${part}`;
    assert(aliases[key]||fs.existsSync(path.join(out,'loose',`${key}.webp`)),`complete rig: ${key}`);
  }
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
console.log('PASS: complete seven-fighter and unique-skin rigs, ten aliases, portrait budget, registered lossless ring and portable WebP atlases');
