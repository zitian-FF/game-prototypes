import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const load=(file,require)=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require});return exports;};
const catalog=load('prototypes/punchies/src/render/paletteCatalog.ts');
const palette=load('prototypes/punchies/src/render/skinPalette.ts',p=>p.includes('materialMasks')?load('prototypes/punchies/src/render/materialMasks.ts'):catalog);
const chars=['marco','mia','bruno','tee','tyke','dragon','longan'];
for(const char of chars)assert.equal(Object.values(catalog.PALETTES).filter(p=>p.boxer===char).length,3);
assert.equal(Object.keys(catalog.PALETTES).length,21);
const root='public/prototypes/punchies/assets/loose';
const mirrors=JSON.parse(fs.readFileSync(root+'/part-mirrors.json','utf8'));
let checks=0;
for(const [id,p]of Object.entries(catalog.PALETTES))for(const part of ['portrait','head','torso','glove_left','glove_right','boot_left','boot_right']){
 const name=part==='portrait'?'portrait_'+p.boxer:'part_'+p.boxer+'_'+part,alias=mirrors[name],source=alias?.source??name;
 const file=fs.readdirSync(root).find(f=>f===source+'.webp'||f===source+'.png');assert(file,name);
 let image=sharp(root+'/'+file);if(alias)image=alias.axis==='x'?image.flop():image.flip();
 const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});const pixels=new Uint8ClampedArray(data);
 palette.recolourPalette(pixels,p.boxer,id,name,info.width,info.height);
 for(let i=0;i<data.length;i+=4){assert.equal(pixels[i+3],data[i+3]);if(Math.max(data[i],data[i+1],data[i+2])<40)assert.deepEqual(Array.from(pixels.slice(i,i+4)),Array.from(data.slice(i,i+4)),'outline retained');}
 if(part==='portrait')assert(pixels.some((v,i)=>i%4!==3&&v!==data[i]),id+' visible recolour');checks++;
}
const en=JSON.parse(fs.readFileSync('prototypes/punchies/src/i18n/locales/en.json','utf8'));for(const id of Object.keys(catalog.PALETTES))assert(en['shop.item.'+id+'.name']);
console.log('PASS: 21 catalog skins; '+checks+' portrait/rig recolours retain dimensions, alpha and dark outlines; localized names');
