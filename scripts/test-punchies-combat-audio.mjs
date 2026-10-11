import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const calls=[];const sfx=new Proxy({}, {get:(_t,key)=>(...args)=>calls.push([key,...args])});
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/Effects.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,navigator:{},require:id=>id.endsWith('/sfx')?{sfx}:id.endsWith('/tune')?{tune:{view:{cameraShakeScale:0}}}:id.endsWith('i18n')?{t:key=>key}:{}});
const fx=Object.create(exports.Effects.prototype);
fx.scene={cameras:{main:{shake(){}}}};
for(const name of ['puff','label','directionalSpark','damageNumber','onFighterFlash','shakyLabel','screenFlash','redEdges','subtle'])fx[name]=()=>{};
fx.wasExhausted=null;
const f={x:0,y:0,fx:1,fy:0,exhausted:false};const s={fighters:[f,{...f}],result:null};
for(const punch of ['jab','cross','hook','uppercut']) {
 calls.length=0;fx.handle([{kind:'throw',attacker:0,punch,tired:false}],s,0);assert.deepEqual(calls,[['swing',punch]],'miss starts only a swing');
 for(const sweet of [false,true])for(const local of [-1,0,1]) {
  calls.length=0;fx.handle([{kind:'hit',attacker:0,punch,sweet,counter:false,row:'normal',damage:10,x:0,y:0}],s,local);
  assert.deepEqual(calls,[['impact',punch,sweet,false]],'both receiving and delivering preserve contact quality');
 }
 calls.length=0;fx.handle([{kind:'hit',attacker:0,punch,sweet:true,counter:true,row:'vulnerable',damage:10,x:0,y:0}],s,0);
 assert.deepEqual(calls,[['impact',punch,true,true],['counter']],'counter is a single accent over quality-specific contact');
}
for(const [event,expected] of [[{kind:'block',chip:1,sweet:false},['block',false]],[{kind:'perfectGuard'},['perfectGuard']],[{kind:'dodged'},['evade']]]) {
 calls.length=0;fx.handle([{attacker:0,x:0,y:0,...event}],s,0);assert.deepEqual(calls,[expected]);
}
calls.length=0;fx.handle([{kind:'ko',loser:1}],s,0);assert.deepEqual(calls,[],'KO audio waits for confirmed FightStage presentation');
console.log('PASS: per-punch swing, sweet/sour contact for both sides, counter layering, block/perfect/evade outcome routing');
