import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['prototypes/punchies-tuner/src/model.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {defaults,parse,changes,set,effective,delta,mergeSave,characters,names,meta}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const base=defaults(),draft=defaults();
assert.equal(effective(base,'marco','core','stamina'),110.00000000000001);
assert.equal(effective(base,'mia','core','hp'),85);
assert.equal(delta(85,100),'-15.0%');assert.equal(delta(120,100),'+20.0%');assert.equal(delta(0,0),'0%');assert.equal(delta(2,0),'— (Marco = 0)');
assert.equal(effective(base,'mia','jab','startup'),3);
assert.equal(effective(base,'marco','uppercut','damage'),20);
assert(Math.abs(effective(base,'mia','jab','reach')-42*.9*1.25*.88)<1e-9);
set(draft,'characters.mia.hp',.9);assert.deepEqual(changes(base,draft),['characters.mia.hp']);
const latest=defaults();latest.view.headOffsetY=-3;latest.localisationFuture={preserve:true};
const merged=mergeSave(base,draft,latest);assert.equal(merged.characters.mia.hp,.9);assert.equal(merged.view.headOffsetY,-3);assert.deepEqual(merged.localisationFuture,{preserve:true});
latest.characters.mia.hp=.8;assert.throws(()=>mergeSave(base,draft,latest),/same fields/);
latest.characters.mia.hp=.9;assert.equal(mergeSave(base,draft,latest).characters.mia.hp,.9);
assert.throws(()=>set(draft,'characters.mia.hp',NaN));assert.throws(()=>set(draft,'characters.mia.hp',999));
const partial=defaults();delete partial.characters.mia.hp;assert.throws(()=>parse(JSON.stringify(partial)),/Missing/);
assert.throws(()=>parse('alert(1)'),/JSON/);
assert.deepEqual(defaults(),base,'source tune is unchanged');
console.log('PASS: effective stats, actual punch formulas, signed Marco deltas, validation, selective merging, same-field conflicts and preserved unknown fields');


assert.deepEqual(characters,['marco','mia','bruno','tee','tyke','dragon','longan']);
for(const id of characters){assert(names[id]?.name);for(const key of ['hp','stamina','stun','speed','regen']){assert(meta['characters.'+id+'.'+key]);assert(Number.isFinite(effective(base,id,'core',key)));}}
const longan=defaults();set(longan,'characters.longan.hp',.9);assert.equal(effective(longan,'longan','core','hp'),90);assert.equal(effective(base,'longan','core','hp'),100);
console.log('PASS: seven-fighter roster matches game; metadata and editable Longan baseline available');

for(const p of ['jab','cross','hook','uppercut']){assert(meta['punches.'+p+'.counterWhiff']);assert(!meta['punches.'+p+'.counterRecovery']);assert(Number.isFinite(effective(base,'bruno',p,'hitStun')));}
assert.equal(effective(base,'bruno','cross','hitStun'),Math.round(base.punches.cross.hitStun*base.characters.bruno.cross.push));
assert(meta['movement.lockMoveMult']);assert(!meta['hit.pushLockFrames']);
console.log('PASS: current counter keys, push-derived hit stun and movement lock metadata');
