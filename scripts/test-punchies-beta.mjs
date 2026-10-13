import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const data=new Map(),exports={};let unavailable=false;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/progress/beta.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto,require:()=>({store:{getItem:key=>data.get(key),setItem:(key,value)=>{if(unavailable)throw Error('unavailable');data.set(key,value);}}})});
const b=exports,base={mode:'ai',completed:true,seriesComplete:true,forfeit:false,disconnected:false,qa:false,win:false};
const list=()=>Array.from(b.betaView().fighters);
assert.deepEqual(list(),['marco','mia','bruno']);
for(const flags of [{mode:'training'},{mode:'survival'},{mode:'tutorial'},{forfeit:true},{disconnected:true},{qa:true},{seriesComplete:false},{completed:false}])assert.equal(b.recordBetaCompletion({...base,id:b.newBetaCompletionId(),...flags}),false);
for(let i=1;i<=5;i++){const id=b.newBetaCompletionId();assert(b.recordBetaCompletion({...base,id,mode:['ai','local','online'][i%3]}));assert.equal(b.recordBetaCompletion({...base,id}),false);assert.equal(b.betaView().completed,i);assert.equal(list().includes('roxy'),i>=3);assert.equal(list().includes('nadia'),i>=5);}
assert.equal(data.size,1,'only isolated community namespace written');assert.equal(b.recordBetaCompletion({...base,id:''}),false);unavailable=true;assert.equal(b.recordBetaCompletion({...base,id:b.newBetaCompletionId()}),false);assert.equal(b.betaView().completed,5);
console.log('PASS beta: isolated ledger, 3/5 thresholds, whole-series completion, duplicate IDs, all exclusions, losses count and unavailable persistence.');
