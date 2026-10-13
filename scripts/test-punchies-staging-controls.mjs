import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function load(file,mocks={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,...globals,require:key=>mocks[key]??{}});return exports;}
const prodKey='punchies:profile:v1',stageKey='punchies:staging:profile:v1',receipt='punchies:staging:save-reset:v1';
const raw=new Map([[prodKey,'production'],[stageKey,'test'],[receipt,'same-epoch'],['other-game','keep']]);let writes=0;
const store={removeItem:key=>{writes++;raw.delete(key)},getItem:key=>raw.get(key)??null};
const mocks={'../portal/keys':{GAME_SAVE_KEYS:[stageKey]},'../portal/store':{store},'../sim/character':{isCharId:value=>['tee','tyke'].includes(value)},'../shop/draft':{SHOP_ITEMS:[{kind:'skins',boxer:'tee',id:'skin-tee-ultraviolet'}]}};
const stage=load('debug/stagingReviewControls',{...mocks,'../buildFlags':{DEBUG_TOOLS_BUILD:true}});
assert.equal(stage.qaTrainingPick({char:'tee'}),null);assert.equal(stage.qaTrainingPick({qaPreview:true,char:'unknown'}),null);assert.equal(stage.qaTrainingPick({qaPreview:true,char:'tyke',skin:'skin-tee-ultraviolet'}),null);
assert.equal(stage.qaTrainingPick({qaPreview:true,char:'tee',skin:'skin-tee-ultraviolet'}).skin,'skin-tee-ultraviolet');assert.equal(writes,0,'QA preview cannot mutate ownership/preferences/currency');
stage.resetStageTestData();assert(!raw.has(stageKey));assert.equal(raw.get(prodKey),'production');assert.equal(raw.get(receipt),'same-epoch');assert.equal(raw.get('other-game'),'keep');
const prod=load('debug/stagingReviewControls',{...mocks,'../buildFlags':{DEBUG_TOOLS_BUILD:false}});assert.equal(prod.qaTrainingPick({qaPreview:true,char:'tee'}),null);assert.throws(()=>prod.resetStageTestData());
const bad=load('debug/stagingReviewControls',{...mocks,'../buildFlags':{DEBUG_TOOLS_BUILD:true},'../portal/keys':{GAME_SAVE_KEYS:[stageKey,prodKey]}});const before=writes;assert.throws(()=>bad.resetStageTestData());assert.equal(writes,before,'full namespace allowlist checked before deleting anything');
const disabled=load('debug/debugDisabled');assert.equal(disabled.qaTrainingPick({qaPreview:true,char:'tee'}),null);
console.log('PASS transient valid stage picks, no save grants, isolated allowlisted reset/receipt preservation, production refusal');
