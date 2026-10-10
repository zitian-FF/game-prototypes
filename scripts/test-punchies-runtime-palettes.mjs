import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=(file,scope)=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,...scope});return exports;};
const PALETTES=JSON.parse(fs.readFileSync('prototypes/punchies/src/render/paletteCatalog.ts','utf8').split('= ')[1].replace(/;\s*$/,''));
const palette=load('prototypes/punchies/src/render/skinPalette.ts',{require:p=>p.includes('materialMasks')?(()=>{const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/materialMasks.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:e});return e;})():({PALETTES})});
const items=['marco','mia','bruno'].map((char,i)=>({id:palette.STARTER_SKINS[i],boxer:char,skinType:'palette',accent:0x16cde3}));
items.push({id:'unique',boxer:'mia',skinType:'unique',portraitKey:'portrait_unique',rigGroup:'unique'});
let draws=0,created=0;
const original=new Uint8ClampedArray([30,100,230,255,250,240,220,255,8,10,20,255,0,0,0,0]);
const textures=new Map();
const context={drawImage(){draws++;},getImageData(){return{data:new Uint8ClampedArray(original)};},putImageData(p){this.data=p.data;}};
const scene={textures:{exists:k=>textures.has(k),get:k=>({getSourceImage:()=>textures.get(k)}),addCanvas:(k,c)=>textures.set(k,c)}};
const skins=load('prototypes/punchies/src/render/skins.ts',{document:{createElement:()=>{created++;return{width:0,height:0,getContext:()=>context};}},require:p=>p==='phaser'?{default:{Display:{Color:{IntegerToColor:()=>({red:0,green:0,blue:0}),RGBToHSV:()=>({h:0})}}}}:p.includes('skinPalette')?palette:{skinItem:(char,id)=>items.find(i=>i.boxer===char&&i.id===id)}});
for(const item of items.filter(i=>i.skinType==='palette')){
 const name='portrait_'+item.boxer,base='punchies:'+name;textures.set(base,{width:4,height:1});
 const key=skins.skinTexture(scene,item.boxer,item.id,name);assert.notEqual(key,base);const count=created;
 assert.equal(skins.skinTexture(scene,item.boxer,item.id,name),key);assert.equal(created,count,'cached: no new canvas');
 assert.equal(skins.skinTexture(scene,item.boxer,'default',name),base);
 for(let i=3;i<original.length;i+=4)assert.equal(context.data[i],original[i],'alpha preserved');
 assert.deepEqual(Array.from(context.data.slice(8,12)),Array.from(original.slice(8,12)),'dark outline preserved');
}
assert.equal(draws,3);
textures.set('punchies:portrait_unique',{});assert.equal(skins.skinTexture(scene,'mia','unique','portrait_mia'),'punchies:portrait_unique');assert.equal(created,3,'unique art never recoloured');
const manifest=JSON.parse(fs.readFileSync('public/prototypes/punchies/assets/manifest.json','utf8'));
assert(!manifest.some(f=>/_(marco|mia|bruno)_alt|atlas-(marco|mia|bruno)_alt/.test(f.path)),'no duplicate palette textures shipped');
const groups=JSON.parse(fs.readFileSync('public/prototypes/punchies/assets/atlas/groups.json','utf8'));
assert(!Object.keys(groups).some(k=>k.endsWith('_alt')));
console.log('PASS: palette textures cached, source/alpha/outlines retained, unique skins untouched; duplicate palette atlases absent');

const art=load('prototypes/punchies/src/render/art.ts',{__PUNCHIES_ART__:{manifest:[],animations:{},groups:{}},__PUNCHIES_ASSET_BASE__:'/',require:p=>p==='phaser'?{default:{Scene:class{}}}:p.includes('sim/character')?{isCharId:c=>['marco','mia','bruno','tee','tyke','dragon'].includes(c)}:{}});
assert.deepEqual(Array.from(art.fighterGroups(['mia','mia'])),['mia'],'mirror match shares one base atlas group');
assert.deepEqual(Array.from(art.fighterGroups(['marco','bruno'])),['marco','bruno']);
