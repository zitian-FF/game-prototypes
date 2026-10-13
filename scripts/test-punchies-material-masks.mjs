import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import sharp from 'sharp';import assert from 'node:assert/strict';
function load(name){const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:e,require:p=>load(p.slice(2))});return e;}
const {recolourPalette}=load('skinPalette'),{PALETTES}=load('paletteCatalog'),{portraitRegion}=load('materialMasks');
let checks=0;
for(const [id,p] of Object.entries(PALETTES)){
 const head=await sharp('public/prototypes/punchies/assets/loose/part_'+p.boxer+'_head.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});const pixels=new Uint8ClampedArray(head.data);recolourPalette(pixels,p.boxer,id,'part_'+p.boxer+'_head',head.info.width,head.info.height);
 if(['tyke','longan'].includes(p.boxer))assert.deepEqual(Buffer.from(pixels),head.data,p.boxer+' head hair/skin/tattoos must not become gear colours');
 if(p.boxer==='marco'||p.boxer==='mia')for(let y=Math.ceil(head.info.height*.3);y<head.info.height*.66;y++)for(let x=Math.ceil(head.info.width*.9);x<head.info.width;x++){const i=(y*head.info.width+x)*4;const [r,g,b]=head.data.slice(i,i+3);if(r>g&&g>b&&r>60&&head.data[i+3]>200)assert.deepEqual(Array.from(pixels.slice(i,i+4)),Array.from(head.data.slice(i,i+4)),'exposed face preserved');}
 const portrait=await sharp('public/prototypes/punchies/assets/loose/portrait_'+p.boxer+'.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});const result=new Uint8ClampedArray(portrait.data);recolourPalette(result,p.boxer,id,'portrait_'+p.boxer,portrait.info.width,portrait.info.height);
 if(p.boxer==='mia')for(let y=0;y<portrait.info.height;y++)for(let x=0;x<portrait.info.width;x++){const i=(y*portrait.info.width+x)*4;const [r,g,b]=portrait.data.slice(i,i+3);if(portraitRegion('mia','skin',(x+.5)/portrait.info.width,(y+.5)/portrait.info.height)&&r>g&&g>b&&r>70&&g/r>.5&&g/r<.85)assert.deepEqual(Array.from(result.slice(i,i+4)),Array.from(portrait.data.slice(i,i+4)),'Mia shoulder skin protected from hair dye');}
 checks++;
}
console.log('PASS: '+checks+' palettes protect bald skin/tattoos, brown hair, exposed head faces and Mia shoulder skin');
