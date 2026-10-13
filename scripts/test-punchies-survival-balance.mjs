import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';
import {i18nStub} from './lib-i18n-stub.mjs';
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);if(file.endsWith('.json')){const e={default:JSON.parse(fs.readFileSync(file,'utf8'))};cache.set(file,e);return e;}const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,structuredClone,console,setTimeout,clearTimeout,require:id=>id.endsWith('/i18n')?i18nStub:load(path.resolve(path.dirname(file),id.endsWith('.json')?id:id+'.ts'))});return exports;}
const root='prototypes/punchies/src/';const {createRun,startNextWave,stepSurvival,waveProgression,bossZombieQuota,bossHealth,attackPermission,survivalBalanceVersion,survivalConfig:c}=load(root+'survival/sim.ts');
const {SurvivalStore}=load(root+'survival/save.ts'),{tune}=load(root+'sim/tune.ts'),{maxHealth,punchCfg,CHARACTER_IDS}=load(root+'sim/character.ts'),{NEUTRAL_INPUT:N}=load(root+'sim/types.ts'),{phaseOf}=load(root+'sim/sim.ts');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const opts={fighter:'marco',skin:'default',seed:42,runId:'balance-test'};
Object.assign(tune.ring,{left:0,top:0,right:1800,bottom:1000});
function wave(n,seed=42){const r=createRun({...opts,seed});if(n>1){r.status='intermission';r.wave=n-1;startNextWave(r);}r.tick=r.fightStartTick;return r;}
for(const n of [1,3,4,5,6,9,11,13,60,300]){const p=waveProgression(n);near(p.damageMultiplier,Math.min(.8,.5+.03*(n-1)));near(p.crossChance,n<4?0:Math.min(.4,.15+.03*(n-4)));}
for(const [n,q]of [[3,8],[6,12],[9,16],[12,20],[15,24],[60,24]]){
 assert.equal(bossZombieQuota(n),q);
 const r=wave(n);r.player.health=1e9;r.player.anchored=true;
 const boss=r.enemies.find(e=>e.kind==='boss');boss.fighter.health=1e9;boss.fighter.anchored=true;
 assert.equal(r.waveZombieSpawns,2,'successful initial adds included');
 for(let i=0;i<q+20;i++){r.enemies.filter(e=>e.kind==='zombie').forEach(e=>e.fighter.health=0);r.spawnWait=1;r.hitstop=0;stepSurvival(r,N);}
 assert.equal(r.waveZombieSpawns,q,'finite lifetime quota reached');
 const id=r.nextEnemyId;for(let i=0;i<20;i++){r.spawnWait=1;stepSurvival(r,N);}assert.equal(r.nextEnemyId,id,'no replacement adds after quota');
}
for(const n of [3,6,9,12,15,18,21,300])for(const char of CHARACTER_IDS){const f={char};assert.equal(bossHealth(n,f),Math.max(1,Math.round(maxHealth(f)*Math.min(2,.5+.25*(n/3-1)))));}
// Alive cap and failed placements never consume the lifetime quota.
{const r=wave(3);r.player.health=1e9;r.player.anchored=true;for(let i=0;i<8;i++){r.spawnWait=1;stepSurvival(r,N);}assert.equal(r.enemies.filter(e=>e.kind==='zombie').length,4);assert.equal(r.waveZombieSpawns,4);
 r.enemies=r.enemies.filter(e=>e.kind==='boss');const before=r.waveZombieSpawns,attempts=c.spawnAttempts;c.spawnAttempts=0;r.spawnWait=1;stepSurvival(r,N);assert.equal(r.waveZombieSpawns,before);c.spawnAttempts=attempts;}
{const r=wave(4);r.player.health=1e9;r.player.anchored=true;for(let i=0;i<20;i++){r.spawnWait=1;stepSurvival(r,N);}assert.equal(r.enemies.length,12,'ordinary alive cap unchanged');}
// Same seed and real inputs replay identically after Cross unlock.
{const a=wave(4,234),b=wave(4,234);for(let i=0;i<600;i++){const input={...N,mx:i%80<40?60:-60,jab:i%59===0,dodge:i%131===0};assert.equal(JSON.stringify(stepSurvival(a,input)),JSON.stringify(stepSurvival(b,input)));assert.equal(JSON.stringify(a),JSON.stringify(b));}}
let crossSeeds=0;
for(let seed=0;seed<100;seed++){
 const r=wave(4,seed);r.enemies=r.enemies.slice(0,1);const e=r.enemies[0];e.fighter.x=r.player.x+60;e.fighter.y=r.player.y;e.fighter.anchored=true;r.player.anchored=true;e.attackWait=0;r.spawnWait=9999;
 stepSurvival(r,N);if(e.fighter.punch?.type==='cross'){crossSeeds++;assert(e.fighter.punch.startup>=20);near(e.fighter.punch.damageMult,waveProgression(4).damageMultiplier);}
}
assert(crossSeeds>0&&crossSeeds<100,'seeded pool includes both Jabs and Crosses');
// A real Cross still follows normal contact, guard and dodge rules.
const chance=c.zombieCrossChance,cap=c.zombieMaxCrossChance;c.zombieCrossChance=c.zombieMaxCrossChance=1;
{const r=wave(4,98);r.player.health=1e9;r.player.anchored=true;r.spawnWait=9999;let starts=0;
 r.enemies.forEach((e,i)=>{e.fighter.x=r.player.x+62*Math.cos(i*2*Math.PI/3);e.fighter.y=r.player.y+62*Math.sin(i*2*Math.PI/3);e.fighter.anchored=true;e.attackWait=0;});
 for(let i=0;i<500;i++){const before=new Map(r.enemies.map(e=>[e.id,e.fighter.punch]));stepSurvival(r,N);const active=r.enemies.filter(e=>e.fighter.punch&&phaseOf(e.fighter.punch)!=='recovery');assert(active.filter(e=>e.fighter.punch.type==='cross').length<=1);assert(active.length<=3);starts+=r.enemies.filter(e=>e.fighter.punch&&e.fighter.punch!==before.get(e.id)).length;}
 assert(starts>1,'crowd fixture exercises competing real Cross requests');}
