import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const nodes=[],listeners=new Map();let fetches=0;
const bus={};
const ctx={decodeAudioData:async()=>({}),createBufferSource:()=>{const n={connect:b=>assert.equal(b,bus),start(){this.started=true;},stop(){this.stopped=true;},disconnect(){}};nodes.push(n);return n;}};
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/audio/stingers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,fetch:async()=>{fetches++;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};},require:id=>id.includes('mixer')?{unlockMixer:()=>ctx,audioOutput:c=>{assert.equal(c,'sfx');return bus;}}:{default:id}});
const scene={events:{once:(k,fn)=>listeners.set(k,fn),off:(k,fn)=>{if(listeners.get(k)===fn)listeners.delete(k);}}};
exports.preloadStingers();assert.equal(fetches,1);
const stop=exports.playStinger(scene,'reward');await new Promise(r=>setImmediate(r));assert.equal(nodes.length,1);assert.equal(nodes[0].started,true);stop();assert.equal(nodes[0].stopped,true);
const cancel=exports.playStinger(scene,'reward');cancel();await new Promise(r=>setImmediate(r));assert.equal(nodes.length,1,'closed overlay cannot play late');
exports.playStinger(scene,'reward');await new Promise(r=>setImmediate(r));listeners.get('shutdown')();assert.equal(nodes[1].stopped,true);
assert.equal(fetches,1,'preload requests reused');
console.log('PASS: reward cue only, SFX routing, cancellation, shutdown and preload reuse');

assert.ok(!fs.readFileSync('prototypes/punchies/src/ui/matchPresentation.ts','utf8').includes('playStinger'), 'result overlay has no stinger');
assert.ok(!fs.readFileSync('prototypes/punchies/src/audio/stingers.ts','utf8').includes('result.mp3'), 'result file is not bundled/preloaded');
