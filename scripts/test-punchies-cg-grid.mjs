import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const master=['marco','mia','bruno','tee','tyke','dragon','longan','captain','roxy','nadia','kai'];
const cg=['marco','mia','bruno','roxy','nadia','tee','tyke','dragon','longan','captain','kai'];
function layout(enabled,ids){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/ui/rosterLayout.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:key=>key.includes('edition')?{CRAZYGAMES_EDITION:enabled}:{CHARACTER_IDS:ids}});return exports;}
const m=layout(false,master),c=layout(true,cg);
assert.equal(m.rosterSlots().length,30);assert.equal(m.rosterIds()[0],'tee');assert.equal(JSON.stringify(m.rosterIds().slice(3,8)),JSON.stringify(['marco','mia','bruno','roxy','nadia']));
const positions=c.rosterSlots(),ids=c.rosterIds();assert.equal(positions.length,11);assert.equal(JSON.stringify(ids),JSON.stringify(cg));
assert.equal(positions.filter(p=>p.y===172).length,5);assert.equal(positions.filter(p=>p.y===252).length,6);
for(const row of [172,252]){const p=positions.filter(p=>p.y===row);assert.equal((p[0].x+p.at(-1).x)/2,422);}
for(const width of [640,768,1024]){const g=c.rosterCardGeometry(),scale=width/844;assert(g.hitWidth*scale>=44);assert(g.hitHeight*scale>=44);
 for(const p of positions){assert(p.x-g.hitWidth/2>218);assert(p.x+g.hitWidth/2<626);assert(p.y-g.hitHeight/2>98);assert(p.y+g.hitHeight/2<331);}
}
assert.equal(c.horizontalRosterPick(0,-1),4);assert.equal(c.horizontalRosterPick(4,1),0);assert.equal(c.horizontalRosterPick(5,-1),10);assert.equal(c.horizontalRosterPick(10,1),5);
for(let i=0;i<11;i++)for(const d of [-1,1]){const h=c.horizontalRosterPick(i,d),v=c.verticalRosterPick(i,d);assert(h>=0&&h<11);assert(v>=0&&v<11);assert.equal(positions[h].y,positions[i].y);if((i<5&&d===1)||(i>=5&&d===-1))assert.notEqual(positions[v].y,positions[i].y);else assert.equal(v,i);}
const exp={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/portraitHeadshots.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exp});
for(const id of cg){const crop=exp.headshotCrop(id,640,768,'',44/42);assert(crop.x>=0&&crop.y>=0);assert(crop.x+crop.width<=640&&crop.y+crop.height<=768);assert(Math.abs(crop.width/crop.height-44/42)<.006,'new card crop retains aspect');}
console.log('PASS CG exact5+6 order, centered rows, touch hit areas at640, panel/CTA gaps, row navigation, portrait crop aspect; Master30 slots unchanged');
