import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { i18nStub } from './lib-i18n-stub.mjs';
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) { const value = { default: JSON.parse(fs.readFileSync(file, 'utf8')) }; cache.set(file, value); return value; }
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, structuredClone, console, setTimeout, clearTimeout,
    require: id => id.endsWith('/i18n') ? i18nStub : load(path.resolve(path.dirname(file), id.endsWith('.json') ? id : id + '.ts')) });
  return exports;
}
const root = path.resolve('prototypes/punchies/src');
const {createRun, stepSurvival, startNextWave, survivalView, survivalBalanceVersion, survivalConfig:c, closestEnemy} = load(root+'/survival/sim.ts');
const {SurvivalStore} = load(root+'/survival/save.ts');
const {arenaCombat, punchPoint, createSimState, step} = load(root+'/sim/sim.ts');
const {NEUTRAL_INPUT:N} = load(root+'/sim/types.ts');
const {tune, TICK_RATE} = load(root+'/sim/tune.ts');
const {maxHealth, punchCfg} = load(root+'/sim/character.ts');
const {normalHurtRadius,separation} = load(root+'/sim/geometry.ts');
const options = {fighter:'mia',skin:'violet',seed:123,runId:'test-run'};
const fresh = () => {const r=createRun(options);r.tick=r.fightStartTick;return r;};
const frozen = r => { r.player.anchored=true; r.player.health=1e9; r.enemies.forEach(e=>{e.fighter.anchored=true;}); };
const combatEvents = events => events.filter(e=>e.kind==='combat').map(e=>e.event);

// Identical seed + inputs, including boss AI, produce identical state/events.
for (const wave of [1,3]) {
  const a=fresh(),b=fresh();
  if(wave===3){for(const r of [a,b]){r.status='intermission';r.wave=2;startNextWave(r);r.tick=r.fightStartTick;}}
  for(let t=0;t<450;t++){
    const input={...N,mx:t%120<60?60:-60,my:30,jab:t%51===0,dodge:t%150===0};
    assert.equal(JSON.stringify(stepSurvival(a,input)),JSON.stringify(stepSurvival(b,input)));
    assert.equal(JSON.stringify(a),JSON.stringify(b));
  }
  const clone=structuredClone(a);
  assert.equal(JSON.stringify(stepSurvival(a,N)),JSON.stringify(stepSurvival(clone,N)));
  assert.equal(JSON.stringify(a),JSON.stringify(clone),'full boss state survives a simulation clone');
}
const timed=fresh(); frozen(timed);
for(let i=0;i<c.waveSeconds*TICK_RATE-1;i++)stepSurvival(timed,N);
assert.equal(timed.status,'active');
const clear=stepSurvival(timed,N);
assert.equal(timed.status,'intermission'); assert.equal(timed.clearedWave,1);
assert.equal(timed.enemies.length,0); assert.ok(clear.some(e=>e.kind==='waveCleared'));
assert.equal(survivalView(timed).timeText,'0:00');
assert.equal(survivalView(timed).xpEnabled,false);
const boss=fresh();boss.status='intermission';boss.wave=2;startNextWave(boss);boss.tick=boss.fightStartTick;
assert.equal(boss.enemies.filter(e=>e.kind==='boss').length,1);
assert.equal(boss.enemies.find(e=>e.kind==='boss').fighter.char,boss.bossChar);
frozen(boss);boss.remainingTicks=1;stepSurvival(boss,N);
assert.equal(boss.clearedWave,3);assert.equal(boss.enemies.length,0,'live boss does not gate clear');
const death=fresh();death.remainingTicks=1;death.player.health=0;
assert.equal(stepSurvival(death,N)[0].kind,'runEnded');assert.equal(death.clearedWave,0);

