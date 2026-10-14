import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {editionContract} from './punchies-editions.mjs';
async function runtime(name,staging=false){
 const edition=editionContract(name,{allowPreparation:true});
 const result=await build({stdin:{contents:`export * from './prototypes/punchies/src/edition'; export {CHARACTER_IDS,isCharId} from './prototypes/punchies/src/sim/character'; export {KEYS} from './prototypes/punchies/src/portal/keys'; export {simulationRules,sameRules} from './prototypes/punchies/src/net/rules';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,define:{__PUNCHIES_EDITION__:JSON.stringify(name),__PUNCHIES_EDITION_FIGHTERS__:JSON.stringify(edition.fighters),__PUNCHIES_EDITION_POLICY_HASH__:JSON.stringify(edition.policyHash),__PUNCHIES_EDITION_NAMESPACE__:JSON.stringify(edition.storageNamespace),__PUNCHIES_STAGING__:JSON.stringify(staging)}});
 return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const master=await runtime('master'),cg=await runtime('crazygames'),stage=await runtime('crazygames',true);
assert.equal(master.KEYS.profile,'punchies:profile:v1');
assert.equal(cg.KEYS.profile,'punchies:crazygames:profile:v1');
assert.equal(stage.KEYS.profile,'punchies:staging:crazygames:profile:v1');
assert.deepEqual(cg.CHARACTER_IDS,['marco','mia','bruno','roxy','nadia','tee','tyke','dragon','longan','captain','kai']);
assert.equal(cg.isCharId('zombie'),false);
assert(cg.CHARACTER_IDS.every(cg.isCharId));
assert.equal(cg.sameRules(master.simulationRules()),false);
assert.equal(master.sameRules(cg.simulationRules()),false);
assert.equal(cg.sameRules(stage.simulationRules()),true);
assert.equal(cg.CRAZYGAMES_EDITION,true);
console.log('PASS compiled CG11 runtime order, MASTER key preservation, CG/stage save isolation and cross-edition online rejection');
