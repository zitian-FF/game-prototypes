import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const KEY='punchies:profile:v1',receipt='punchies:save-reset:v1',epoch='punchies-reset-2026-10-12-super-v1';
function load(file,mocks={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,...globals,require:id=>mocks[id]??{}});return exports;}
const reset=load('portal/saveReset',{'./keys':{GAME_SAVE_KEYS:[KEY],KEYS:{resetReceipt:receipt}},'../buildFlags':{SAVE_RESET_ID:epoch,STAGING_BUILD:false}}).applySaveReset;
for(const failure of ['none','quota','readback','blocked','read-failure']){
 const raw=new Map([[KEY,'owned fighters']]);let removes=0;
 const native={getItem:key=>{if(failure==='blocked'||failure==='read-failure'&&key===KEY)throw Error('blocked');if(failure==='readback'&&key===receipt)return null;return raw.get(key)??null;},setItem:(key,value)=>{if(failure==='quota'||failure==='blocked')throw Error('quota');raw.set(key,value);},removeItem:key=>{removes++;raw.delete(key);}};
 for(let boot=0;boot<3;boot++){const storage=load('portal/web',{}, {localStorage:native}).webStorage();reset(storage);assert.equal(raw.get(KEY),'owned fighters',failure+' preserves original across reloads');assert.equal(removes,0,'never replay historical wipe');}
}
// Quota-limited writes remain visible within a session, but do not claim durability.
{const raw=new Map([[KEY,'original']]);const native={getItem:key=>raw.get(key)??null,setItem(){throw Error('quota');},removeItem:key=>raw.delete(key)};const a=load('portal/web',{}, {localStorage:native}).webStorage();a.setItem(KEY,'session progress');assert.equal(a.getItem(KEY),'session progress');assert.equal(a.persistResetReceipt(receipt,epoch),false);assert.equal(load('portal/web',{}, {localStorage:native}).webStorage().getItem(KEY),'original');}
// A transient unreadable save must not be replaced by a normalizer's default.
{const raw=new Map([[KEY,'original']]);const native={getItem(){throw Error('read denied');},setItem:(key,value)=>raw.set(key,value),removeItem:key=>raw.delete(key)};const a=load('portal/web',{}, {localStorage:native}).webStorage();assert.equal(a.getItem(KEY),null);a.setItem(KEY,'default');assert.equal(a.getItem(KEY),'default');assert.equal(raw.get(KEY),'original');}
// Missing/partial receipts, removal failures and repeated reset/preload are harmless.
{const raw=new Map([[KEY,'original'],[receipt,'partial']]);const a={getItem:key=>raw.get(key)??null,setItem:(key,value)=>raw.set(key,value),removeItem(){assert.fail('no automatic remove');}};assert.equal(reset(a).status,'preserved');assert.equal(reset(a).status,'already-applied');assert.equal(raw.get(KEY),'original');}
console.log('PASS saves: no historical reset replay, quota/blocked/readback/reloads preserve data, session writes coherent, unreadable save not overwritten by defaults.');