// Healing counts only killed zombies and clamps to missing health.
const heal=fresh();heal.player.health=maxHealth(heal.player)-20;heal.waveKills=5;heal.waveZombieKills=4;heal.totalKills=5;
heal.remainingTicks=1;heal.hitstop=1;stepSurvival(heal,N);
assert.equal(heal.healing,Math.min(20,4*c.healPerZombieKill));
const noHeal=fresh();noHeal.player.health=maxHealth(noHeal.player)-20;noHeal.waveKills=1;noHeal.totalKills=1;noHeal.remainingTicks=1;noHeal.hitstop=1;
stepSurvival(noHeal,N);assert.equal(noHeal.healing,0,'boss alone does not heal');

// Move and timers are processed once even with a crowd.
const move=fresh();move.enemies.forEach(e=>e.fighter.anchored=true);
const x=move.player.x,stamina=move.player.stamina;stepSurvival(move,{...N,mx:100});
assert.ok(move.player.x>x);assert.ok(move.player.x-x<=tune.movement.speed*2/TICK_RATE);
assert.ok(move.player.stamina>=stamina);
const lock=fresh();lock.enemies=lock.enemies.slice(0,1);lock.enemies[0].fighter.anchored=true;
lock.enemies[0].fighter.x=lock.player.x+130;lock.enemies[0].fighter.y=lock.player.y;
stepSurvival(lock,{...N,jab:true});assert.ok(lock.player.punch);
const facing=[lock.player.fx,lock.player.fy];lock.enemies[0].fighter.x=lock.player.x;lock.enemies[0].fighter.y=lock.player.y+130;
while(lock.player.punch){stepSurvival(lock,N);if(lock.player.punch)assert.deepEqual([lock.player.fx,lock.player.fy],facing);}
assert.ok(lock.player.fy>.9,'finished action reacquires before render');
stepSurvival(lock,N);assert.ok(lock.player.fy>0.9,'reacquire after full recovery');

// Build a real sweet swing with two separate intersecting targets.
const multi=createRun({...options,fighter:'marco'});multi.tick=multi.fightStartTick;multi.enemies=multi.enemies.slice(0,2);
const ps={tick:0,fighters:[multi.player,multi.enemies[0].fighter],timed:false,hitstop:0,fightStartTick:0,result:null};
arenaCombat.processInput(ps,0,{...N,cross:true},[]);
multi.player.fx=1;multi.player.fy=0;multi.player.anchored=true;
multi.player.punch.frame=multi.player.punch.startup+multi.player.punch.sourEarly;
const pt=punchPoint(multi.player,multi.player.punch),spread=separation(multi.enemies[0].fighter,multi.enemies[1].fighter)/2+0.01;
assert.ok(spread<normalHurtRadius(multi.enemies[0].fighter)+punchCfg(multi.player,'cross').hitRadius);
multi.enemies.forEach((e,i)=>{e.fighter.x=pt.x;e.fighter.y=pt.y+(i?spread:-spread);e.fighter.anchored=true;e.attackWait=999;e.fighter.health=10000;});
const killing=structuredClone(multi);killing.enemies.forEach(e=>e.fighter.health=1);
const kills=stepSurvival(killing,N);
assert.equal(kills.filter(e=>e.kind==='kill').length,2);
for(const event of kills.filter(e=>e.kind==='kill')){
 assert.equal(event.visualId,'zombie');assert.ok(event.fighter.health<=0);
 assert.equal(event.position.x,event.fighter.x);assert.equal(event.position.y,event.fighter.y);
 assert.ok(Math.abs(Math.hypot(event.direction.x,event.direction.y)-1)<1e-10);
 assert.ok(event.direction.x>.99,'final cross direction is retained');
 const saved=JSON.stringify(event);stepSurvival(killing,N);assert.equal(JSON.stringify(event),saved,'presentation snapshot survives gameplay removal');
}assert.equal(killing.waveZombieKills,2);assert.equal(killing.totalKills,2);assert.equal(killing.totalZombieKills,2);assert.equal(killing.damageDealt,2,"overkill capped to applied HP per target");
assert.equal(stepSurvival(killing,N).filter(e=>e.kind==='kill').length,0,'dead enemies are removed once');
const beforeHp=multi.enemies.reduce((sum,e)=>sum+e.fighter.health,0);const first=stepSurvival(multi,N);assert.equal(multi.damageDealt,beforeHp-multi.enemies.reduce((sum,e)=>sum+e.fighter.health,0));assert.equal(combatEvents(first).filter(e=>e.kind==='hit'&&e.attacker===0).length,2);
const after=multi.enemies.map(e=>e.fighter.health);
for(let i=0;i<12;i++)stepSurvival(multi,N);
assert.deepEqual(multi.enemies.map(e=>e.fighter.health),after,'one hit per enemy per swing');
assert.equal(multi.swingHits.length,2);assert.ok(multi.enemies.every(e=>e.fighter.pushFrames>0||e.fighter.lock>0));

