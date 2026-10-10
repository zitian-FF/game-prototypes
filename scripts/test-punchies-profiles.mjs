import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const [directory,profile]=process.argv.slice(2);
assert(['standard','compact'].includes(profile));
assert(fs.existsSync(path.join(directory,'index.html')),'portal package has a root entry point');
const root=path.join(directory,'prototypes/punchies'),record=JSON.parse(fs.readFileSync(path.join(root,'asset-profile.json')));
assert.equal(record.profile,profile);
const audio=fs.readdirSync(path.join(root,'audio'));
for(const track of ['title','charselect','gameplay']){
  assert(audio.includes(`${track}.${record.musicExtension}`));
  assert(!audio.includes(`${track}.${profile==='compact'?'mp3':'m4a'}`),'only selected encoding ships');
}
for(const entry of JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json')))){
  const file=path.join(root,'assets',entry.path);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),entry.hash);
  if(/\/portrait_/.test(entry.path)){const meta=await sharp(file).metadata();assert(meta.hasAlpha);assert(Math.max(meta.width,meta.height)<=(profile==='compact'?768:1280));}
}
const loose=path.join(root,'assets/loose'),aliases=JSON.parse(fs.readFileSync(path.join(loose,'part-mirrors.json')));
for(const char of ['marco','mia','bruno','tee','tyke','dragon','longan','captain','marco_mcclassic','mia_flaming_kunoichi','marco_rising_star'])for(const part of ['head','torso','glove_left','glove_right','boot_left','boot_right'])assert(aliases[`part_${char}_${part}`]||fs.existsSync(path.join(loose,`part_${char}_${part}.webp`)));
assert(fs.statSync(path.join(loose,'portrait_marco_rising_star.webp')).size<(profile==='compact'?100000:200000));
for(const part of ['glove','boot']){
  assert.equal(aliases[`part_marco_rising_star_${part}_left`].axis,'y');
  assert(!fs.existsSync(path.join(loose,`part_marco_rising_star_${part}_left.webp`)),'mirrored copies do not ship');
}
let size;
for(const layer of ['arena_floor','arena_rear','arena_front','arena_near','arena_apron']){
  const meta=await sharp(path.join(loose,`${layer}.webp`)).metadata();
  if(size)assert.deepEqual([meta.width,meta.height],size);else size=[meta.width,meta.height];
}
assert.equal(size[0],profile==='compact'?960:1299);
console.log(`PASS: ${profile} inventory hashes, exclusive music, portraits, complete rigs and matching ring registration`);
