import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EDITIONS,editionContract,editionTune,editionBuildIdentity} from './punchies-editions.mjs';
const source=JSON.parse(fs.readFileSync('prototypes/punchies/tune.json'));
const before=JSON.stringify(source);
const beta=editionTune(source,'itchbeta');
assert.deepEqual(Object.keys(beta.characters),['marco','mia','bruno','roxy','nadia']);
for(const id of Object.keys(beta.characters))assert.deepEqual(beta.characters[id],source.characters[id]);
assert.equal(JSON.stringify(source),before);
assert.deepEqual(editionContract('crazygames',{allowPreparation:true}).rows.map(row=>row.length),[5,6]);
assert.equal(editionContract('master').fighters.length,11);
assert.throws(()=>editionContract('itchbeta'),/preparation only/);
assert.equal(editionContract('crazygames').fighters.length,11);
assert.throws(()=>editionContract('constructor'),/Unknown/);
assert.throws(()=>editionBuildIdentity('itchbeta','compact','crazygames'),/do not match/);
assert.notEqual(editionContract('master').policyHash,editionContract('itchbeta',{allowPreparation:true}).policyHash);
assert.equal(EDITIONS.defaultEdition,'master');
console.log('Edition contracts: MASTER unchanged; Beta selective tune; CG11 grid; fail-closed preparation gates PASS');

