import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import EventEmitter from 'eventemitter3';
let reduced=false,bakes=0;const exp={},core={};
const timing={dash:12,recovery:12};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/sim/codeX.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:core,Math,require:()=>({default:{codeXTiming:{telegraph:18,stagger:4,...timing}}})});
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/codeXShadows.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp,Math,require:id=>id.includes('sim/codeX')?core:id.includes('presentation')?{reducedMotion:()=>reduced}:{codeXTrailTexture:()=> 'trail',codeXShadowSheet:()=>{bakes++;return{dark:'dark',cyan:'cyan',purple:'purple',pivotX:.8,pivotY:.5};}}});
function scene(){const objects=[],events=new EventEmitter();const image=()=>{const o={parentContainer:{},destroyed:false};for(const m of ['setDepth','setOrigin','setVisible','setTexture','setPosition','setRotation','setTintFill','setTint','setScale','setAlpha','setDisplaySize','setFrame'])o[m]=(...a)=>{o[m+'Args']=a;if(m==='setVisible')o.visible=a[0];if(m==='setPosition'){o.x=a[0];o.y=a[1];}return o;};o.destroy=()=>o.destroyed=true;objects.push(o);return o;};return {events,objects,add:{image}};}
const state=(start=18)=>({activationId:1,frame:0,endFrame:start+4+24,targetId:'target',targetX:400,targetY:200,tracks:core.codeXTracks(400,200,1,0,80,4,start),buffed:false,crossFatigueMult:1,hitIds:[[],[]]});
for(reduced of [false,true])for(let cycle=0;cycle<20;cycle++){
 const s=scene(),fx=new exp.CodeXShadows(s),ability=state(),f={health:50,codeX:ability};assert.equal(s.objects.length,24);
 fx.draw([f]);assert.equal(bakes,cycle+(reduced?21:1),'each renderer bakes at most once');
 const before=JSON.stringify(ability);fx.draw([f]);assert.equal(JSON.stringify(ability),before,'renderer does not mutate gameplay state');
 for(let frame=0;frame<ability.endFrame;frame++){ability.frame=frame;fx.draw([f]);const p=core.codeXTrackPosition(ability.tracks[0],frame);assert.equal(s.objects[1].x,p.x);assert.equal(s.objects[1].y,p.y);assert.equal(s.objects[1].setOriginArgs[0],.8,'striking glove anchor');assert.equal(s.objects.length,24);}
 ability.frame=20;fx.draw([f]);const x=s.objects[1].x;fx.draw([f]);assert.equal(s.objects[1].x,x,'hitstop pauses positions');
 ability.frame=5;fx.draw([f]);assert.equal(s.objects[1].x,core.codeXTrackPosition(ability.tracks[0],5).x,'rollback redraw follows state');
 fx.draw([{...f,health:0}]);assert(s.objects.every(o=>!o.visible),'attacker death clears');
 fx.draw([f,{health:50,codeX:state(30)}]);assert.equal(fx.diagnostics().codeXActiveTracks,4,'two concurrent actors');
 fx.draw([f],true);assert(s.objects.every(o=>!o.visible),'match result clears');fx.draw([]);assert(s.objects.every(o=>!o.visible),'no state/stale launch clears');
 s.events.emit('shutdown');assert(s.objects.every(o=>o.destroyed));assert.equal(s.events.listenerCount('shutdown'),0);fx.draw([f]);
}
console.log('PASS: 2tracks/actor,max4/24images, sharedphase/gloveorigin, hitstop/rollback, no mutation/perframepuppet, concurrent actors/death/result/stale/shutdown and reduced motion');
