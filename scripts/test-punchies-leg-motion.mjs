import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/legMotion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:e});
const base={x:0,y:0,dodge:null,stunTimer:0,pushFrames:0,anchored:false};
function run(rate){const f={...base},g=new e.WalkMotion();g.update(f,0,.21);for(let n=1;n<=rate;n++){f.x=n*60/rate;g.update(f,n*1000/rate,.21);}return g;}
for(const rate of [30,60,120,240]){const g=run(rate);assert.ok(Math.abs(g.phase-12.6)<1e-6);assert.ok(g.stride>.999);}
const g=run(60),f={...base,x:60};const direction=g.direction;g.update(f,1016.667,.21);assert.equal(g.direction.x,direction.x,'settling preserves movement direction');assert.ok(g.stride>0);for(let n=2;n<=120;n++)g.update(f,1000+n*16.667,.21);assert.equal(g.stride,0);
const phase=g.phase;f.dodge={};f.x+=8;g.update(f,3030,.21);assert.equal(g.phase,phase,'dodge cannot walk');f.dodge=null;f.pushFrames=2;f.x+=4;g.update(f,3047,.21);assert.equal(g.phase,phase,'pushback cannot walk');
for(let p=0;p<2*Math.PI;p+=.01){const v=e.footCycle(p);assert.ok(v.lift>=0&&v.lift<=1);assert.ok(Math.abs(v.travel)<=1);if(p/(2*Math.PI)<.6)assert.equal(v.lift,0,'planted phase stays on floor');}
assert.ok(Math.abs(e.footCycle(0).travel-e.footCycle(Math.PI*2-.00001).travel)<.001,'cycle wraps without jump');
console.log('PASS: distance-driven gait at 30/60/120/240fps, smooth stop, no dodge/push walking, planted/swing phases');

const step=e.blendedFootStep(0,Math.SQRT1_2,Math.SQRT1_2,1);assert.ok(step.u>0&&step.v>0,'diagonal blends forward and strafe');
assert.equal(e.blendedFootStep(0,-1,0,1).u,-9);assert.equal(e.blendedFootStep(0,0,-1,1).v,-7);
for(const r of [0,Math.PI/2,Math.PI,-Math.PI/2]){const c=e.bootCollar(10,20,r,16);assert.ok(Math.abs(Math.hypot(c.x-10,c.y-20)-4.8)<1e-9,'collar follows boot rotation');}
const turn=run(60),turned={...base,x:60,y:1};turn.update(turned,1016.667,.21);assert.ok(turn.direction.x>0&&turn.direction.y>0&&turn.direction.y<1,'input direction blends during turns');
console.log('PASS: diagonal/cardinal gait blend, smooth direction changes and rotating collar overlap');
