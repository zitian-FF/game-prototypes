import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:`export * from './prototypes/punchies/src/sim/sim'; export * from './prototypes/punchies/src/sim/character'; export * from './prototypes/punchies/src/sim/tune'; export * from './prototypes/punchies/src/sim/types';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {createSimState,step,NEUTRAL_INPUT:N,uppercutStars,punchCfg,tune,validateTuneJson}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
Object.assign(tune.ring,{left:0,top:0,right:1200,bottom:800});
const builds={marco:[3,20],mia:[2,12],bruno:[3,22],tee:[2,13],tyke:[4,36],dragon:[3,19],longan:[1,8],captain:[2,12],roxy:[3,23],nadia:[2,11]};
function state(id,type='uppercut'){
 const s=createSimState({timed:false,fighters:[{char:id},{char:'marco',anchored:true}]});
 const [a,b]=s.fighters; a.x=200;a.y=b.y=210;
 const c=punchCfg(a,type);b.x=a.x+c.reach+c.hitRadius+tune.body.hurtRadius*tune.view.fighterScale-.1;
 b.health=1000;return s;
}
try {
 for(const [id,[required,damage]] of Object.entries(builds)){
  assert.equal(uppercutStars(id),required,id);
  let s=state(id);let [a,b]=s.fighters;a.stars=required-1;
  step(s,[{...N,uppercut:true},N],false);assert.equal(a.punch,null,`${id}: cannot fire below full`);assert.equal(a.stars,required-1);
  s=state(id);[a,b]=s.fighters;a.stars=required;b.guarding=true;b.guardFrames=20;
  const events=[];
  for(let frame=0;frame<30;frame++)events.push(...step(s,[frame===0?{...N,uppercut:true}:N,{...N,guard:true}],false));
  assert.equal(a.stars,0,`${id}: whole charge spent, no uppercut-generated stars`);
  assert(events.some(e=>e.kind==='hit'),`${id}: uppercut bypasses normal guard`);
  assert(!events.some(e=>e.kind==='block'),`${id}: not blocked by normal guard`);
  assert(Math.abs((1000-b.health)-damage)<1e-7,`${id}: clean damage ${1000-b.health} vs ${damage}`);
  s=state(id);[a,b]=s.fighters;a.stars=required;
  const perfect=[];
  for(let frame=0;frame<30;frame++)perfect.push(...step(s,[frame===0?{...N,uppercut:true}:N,frame>=Math.max(0,punchCfg(a,'uppercut').startup-1)?{...N,guard:true}:N],false));
  assert(perfect.some(e=>e.kind==='perfectGuard'),`${id}: Perfect Guard still defends`);
  assert.equal(a.stars,0);
  // A sweet jab fills the last socket and emits readiness exactly once.
  s=state(id,'jab');[a,b]=s.fighters;a.stars=required-1;
  const fill=[];for(let frame=0;frame<50;frame++)fill.push(...step(s,[frame===0?{...N,jab:true}:N,N],false));
  assert.equal(a.stars,required,`${id}: charge fills at fighter requirement`);
  assert.equal(fill.filter(e=>e.kind==='starsReady').length,1,`${id}: readiness once`);
  b.x=a.x+punchCfg(a,'jab').reach+punchCfg(a,'jab').hitRadius+tune.body.hurtRadius*tune.view.fighterScale-.1;
  const extra=[];for(let frame=0;frame<50;frame++)extra.push(...step(s,[frame===0?{...N,jab:true}:N,N],false));
  assert.equal(a.stars,required,`${id}: no extra stored stars`);assert.equal(extra.filter(e=>e.kind==='starsReady').length,0);
 }
 const invalid=structuredClone(tune);invalid.characters.tyke.uppercut.starRequirement=3.5;
 assert.equal(validateTuneJson(JSON.stringify(invalid)).ok,false,'fractional requirements rejected');
 console.log('PASS: all ten fighter charge gates, full consumption, meter caps/readiness, clean damage, normal-guard bypass and integer validation');
}catch(e){console.error(e.message);process.exitCode=1;}

