import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const exports={},cfg={impactMs:160,fightHoldMs:180,fightFadeMs:80,koWordGapMs:140,fadeMs:200};let motion=false;
const timing={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/sim/fightCue.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:timing,require:()=>({tune:{view:{fightPresentation:cfg}},TICK_RATE:60})});
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/ui/fightPresentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>id.includes('fightCue')?timing:id.includes('sim/tune')?{tune:{view:{fightPresentation:cfg}}}:id.includes('pixelRatio')?{PIXEL_RATIO:1,VIEW:{cx:400,cy:250}}:id.includes('i18n')?{t:x=>x}:id.includes('presentation')?{reducedMotion:()=>motion}:{} });
for(motion of [false,true]){
 const objects=[];let tweens=0,timers=0;
 const make=()=>{const o={width:300,height:100,alpha:1,scale:1,destroyed:false};for(const m of ['setDepth','add','fillStyle','fillPoints','setOrigin','setAngle'])o[m]=()=>o;o.setAlpha=x=>(o.alpha=x,o);o.setScale=x=>(o.scale=x,o);o.setCrop=(...x)=>(o.crop=x,o);o.destroy=()=>o.destroyed=true;objects.push(o);return o;};
 const scene={add:{container:make,graphics:make,text:make},tweens:{add:()=>tweens++,killTweensOf:()=>{}},time:{delayedCall:()=>{timers++;return {remove(){}};}}};
 const fx=exports.fightWord(scene),cover=objects[0],word=objects[2];
 fx.draw(80);assert.equal(cover.alpha,1);if(!motion)assert(word.crop[2]<word.width);
 fx.draw(160);assert.equal(word.scale,1);assert.equal(word.crop.length,0);assert.equal(cover.alpha,1);
 fx.draw(timing.fightCueTiming().entranceMs);assert.equal(cover.alpha,1);fx.draw(timing.fightCueTiming().entranceMs+40);assert(Math.abs(cover.alpha-.5)<.001);
 assert.equal(tweens,0);assert.equal(timers,0);fx.draw(264);assert(cover.destroyed);fx();
 const early=exports.fightWord(scene);early();early.draw(100);assert(objects[3].destroyed);
}
console.log('PASS: full FIGHT entrance before tick-driven fade, reduced motion, zero timers/tweens and early cleanup');
