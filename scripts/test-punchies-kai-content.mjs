import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const tune=JSON.parse(fs.readFileSync('prototypes/punchies/tune.json','utf8'));
function loader(staging){const cache={};function load(n){if(cache[n])return cache[n];const e={};cache[n]=e;
 const resolve=p=>{const a=n.split('/');a.pop();for(const q of p.split('/'))if(q==='..')a.pop();else if(q!=='.')a.push(q);return a.join('/');};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/'+n+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports:e,require:p=>{
 if(p.endsWith('/tune'))return {tune};if(p.endsWith('/buildFlags'))return {STAGING_BUILD:staging,stagingStorageKey:x=>x};if(p.endsWith('/i18n'))return {t:x=>x,tOr:(_x,f)=>f};
 if(p.endsWith('/portal/store'))return {store:{getItem:()=>null,setItem(){}}};if(p.endsWith('/skinPalette'))return {STARTER_SKINS:[]};
 const r=resolve(p);if(r.endsWith('.json'))return JSON.parse(fs.readFileSync('prototypes/punchies/src/'+r,'utf8'));return load(r);
 }});return e;}return load;}
for(const staging of [true,false]){const load=loader(staging),c=load('sim/character'),d=load('shop/draft'),r=load('shop/roster'),layout=load('ui/rosterLayout');
 assert.equal(c.isCharId('kai'),staging);assert.equal(c.CHARACTER_IDS.includes('kai'),staging);
 const items=d.SHOP_ITEMS.filter(i=>i.boxer==='kai');assert.equal(items.length,4);assert(items.every(i=>i.earnOnly&&i.artPending===!staging));
 const s={...d.newShopDraft(),owned:items.map(i=>i.id)};assert.equal(r.availableFighters(s).includes('kai'),staging);assert.equal(r.ownedSkins(s,'kai').length,staging?4:1);
 for(const k of ['skins','fighters'])assert(!d.availablePool(d.newShopDraft(),k).some(i=>i.boxer==='kai'));
 assert.equal(layout.rosterIds()[29],staging?'kai':null);assert.equal(new Set(layout.rosterIds().filter(Boolean)).size,c.CHARACTER_IDS.length);
 if(staging){assert.equal(c.maxHealth({char:'kai'}),85);assert.equal(c.maxStamina({char:'kai'}),95);assert.equal(c.moveSpeed({char:'kai'}),117);assert.equal(c.uppercutStars('kai'),2);}
}
assert.equal(tune.body.proportions.kai,.9);assert.equal(tune.characters.kai.hook.freeUses,6);assert.equal(tune.characters.kai.dodge.iFramesMult,1.25);
console.log('PASS Kai: staging-only runtime/restore gating, four earn-only ready rewards, no chest pools, slot29, exact draft HP/STM/movement/stars/proportion');
