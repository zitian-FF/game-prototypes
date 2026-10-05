import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({stdin:{contents:`export * from './prototypes/punchies/src/sim/sim'; export {punchCfg} from './prototypes/punchies/src/sim/character'; export {tune} from './prototypes/punchies/src/sim/tune';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {createSimState,step,punchCfg,tune}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const n={mx:0,my:0,jab:false,cross:false,hook:false,uppercut:false,dodge:false,guard:false};
const fresh=(char='marco',infiniteStamina=false)=>createSimState({timed:false,fighters:[{char,infiniteStamina},{anchored:true}]});
for(const char of ['marco','mia','bruno']) for(const action of ['jab','cross','hook','uppercut','dodge']) {
 const s=fresh(char),f=s.fighters[0];const cost=action==='dodge'?tune.dodge.staminaCost:punchCfg(f,action).staminaCost;
 f.stamina=cost-.01;f.regenWait=100;f.stars=tune.stars.max;f.dashBuff=4;
 const e=step(s,[{...n,[action]:true},n]);
 assert.equal(f.punch,null);assert.equal(f.dodge,null);assert.equal(f.buffered,null);assert.equal(f.stamina,cost-.01);assert.equal(f.stars,tune.stars.max);assert.equal(e.filter(e=>e.kind==='staminaRejected').length,1);
 f.stamina=100;step(s,[n,n]);assert.equal(f.punch,null);assert.equal(f.dodge,null,'rejected input must not fire later');
 const exact=fresh(char);exact.fighters[0].stamina=cost;exact.fighters[0].stars=tune.stars.max;step(exact,[{...n,[action]:true},n]);assert(action==='dodge'?exact.fighters[0].dodge:exact.fighters[0].punch);
 const unlimited=fresh(char,true);unlimited.fighters[0].stamina=0;unlimited.fighters[0].stars=tune.stars.max;step(unlimited,[{...n,[action]:true},n]);assert(action==='dodge'?unlimited.fighters[0].dodge:unlimited.fighters[0].punch);
}
const dodge=()=>{const s=fresh();step(s,[{...n,dodge:true},n]);while(s.fighters[0].dodge)step(s,[n,n]);return s;};
const s=dodge(),f=s.fighters[0];assert.equal(f.postDodgeVulnerable,14);assert.equal(f.dashBuff,6);
while(f.postDodgeVulnerable>0){step(s,[{...n,dodge:true},n]);assert.equal(f.dodge,null);assert.equal(f.buffered,null);}
step(s,[n,n]);assert.equal(f.dodge,null);step(s,[{...n,dodge:true},n]);assert(f.dodge);
const buff=dodge();step(buff,[{...n,jab:true},n]);assert.equal(buff.fighters[0].punch.buffed,true);assert(buff.fighters[0].postDodgeVulnerable>0);assert.equal(buff.fighters[0].dashBuff,0);
const expired=dodge();for(let i=0;i<6;i++)step(expired,[n,n]);assert.equal(expired.fighters[0].dashBuff,0);assert(expired.fighters[0].postDodgeVulnerable>0);step(expired,[{...n,jab:true},n]);assert.equal(expired.fighters[0].punch.buffed,false);
const normal=fresh(),penalty=fresh();penalty.fighters[0].postDodgeVulnerable=10;const x=normal.fighters[0].x;step(normal,[{...n,mx:-100},n]);step(penalty,[{...n,mx:-100},n]);assert(Math.abs((x-penalty.fighters[0].x)/(x-normal.fighters[0].x)-.4)<1e-10);
const frozen=fresh();frozen.hitstop=2;frozen.fighters[0].stamina=0;assert(step(frozen,[{...n,dodge:true},n]).some(e=>e.kind==='staminaRejected'));assert.equal(frozen.fighters[0].buffered,null);
assert(Math.abs(tune.dodge.staminaCost-12*1.2)<1e-10);assert.equal(tune.punches.hook.reach,35*.8);
console.log('PASS: full-cost rejection for every character/move, no delayed retry, exact-cost/infinite stamina, hit-stop rejection, 60% movement penalty, dodge lockout, independent six-frame buff, and updated costs/range.');
