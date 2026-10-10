import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const PALETTES=JSON.parse(fs.readFileSync('prototypes/punchies/src/render/paletteCatalog.ts','utf8').split('= ')[1].replace(/;\s*$/,''));
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/skinPalette.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>({PALETTES})});
const output=process.argv[2];if(output)fs.mkdirSync(output,{recursive:true});
const root='public/prototypes/punchies/assets/loose';
const mirrorPath=`${root}/part-mirrors.json`;
const mirrors=fs.existsSync(mirrorPath)?JSON.parse(fs.readFileSync(mirrorPath,'utf8')):{};
for(const char of ['marco','mia','bruno']){
 for(const name of [`portrait_${char}`,`part_${char}_head`,`part_${char}_torso`,`part_${char}_glove_left`,`part_${char}_glove_right`]){
  const mirror=mirrors[name],source=mirror?.source??name;
  const file=fs.readdirSync(root).find(f=>f===source+'.png'||f===source+'.webp');assert.ok(file, name);
  let image=sharp(`${root}/${file}`);
  if(mirror)image=mirror.axis==='x'?image.flop():image.flip();
  const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const pixels=new Uint8ClampedArray(data);exports.recolourStarter(pixels,char,name,info.width,info.height);
  let changed=0;for(let i=0;i<data.length;i+=4){assert.equal(pixels[i+3],data[i+3],'alpha preserved');if(pixels[i]!==data[i]||pixels[i+1]!==data[i+1]||pixels[i+2]!==data[i+2])changed++;}
  assert.ok(changed>0,name+' recoloured');
  if(output)await sharp(Buffer.from(pixels),{raw:info}).png().toFile(`${output}/${name}.png`);
 }
}
assert.equal(exports.limbSkin('marco','skin-marco-cyan',0xf0a060),0xf0a060);
assert.equal(exports.limbSkin('bruno','skin-bruno-gold',0xee9a62),0xc57b47);
console.log('PASS: all starter portraits/parts recoloured, alpha preserved, runtime limb tones consistent');
