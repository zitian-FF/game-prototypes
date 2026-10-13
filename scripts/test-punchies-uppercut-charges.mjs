import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:`export * from './prototypes/punchies/src/sim/sim'; export * from './prototypes/punchies/src/sim/character'; export * from './prototypes/punchies/src/sim/super'; export * from './prototypes/punchies/src/sim/geometry'; export * from './prototypes/punchies/src/sim/tune'; export * from './prototypes/punchies/src/sim/types';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {createSimState,step,NEUTRAL_INPUT:N,CHARACTER_IDS,uppercutStars,punchCfg,fighterSuper,normalHurtRadius,tune,validateTuneJson}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
Object.assign(tune.ring,{left:0,top:0,right:1200,bottom:800});
function state(id,type=fighterSuper(id).mechanic){
 const s=createSimState({timed:false,fighters:[{char:id},{char:'marco',anchored:true}]}),[a,b]=s.fighters;
 a.x=200;a.y=b.y=210;const cfg=punchCfg(a,type);b.x=a.x+cfg.reach+cfg.hitRadius+normalHurtRadius(b)-.1;b.health=1000;return s;
}
// Projectile/dash charge/contact behavior is checked by test-punchies-wave-motion.mjs.
for(const id of CHARACTER_IDS.filter(id=>!['projectile','dash'].includes(fighterSuper(id).mechanic))){
 const ability=fighterSuper(id),required=uppercutStars(id),type=ability.mechanic;
 assert(Number.isInteger(required)&&required>=1&&required<=4,id);assert.equal(ability.starCost,required);
 let s=state(id),[a,b]=s.fighters;a.stars=required-1;
 step(s,[{...N,uppercut:true},N],false);assert.equal(a.punch,null,`${id}: cannot fire below full`);assert.equal(a.stars,required-1);
 s=state(id);[a,b]=s.fighters;a.stars=required;b.guarding=true;b.guardFrames=20;const guard=[];
 for(let frame=0;frame<90;frame++)guard.push(...step(s,[frame===0?{...N,uppercut:true}:N,{...N,guard:true}],false));
 assert.equal(a.stars,0,`${id}: full charge consumed, no Super-generated stars`);
 if(ability.id==='rising-upper'){
  assert(guard.some(e=>e.kind==='hit'&&e.punch==='uppercut'),`${id}: Rising Upper bypasses normal guard`);
  assert(!guard.some(e=>e.kind==='block'));
  const expected=tune.punches.cross.damage*tune.punches.uppercut.crossDamageMult*ability.damageMultiplier;
  assert(Math.abs((1000-b.health)-expected)<1e-7,`${id}: current normalized Rising Upper budget`);
 }else{
  assert(guard.some(e=>e.kind==='block'),`${id}: ${type} activation respects normal guard`);
  assert(!guard.some(e=>e.kind==='hit'||e.kind==='codeXLaunched'||e.kind==='buffaloFollowup'),`${id}: blocked activation cannot launch its follow-up`);
 }
 s=state(id);[a,b]=s.fighters;a.stars=required;const cfg=punchCfg(a,type),raiseAt=Math.max(0,cfg.startup+cfg.sourEarly-1),perfect=[];
 for(let frame=0;frame<90;frame++)perfect.push(...step(s,[frame===0?{...N,uppercut:true}:N,frame>=raiseAt?{...N,guard:true}:N],false));
 if(ability.id==='buffalo-hook'){
  assert(perfect.some(e=>e.kind==='block'),'Buffalo activation inherits standard Hook guard chip');
  assert(!perfect.some(e=>e.kind==='buffaloFollowup'),'Perfect-Guard Hook chip cannot confirm Buffalo Upper');
 }else assert(perfect.some(e=>e.kind==='perfectGuard'),`${id}: Perfect Guard stops its activation`);
 assert.equal(a.stars,0);
 // Unblocked initial contact uses the authoritative move, not a shared Upper budget.
 s=state(id);[a,b]=s.fighters;a.stars=required;const clean=[];
 for(let frame=0;frame<90;frame++)clean.push(...step(s,[frame===0?{...N,uppercut:true}:N,N],false));
 const initial=clean.find(e=>e.kind==='hit'&&e.punch===type);assert(initial,`${id}: actual ${type} activation connects`);
 if(ability.id!=='rising-upper'){
  const base=ability.id==='buffalo-hook'?ability.initialDamage:cfg.damage;
  assert(Math.abs(initial.damage-base*(initial.row==='normal'||!initial.sweet?tune.hit.reducedDamageMult:1))<1e-7,`${id}: initial ${type} quality budget`);
  assert(clean.some(e=>e.kind===(ability.id==='code-x'?'codeXLaunched':'buffaloFollowup')),`${id}: damaging unblocked activation confirms`);
 }
 // Ordinary sweet Jab fills the final socket exactly once for every fighter.
 s=state(id,'jab');[a,b]=s.fighters;a.stars=required-1;const fill=[];
 for(let frame=0;frame<50;frame++)fill.push(...step(s,[frame===0?{...N,jab:true}:N,N],false));
 assert.equal(a.stars,required);assert.equal(fill.filter(e=>e.kind==='starsReady').length,1);
 b.x=a.x+punchCfg(a,'jab').reach+punchCfg(a,'jab').hitRadius+normalHurtRadius(b)-.1;const extra=[];
 for(let frame=0;frame<50;frame++)extra.push(...step(s,[frame===0?{...N,jab:true}:N,N],false));
 assert.equal(a.stars,required);assert.equal(extra.filter(e=>e.kind==='starsReady').length,0);
}
const invalid=structuredClone(tune);invalid.characters.tyke.uppercut.starRequirement=3.5;assert.equal(validateTuneJson(JSON.stringify(invalid)).ok,false);
console.log('PASS all fighter charge gates/caps/readiness; authoritative Rising Upper/Jab/Hook activation geometry and guard semantics; unblocked confirmation/current damage budgets; integer validation. Unique follow-up damage/dodge/PG exceptions are covered by their dedicated tests.');