for(const defense of ['none','guard','dodge']){
 const r=wave(4,111);r.enemies=r.enemies.slice(0,1);const e=r.enemies[0];e.fighter.x=r.player.x+62;e.fighter.y=r.player.y;e.fighter.anchored=true;r.player.anchored=true;e.attackWait=0;r.spawnWait=9999;r.player.health=1000;
 if(defense==='guard'){r.player.guarding=true;r.player.guardFrames=20;}
 const events=[];let dodged=false;
 for(let i=0;i<55;i++){let input=N;if(defense==='guard')input={...N,guard:true};if(defense==='dodge'&&!dodged&&e.fighter.punch&&e.fighter.punch.frame>=e.fighter.punch.startup-2){input={...N,dodge:true,my:100};dodged=true;}events.push(...stepSurvival(r,input).filter(v=>v.kind==='combat').map(v=>v.event));}
 const hits=events.filter(v=>v.kind==='hit'&&v.attacker===1);
 if(defense==='none'){assert(hits.length);const h=hits[0],base=punchCfg(e.fighter,'cross').damage;near(h.damage,base*waveProgression(4).damageMultiplier*(h.row==='normal'||!h.sweet?tune.hit.reducedDamageMult:1));}
 else if(defense==='guard'){assert(events.some(v=>v.kind==='block'));assert.equal(hits.length,0);assert.equal(r.player.health,1000);}
 else {assert(dodged);assert.equal(hits.length,0);assert.equal(r.player.health,1000);}
}
c.zombieCrossChance=chance;c.zombieMaxCrossChance=cap;
// One active ordinary Cross; recovery releases its slot. Global gap still applies.
{const r=wave(4);const [a,b]=r.enemies;a.fighter.punch={type:'cross',frame:0,startup:20,sourEarly:3,sweet:4,sour:0,recovery:15};r.lastEnemyAttackTick=r.tick-100;assert(!attackPermission(r,'zombie','cross'));assert(attackPermission(r,'zombie','jab'));a.fighter.punch.frame=27;assert.equal(phaseOf(a.fighter.punch),'recovery');assert(attackPermission(r,'zombie','cross'));r.lastEnemyAttackTick=r.tick;assert(!attackPermission(r,'zombie','cross'));void b;}
// Schema2 checkpoints persist the counter; old balance checkpoints are incompatible.
{const r=wave(3);r.enemies.forEach(e=>e.fighter.health=0);stepSurvival(r,N);r.player.health=maxHealth(r.player);assert.equal(r.status,'intermission');const mem=new Map(),store=new SurvivalStore({getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)});assert(store.checkpoint(r));const [key,text]=[...mem][0],saved=JSON.parse(text);assert.equal(saved.schema,2);assert.equal(store.loadResume().run.waveZombieSpawns,r.waveZombieSpawns);
 const bad=structuredClone(r);delete bad.waveZombieSpawns;assert.equal(store.checkpoint(bad),false);bad.waveZombieSpawns=bossZombieQuota(3)+1;assert.equal(store.checkpoint(bad),false);
 saved.schema=1;saved.checkpoint.balanceVersion='survival-v2-old';delete saved.checkpoint.waveZombieSpawns;mem.set(key,JSON.stringify(saved));assert.equal(store.loadResume().kind,'incompatible');assert.equal(store.best().clearedWave,3);assert(survivalBalanceVersion().startsWith('survival-v3-'));}
console.log('PASS approved Survival: successful initial/lifetime add quotas, caps/failed spawns, fighter-relative HP, exact damage/Cross ramps, seeded replay, normal contact/guard/dodge, Cross slots and schema2 old-run invalidity.');
