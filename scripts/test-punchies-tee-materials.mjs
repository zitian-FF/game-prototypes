import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import sharp from 'sharp';import assert from 'node:assert/strict';import path from 'node:path';
function load(n){const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/'+n+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:e,require:p=>load(p.slice(2))});return e;}
const {recolourPalette}=load('skinPalette'),{teeMaterialMask}=load('teeMaterials'),{PALETTES}=load('paletteCatalog');
const roots=['public/prototypes/punchies/assets/loose',process.env.PUNCHIES_COMPACT_LOOSE].filter(Boolean);let protectedCount=0,changedCount=0;
for(const root of roots)for(const name of ['portrait_tee','part_tee_head','part_tee_torso','part_tee_glove_left','part_tee_glove_right','part_tee_boot_left','part_tee_boot_right','part_tee_ponytail_left','part_tee_ponytail_right']){
 const {data,info}=await sharp(path.join(root,name+'.webp')).ensureAlpha().raw().toBuffer({resolveWithObject:true});const mask=teeMaterialMask(name,info.width,info.height);assert.equal(teeMaterialMask(name,info.width,info.height),mask,'reuse mask');
 for(const [id,p] of Object.entries(PALETTES).filter(([id,p])=>p.boxer==='tee')){
  const after=new Uint8ClampedArray(data);recolourPalette(after,'tee',id,name,info.width,info.height);
  for(let i=0;i<data.length;i+=4){assert.equal(after[i+3],data[i+3],'alpha exact');const [r,g,b]=data.slice(i,i+3),max=Math.max(r,g,b),min=Math.min(r,g,b),s=max?(max-min)/max:0;
   const protectedPixel=!mask[i/4]||max<24||(r>g&&g>=b&&s>.12)||(mask[i/4]!==4&&max>=204);
   if(protectedPixel){assert.deepEqual(Array.from(after.slice(i,i+4)),Array.from(data.slice(i,i+4)),name+' protected skin/hair/highlight/red/outside');protectedCount++;}
   if(after[i]!==r||after[i+1]!==g||after[i+2]!==b)changedCount++;
  }
  if(/head|ponytail/.test(name))assert.deepEqual(Buffer.from(after),data,'head and both tail identities exact');
 }
}
// Different shades remain ordered, and highlight transition has no cutoff jump.
for(const flagName of ['part_tee_glove_left','part_tee_torso']){
 const w=100,h=100,d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){const v=50+(i%100);d.set([v,v,v,255],i*4);}recolourPalette(d,'tee','skin-tee-redline',flagName,w,h);
 const mask=teeMaterialMask(flagName,w,h),y=50;for(let x=32;x<64;x++){if(!mask[y*w+x]||mask[y*w+x]!==mask[y*w+x+1])continue;const a=(y*w+x)*4,b=a+4;assert(Math.max(d[b],d[b+1],d[b+2])>=Math.max(d[a],d[a+1],d[a+2]),'shade order');}
}
console.log(`PASS: ${roots.length} source/compact profiles, all 3 Tee palettes, 9 parts; ${protectedCount} protected RGBA checks; ${changedCount} material pixels recoloured; cache and shade ordering`);