// Spawn cap, safe borders and separation under sustained population.
const crowd=fresh();frozen(crowd);crowd.spawnWait=0;
for(let t=0;t<2200;t++){
  stepSurvival(crowd,N);assert.ok(crowd.enemies.length<=c.maxActiveEnemies);
  for(const e of crowd.enemies){const f=e.fighter,rad=normalHurtRadius(f);assert.ok(f.x>=tune.ring.left+rad-1e-7&&f.x<=tune.ring.right-rad+1e-7);assert.ok(f.y>=tune.ring.top+rad-1e-7&&f.y<=tune.ring.bottom-rad+1e-7);assert.equal(e.visualId,'zombie');assert.equal(f.char,'marco');}
}
const grow=fresh();const hp=grow.enemies[0].maxHealth,speed=grow.enemies[0].speedRatio;grow.status='intermission';startNextWave(grow);
assert.ok(grow.enemies[0].maxHealth>=c.zombieMinHp&&grow.enemies[0].maxHealth<=c.zombieMaxHp);assert.ok(grow.enemies[0].speedRatio>speed);

// Automatic checkpoint, balance mismatch, consumption, PB and invalid save.
const data=new Map(),adapter={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const store=new SurvivalStore(adapter),run=store.begin(options);run.tick=run.fightStartTick;run.remainingTicks=1;run.hitstop=1;
run.player.lastBlow={punch:'jab',sweet:true,chip:false,dx:1,dy:0};
store.step(run,N);assert.equal(store.loadResume().kind,'ready');assert.equal(store.best().clearedWave,1);
assert.equal(store.saveAndExit(run),true);
assert.equal(store.loadResume('changed').kind,'incompatible');
const resumed=store.loadResume().run;store.advance(resumed);
assert.equal(resumed.wave,2);assert.equal(store.saveAndExit(resumed),false);
assert.equal(store.loadResume().kind,'abandoned');assert.equal(store.loadResume().kind,'none');assert.equal(store.best().clearedWave,1);
const failed=store.begin({...options,runId:'failed'});failed.player.health=0;store.step(failed,N);assert.equal(store.best().clearedWave,1);
store.begin(options);store.abandon(store.begin(options));assert.equal(store.loadResume().kind,'none');
data.set('punchies:survival:v1','{"schema":1,"phase":"checkpoint","checkpoint":{},"best":null}');assert.equal(store.loadResume().kind,'corrupt');
assert.equal(store.best(),null);
assert.throws(()=>new SurvivalStore({getItem:()=>null,setItem:()=>{}}).begin(options),/unavailable/,'save failure cannot report success');
const version=survivalBalanceVersion();c.healPerZombieKill++;assert.notEqual(survivalBalanceVersion(),version);c.healPerZombieKill--;

// Adapter regression: a two-entity input/move/timer step matches boxing step
// away from contacts/facing differences. The regular boxing entry point is intact.
const regular=createSimState({timed:false,fighters:[{char:'marco'},{char:'mia'}]});
regular.fighters[0].x=tune.ring.left+100;regular.fighters[1].x=tune.ring.right-100;
const manual=structuredClone(regular),inputs=[{...N,mx:30,jab:true},N];
step(regular,inputs,false);
for(let i=0;i<2;i++){arenaCombat.processInput(manual,i,inputs[i],[]);arenaCombat.move(manual,i,inputs[i]);arenaCombat.advanceTimers(manual,i,inputs[i],[]);}
assert.equal(JSON.stringify(regular.fighters),JSON.stringify(manual.fighters));
assert.ok(!fs.readFileSync(root+'/survival/sim.ts','utf8').includes('awardMatch'));
console.log('PASS Survival: deterministic zombies/bosses, 30s waves, defeat, kill healing, swing facing, multi-hit dedupe, spawn cap/bounds, checkpoint/version/PB and boxing adapter regression');

// Nearest acquisition refreshes at final movement positions, including neutral hitstop.
const aim=fresh();aim.enemies=aim.enemies.slice(0,2);aim.spawnWait=9999;
aim.enemies.forEach(e=>{e.fighter.anchored=true;e.attackWait=9999;});
const [east,north]=aim.enemies;east.fighter.x=aim.player.x+100;east.fighter.y=aim.player.y;
north.fighter.x=aim.player.x;north.fighter.y=aim.player.y-130;
stepSurvival(aim,N);assert.equal(closestEnemy(aim).id,east.id);assert.ok(aim.player.fx>.99);
north.fighter.y=aim.player.y-80;stepSurvival(aim,N);assert.equal(closestEnemy(aim).id,north.id);assert.ok(aim.player.fy<-.99);
aim.hitstop=2;east.fighter.x=aim.player.x+70;stepSurvival(aim,N);assert.ok(aim.player.fx>.99,'neutral hitstop does not freeze target facing');
stepSurvival(aim,N);stepSurvival(aim,{...N,dodge:true,mx:0,my:100});const dodgeFacing=[aim.player.fx,aim.player.fy];
north.fighter.y=aim.player.y-60;stepSurvival(aim,N);assert.deepEqual([aim.player.fx,aim.player.fy],dodgeFacing,'committed dodge keeps facing');
// Ordinary HP is a seeded inclusive integer range, independent of wave. Boss remains roster HP.
const hpSeen=new Set();for(let seed=0;seed<80;seed++)for(const wave of [1,2,5,50]){
 const r=createRun({...options,seed});if(wave>1){r.status='intermission';r.wave=wave-1;startNextWave(r);}
 for(const e of r.enemies){if(e.kind==='zombie'){assert.ok(Number.isInteger(e.maxHealth)&&e.maxHealth>=6&&e.maxHealth<=10);hpSeen.add(e.maxHealth);}else assert.equal(e.maxHealth,maxHealth(e.fighter));}
}
assert.deepEqual([...hpSeen].sort((a,b)=>a-b),[6,7,8,9,10]);
console.log('PASS closest target switches, hitstop acquisition, dodge lock and seeded 6–10 HP at early/late waves');

const walking=fresh();walking.enemies=walking.enemies.slice(0,2);walking.spawnWait=99999;
walking.enemies.forEach(e=>{e.fighter.anchored=true;e.attackWait=99999;});
walking.enemies[0].fighter.x=walking.player.x+120;walking.enemies[0].fighter.y=walking.player.y;
walking.enemies[1].fighter.x=walking.player.x-121;walking.enemies[1].fighter.y=walking.player.y;
assert.equal(closestEnemy(walking).id,walking.enemies[0].id);
stepSurvival(walking,{...N,mx:-100});assert.equal(closestEnemy(walking).id,walking.enemies[1].id);
assert.ok(walking.player.fx<-.99,'face nearest at final walking position in the same tick');
walking.enemies[1].fighter.health=0;stepSurvival(walking,N);assert.ok(walking.player.fx>.99,'dead enemy is excluded from acquisition');

// The visible hook passes off the old straight ray on later active frames.
// Resolve the actual glove point without changing duel geometry or radius tuning.
const {survivalPunchPoint}=load(root+'/survival/sim.ts');
const pathState=createSimState({timed:false,fighters:[{char:'marco'},{char:'marco'}]});
const [pathAtt,pathDef]=pathState.fighters;pathAtt.x=300;pathAtt.y=200;pathAtt.fx=1;pathAtt.fy=0;
arenaCombat.processInput(pathState,0,{...N,hook:true},[]);
pathAtt.punch.frame=pathAtt.punch.startup+pathAtt.punch.sourEarly+2;
const glove=survivalPunchPoint(pathAtt,pathAtt.punch),ray=punchPoint(pathAtt,pathAtt.punch);
assert.ok(Math.hypot(glove.x-ray.x,glove.y-ray.y)>10,'fixture catches visible arc versus old ray');
const oldBody=tune.body.hurtRadius,oldCore=tune.body.coreRadius,oldHit=tune.punches.hook.hitRadius;
tune.body.hurtRadius=1;tune.body.coreRadius=1;tune.punches.hook.hitRadius=1;
pathDef.x=glove.x;pathDef.y=glove.y;
assert.equal(arenaCombat.detectContacts(pathState,[],survivalPunchPoint).length,1,'visible hook glove connects');
assert.equal(arenaCombat.detectContacts(pathState,[]).length,0,'duel ray is unchanged');
pathDef.x=ray.x;pathDef.y=ray.y;
assert.equal(arenaCombat.detectContacts(pathState,[],survivalPunchPoint).length,0,'empty straight ray is not a ghost hit');
tune.body.hurtRadius=oldBody;tune.body.coreRadius=oldCore;tune.punches.hook.hitRadius=oldHit;
console.log('PASS Survival actual glove path: arc contact and no straight-ray ghost hit, duel defaults preserved');

// Every wave uses the shared FIGHT phase boundary and a full combat timer.
const {fightCueTiming}=load(root+'/sim/fightCue.ts');
const {waveProgression,attackPermission}=load(root+'/survival/sim.ts');
for(const wave of [1,2,3,6]){
 const r=createRun({...options,seed:321});if(wave>1){r.status='intermission';r.wave=wave-1;startNextWave(r);}
 const frozen=JSON.stringify([r.player,r.enemies]);const timer=r.remainingTicks;let ready=0,cue=-1,go=-1;
 while(r.tick<r.fightStartTick){
  const ev=combatEvents(stepSurvival(r,{...N,mx:100,jab:true,dodge:true}));
  ready+=ev.filter(e=>e.kind==='ready').length;
  if(ev.some(e=>e.kind==='fightCue'))cue=r.tick;
  if(ev.some(e=>e.kind==='go'))go=r.tick;
  assert.equal(JSON.stringify([r.player,r.enemies]),frozen,'no combat or AI during entrance');assert.equal(r.remainingTicks,timer);
 }
 assert.equal(ready,1);assert.equal(go-cue,fightCueTiming().entranceTicks);assert.equal(timer,30*TICK_RATE);
 assert.equal(r.enemies.some(e=>e.kind==='boss'),wave%3===0);
 const x=r.player.x;stepSurvival(r,{...N,mx:100});assert(r.player.x>x);assert.equal(r.remainingTicks,timer-1);
}
for(const wave of [1,10,10000]){const p=waveProgression(wave);assert(p.speedRatio<=c.zombieMaxSpeedRatio&&p.attackChance<=c.zombieMaxAttackChance&&p.attackCooldownFrames>=c.zombieMinAttackCooldownFrames);}
assert(waveProgression(10).attackChance>waveProgression(1).attackChance);assert(waveProgression(10).speedRatio>waveProgression(1).speedRatio);
const coordinated=fresh();coordinated.status='intermission';coordinated.wave=2;startNextWave(coordinated);coordinated.tick=coordinated.fightStartTick;
assert(attackPermission(coordinated,'boss'));assert(!attackPermission(coordinated,'zombie'));
coordinated.tick+=c.bossAttackWindowFrames;assert(!attackPermission(coordinated,'boss'));assert(attackPermission(coordinated,'zombie'));
for(let seed=0;seed<30;seed++){
 const r=createRun({...options,seed});for(const e of r.enemies){const f=e.fighter,inset=normalHurtRadius(f)+c.spawnEdgeInset;
 assert([Math.abs(f.x-tune.ring.left-inset),Math.abs(f.x-tune.ring.right+inset),Math.abs(f.y-tune.ring.top-inset),Math.abs(f.y-tune.ring.bottom+inset)].some(n=>n<1e-7),'every initial zombie starts on an inset ring edge');}
}
console.log('PASS 30s waves, bosses every3, shared READY/FIGHT freeze/fade-start unlock, bounded aggression/speed and attack coordination, edge spawns');

const totals=fresh();totals.totalKills=9;totals.totalZombieKills=9;totals.damageDealt=42.5;totals.damageReceived=17;totals.remainingTicks=1;totals.hitstop=1;
stepSurvival(totals,N);const savedTotals=structuredClone(totals);startNextWave(totals);assert.equal(totals.totalZombieKills,9);assert.equal(totals.damageDealt,42.5);assert.equal(totals.damageReceived,17);
const totalsMap=new Map(),totalsStore=new SurvivalStore({getItem:k=>totalsMap.get(k)??null,setItem:(k,v)=>totalsMap.set(k,v)});assert(totalsStore.checkpoint(savedTotals));const restored=totalsStore.loadResume().run;assert.equal(restored.damageDealt,42.5);assert.equal(restored.damageReceived,17);assert.equal(restored.totalZombieKills,9);
const blocked=createRun({...options,fighter:'marco'});blocked.tick=blocked.fightStartTick;blocked.enemies=blocked.enemies.slice(0,1);
const foe=blocked.enemies[0].fighter;foe.anchored=true;foe.guarding=true;foe.guardFrames=tune.guard.perfectFrames+10;blocked.enemies[0].kind='boss';blocked.bossAI={seen:[],cooldown:999,guardHold:10,foeWasPunching:false,rngState:123};
blocked.player.anchored=true;blocked.player.fx=1;blocked.player.fy=0;arenaCombat.processInput({fighters:[blocked.player,foe],tick:0,timed:false,hitstop:0,fightStartTick:0,result:null},0,{...N,jab:true},[]);
blocked.player.punch.frame=blocked.player.punch.startup+blocked.player.punch.sourEarly;const point=load(root+'/survival/sim.ts').survivalPunchPoint(blocked.player,blocked.player.punch);foe.x=point.x;foe.y=point.y;foe.fx=-1;foe.fy=0;
stepSurvival(blocked,N);assert.equal(blocked.damageDealt,0,'block/chip contacts excluded from hit damage stats');
// Boss appearance only writes the Survival save namespace, not collection ownership.
const collectionMap=new Map([['punchies:shop-preview:v1',JSON.stringify({owned:[],welcomeClaimed:false})]]),shopBefore=collectionMap.get('punchies:shop-preview:v1');
const collectionStore=new SurvivalStore({getItem:k=>collectionMap.get(k)??null,setItem:(k,v)=>collectionMap.set(k,v)});let sawTee=false;
for(let seed=0;seed<100;seed++){
 const r=collectionStore.begin({...options,seed});r.status='intermission';r.wave=2;collectionStore.advance(r);if(r.bossChar==='tee'){sawTee=true;r.tick=r.fightStartTick;collectionStore.step(r,N);collectionStore.abandon(r);break;}
}
assert(sawTee,'fixture includes Tee boss');assert.equal(collectionMap.get('punchies:shop-preview:v1'),shopBefore,'appearance never writes ownership');
console.log('PASS cumulative actual-hit damage, overkill/multi-target, block exclusion, zombie totals, checkpoint persistence and Tee appearance ownership isolation');
