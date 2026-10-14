import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.transpileModule(fs.readFileSync('prototypes/punchies/src/portal/community.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
for(const id of ['web','crazygames','poki','playgama']){
  const exports={},calls=[],opened={opener:'previous window'};
  vm.runInNewContext(source,{exports,require:()=>({portal:{id}}),window:{open:(...args)=>{calls.push(args);return opened;}}});
  assert.equal(calls.length,0,'import must not open an external page');
  const allowed=id==='web'||id==='crazygames';assert.equal(exports.discordFeedbackAvailable(),allowed);assert.equal(calls.length,0,'visibility/focus checks are passive');
  exports.openDiscordFeedback();
  assert.equal(calls.length,allowed?1:0);
  if(allowed){assert.deepEqual(calls[0],['https://discord.gg/jfugatFzX','_blank','noopener,noreferrer']);assert.equal(opened.opener,null);}
}
const exports={};vm.runInNewContext(source,{exports,require:()=>({portal:{id:'web'}}),window:{open:()=>{throw Error('popup blocked')}}});
assert.doesNotThrow(()=>exports.openDiscordFeedback(),'host popup failures do not break the menu');
for(const lang of ['en','ja','ko','zh','es','ar']){
  const table=JSON.parse(fs.readFileSync(`prototypes/punchies/src/i18n/locales/${lang}.json`,'utf8'));
  assert(table['menu.feedback_discord'].includes('Discord'));
}
console.log('PASS: passive boot/visibility, explicit activation only, approved invite, isolated external tab, portal scope, popup failure and six locale labels.');
