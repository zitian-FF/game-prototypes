import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root=path.resolve('prototypes/punchies/src');
function moduleAt(file,dependencies){const source=fs.readFileSync(path.join(root,file),'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const exports={};vm.runInNewContext(code,{exports,require:id=>{assert.ok(id in dependencies,`Unexpected runtime dependency ${id}`);return dependencies[id];}});return exports;}
// Results consume stale normal awards but only read the completed-match ledger.
let completed=3;const removed=[],drawn=[];
const result=moduleAt('editions/beta/resultProgress.ts',{
 '../../render/pixelRatio':{VIEW:{bottom:390}},'../../progress/beta':{betaView:()=>({completed})},
 '../../i18n':{t:(key,values)=>key+':'+values.matches},'./text':{profileText:(...args)=>drawn.push(args)}
});const scene={registry:{remove:key=>removed.push(key)}};
result.resultProgress(scene,200,220);completed=5;result.resultProgress(scene,200,220,160);
assert.deepEqual(removed,['lastAward','lastAward']);assert.equal(drawn[0][2],215);assert.equal(drawn[0][3],'beta.completed_matches:3');assert.equal(drawn[1][2],160);assert.equal(drawn[1][3],'beta.completed_matches:5');
// Lifecycle guards: resume refreshes identity; queued art callbacks after shutdown do nothing.
const listeners={},pending=[],avatars=[],labels=[];
function label(){const x={width:90,scaleX:1,setOrigin(){return x;},setText(v){x.value=v;return x;},setScale(){return x;},setDepth(){return x;}};labels.push(x);return x;}
const graphics={fillStyle(){return this;},fillRoundedRect(){return this;},clear(){return this;}};
const hit={setData(){},on(){return this;}};
const content={add(){},setDepth(){return this;},setY(){}};
const entry=moduleAt('editions/beta/titleProfileEntry.ts',{
 '../../i18n':{t:(key,v)=>v?key+':'+v.matches:key},'../../render/pixelRatio':{VIEW:{right:844,top:0},PIXEL_RATIO:1},
 '../../progress/profile':{getAlias:()=> 'Tester',getProfileAvatar:()=>({fighter:'mia',skin:'violet'})},
 '../../progress/beta':{betaView:()=>({completed})},'./defaultAvatar':{avatarImage:(_s,a)=>{avatars.push(a);return {destroy(){}};}},
 '../../render/art':{whenGroupsReady:(_s,_groups,draw)=>pending.push(draw)},'../../ui/titleButton':{titleButton:()=>({getData:()=>hit})}
});const fake={add:{container:()=>content,graphics:()=>graphics,text:label},events:{on:(event,fn)=>listeners[event]=fn,once:(event,fn)=>listeners[event]=fn,off:(event)=>delete listeners[event]}};
const api=entry.titleProfileEntry(fake,()=>{});assert.equal(api.identity.value,'beta.completed_matches:5');assert.equal(avatars[0].skin,'default');
completed=3;listeners.resume();assert.equal(api.identity.value,'beta.completed_matches:3');const before=avatars.length;listeners.shutdown();pending.forEach(fn=>fn());assert.equal(avatars.length,before);assert.equal(listeners.resume,undefined);
console.log('PASS Beta result ledger presentation and title-entry resume/shutdown/default-avatar contract');
