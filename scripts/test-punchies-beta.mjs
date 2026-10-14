import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const data=new Map(),exports={},analytics=[];let unavailable=false;let betaKey='punchies:itchbeta:beta-completions:v1';
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/progress/beta.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto,require:path=>path.endsWith('/analytics')?{track:(...args)=>analytics.push(args)}:path.endsWith('/keys')?{KEYS:{get betaCompletions(){return betaKey;}}}:{store:{getItem:key=>data.get(key),setItem:(key,value)=>{if(unavailable)throw Error('unavailable');data.set(key,value);}}}});
const b=exports,base={mode:'ai',completed:true,seriesComplete:true,forfeit:false,disconnected:false,qa:false,win:false};
const list=()=>Array.from(b.betaView().fighters);
assert.deepEqual(list(),['marco','mia','bruno']);
for(const flags of [{mode:'training'},{mode:'survival'},{mode:'tutorial'},{forfeit:true},{disconnected:true},{qa:true},{seriesComplete:false},{completed:false}])assert.equal(b.recordBetaCompletion({...base,id:b.newBetaCompletionId(),...flags}),false);
for(let i=1;i<=5;i++){const id=b.newBetaCompletionId();assert(b.recordBetaCompletion({...base,id,mode:['ai','local','online'][i%3]}));assert.equal(b.recordBetaCompletion({...base,id}),false);assert.equal(b.betaView().completed,i);assert.equal(list().includes('roxy'),i>=3);assert.equal(list().includes('nadia'),i>=5);}
assert.equal(b.betaView().wins,0);assert.equal(b.betaView().records.length,5);
const winId=b.newBetaCompletionId();assert(b.recordBetaCompletion({...base,id:winId,win:true}));assert.equal(b.betaView().wins,1);assert.equal(b.recordBetaCompletion({...base,id:winId,win:false}),false);assert.equal(b.betaView().wins,1);
assert.equal(b.recordBetaCompletion({...base,id:b.newBetaCompletionId(),win:undefined}),false);
assert.equal(analytics.length,6,'one post-save snapshot per new valid UUID completion');
for(const [i,event] of analytics.entries()){assert.equal(event[0],'beta');assert.equal(event[1],'beta_completion');assert.equal(event[3].completed,i+1);assert.equal(event[3].roxy,i+1>=3);assert.equal(event[3].nadia,i+1>=5);assert.match(event[3].completion_id,/^[a-f0-9-]{36}$/);}
assert.equal(data.size,1,'only isolated Beta namespace written');assert.equal(b.recordBetaCompletion({...base,id:''}),false);unavailable=true;assert.equal(b.recordBetaCompletion({...base,id:b.newBetaCompletionId()}),false);assert.equal(b.betaView().completed,6);
unavailable=false;
data.set(betaKey,JSON.stringify({version:1,ids:['legacy:1','legacy:2','legacy:2'],records:[{id:'not-counted',mode:'ai',win:true},{id:'legacy:1',mode:'training',win:true}]}));
assert.equal(b.betaView().completed,2);assert.equal(b.betaView().wins,0);assert.equal(b.betaView().records.length,0);
assert.equal(b.recordBetaCompletion({...base,id:'legacy:1',win:true}),false,'legacy completion never upgraded to a fabricated win');
assert(b.recordBetaCompletion({...base,id:'new:win',win:true}));assert.equal(b.betaView().completed,3);assert.equal(b.betaView().wins,1);
const before=data.get(betaKey);betaKey=undefined;assert.equal(b.recordBetaCompletion({...base,id:'master:attempt',win:true}),false);assert.equal(b.betaView().completed,0);assert.equal(data.size,1);assert.equal([...data.values()][0],before);
for(const edition of ['master','crazygames','itchbeta']){
 const keys={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/portal/keys.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:keys,require:path=>path.endsWith('/edition')?{EDITION_ID:edition}:{stagingStorageKey:key=>edition==='master'?key:key.replace(/^punchies:/,'punchies:'+edition+':')}});
 assert.equal(keys.GAME_SAVE_KEYS.length,edition==='itchbeta'?12:11);
 assert.equal(keys.MASTER_KEYS.betaCompletions,undefined);
 assert.equal(Boolean(keys.KEYS.betaCompletions),edition==='itchbeta');
 if(edition==='itchbeta')assert(keys.GAME_SAVE_KEYS.includes(keys.KEYS.betaCompletions));
}
console.log('PASS beta: isolated ledger, 3/5 thresholds, whole-series completion, duplicate IDs, all exclusions, losses count and unavailable persistence.');
