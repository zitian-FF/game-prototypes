import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const load=async(options={})=>{
  const bundle=await build({stdin:{contents:`export * from './prototypes/punchies-tuner/src/model'; export * from './prototypes/punchies-tuner/src/fileIO'; export {tune,validateTuneJson} from './prototypes/punchies/src/sim/tune';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,...options});
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const m=await load(),original=m.defaults(),draft=m.defaults();
m.set(draft,'health.max',120);m.set(draft,'punches.jab.damage',6);
assert.equal(m.effective(draft,'mia','core','hp'),102,'Base HP feeds fighter multiplier');
assert.equal(m.effective(draft,'marco','jab','damage'),6*draft.characters.marco.jab.damage);
assert.deepEqual(m.defaults(),original,'Effective calculations must not mutate bundled defaults');
const v1=m.mergeSave(original,draft,original);assert.equal(m.baseVersion(v1),1);
assert.equal(v1.balanceWorkshop.baseHistory.initial['health.max'],100);
assert.deepEqual(v1.balanceWorkshop.baseHistory.versions[0].changes,[{path:'punches.jab.damage',before:4,after:6},{path:'health.max',before:100,after:120}]);
assert.equal(m.baseVersion(m.parse(JSON.stringify(v1))),1,'History survives JSON load');
assert.equal(m.baseVersion(m.mergeSave(v1,v1,v1)),1,'No-op does not add a version');
const fighter=structuredClone(v1);m.set(fighter,'characters.mia.hp',.9);assert.equal(m.baseVersion(m.mergeSave(v1,fighter,v1)),1,'Fighter-only save does not version Base');
const edited=structuredClone(v1);m.set(edited,'health.max',130);const latest=structuredClone(v1);latest.stamina.max=120;
edited.balanceWorkshop.baseHistory.versions=[]; // Client may not rewrite saved log.
const v2=m.mergeSave(v1,edited,latest);assert.equal(m.baseVersion(v2),2);assert.equal(v2.stamina.max,120);assert.deepEqual(v2.balanceWorkshop.baseHistory.versions[1].changes,[{path:'health.max',before:120,after:130}]);
latest.health.max=140;assert.throws(()=>m.mergeSave(v1,edited,latest),/same fields/);assert.equal(m.baseVersion(latest),1);
const broken=structuredClone(v2);broken.balanceWorkshop.baseHistory.versions[1].version=1;assert.throws(()=>m.parse(JSON.stringify(broken)),/Base revision/);
let file=original;const handle={async getFile(){return{text:async()=>JSON.stringify(file)};},async createWritable(){return{async write(text){file=JSON.parse(text);},async close(){},async abort(){}};}};
await m.saveOpened(handle,original,draft);assert.equal(m.baseVersion(file),1,'File save includes history');
let aborts=0;const failed={...handle,async createWritable(){return{async write(){throw Error('Disk failure');},async close(){},async abort(){aborts++;}};}};
await assert.rejects(()=>m.saveOpened(failed,v1,v2),/Disk failure/);assert.equal(aborts,1);assert.equal(m.baseVersion(file),1,'Failed write creates no saved history');
// Emulate a future rebuild with history already in the imported tune.json.
const rebuilt=await load({plugins:[{name:'bundled-history-fixture',setup(builder){builder.onLoad({filter:/[\\/]punchies[\\/]tune\.json$/},()=>({contents:JSON.stringify(v2),loader:'json'}));}}]});
assert.equal(rebuilt.tune.balanceWorkshop,undefined,'History excluded from simulation object');
assert.equal(rebuilt.validateTuneJson(JSON.stringify(v2)).ok,true,'Game validates a saved history-bearing tune after rebuild');
assert.equal(rebuilt.baseVersion(rebuilt.parse(JSON.stringify(original))),0,'Workshop still accepts older history-free files after rebuild');
assert.deepEqual(original,JSON.parse(await readFile('prototypes/punchies/tune.json','utf8')),'Real tuning unchanged');
console.log('PASS: raw Base inheritance, versioned previous values, roundtrip, no-op/fighter-only, concurrency, failed saves, immutable log and history-bearing rebuild compatibility');
