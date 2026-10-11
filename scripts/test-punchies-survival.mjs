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
const {createRun, stepSurvival, startNextWave, survivalView, survivalBalanceVersion, survivalConfig:c} = load(root+'/survival/sim.ts');
const {SurvivalStore} = load(root+'/survival/save.ts');
const {arenaCombat, punchPoint, createSimState, step} = load(root+'/sim/sim.ts');
const {NEUTRAL_INPUT:N} = load(root+'/sim/types.ts');
const {tune, TICK_RATE} = load(root+'/sim/tune.ts');
const {maxHealth, punchCfg} = load(root+'/sim/character.ts');
const {normalHurtRadius,separation} = load(root+'/sim/geometry.ts');
const options = {fighter:'mia',skin:'violet',seed:123,runId:'test-run'};
const fresh = () => createRun(options);
const frozen = r => { r.player.anchored=true; r.player.health=1e9; r.enemies.forEach(e=>{e.fighter.anchored=true;}); };
const combatEvents = events => events.filter(e=>e.kind==='combat').map(e=>e.event);

// Identical seed + inputs, including boss AI, produce identical state/events.
for (const wave of [1,5]) {
  const a=fresh(),b=fresh();
  if(wave===5){for(const r of [a,b]){r.status='intermission';r.wave=4;startNextWave(r);}}
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
const boss=fresh();boss.status='intermission';boss.wave=4;startNextWave(boss);
assert.equal(boss.enemies.filter(e=>e.kind==='boss').length,1);
assert.equal(boss.enemies.find(e=>e.kind==='boss').fighter.char,boss.bossChar);
frozen(boss);boss.remainingTicks=1;stepSurvival(boss,N);
assert.equal(boss.clearedWave,5);assert.equal(boss.enemies.length,0,'live boss does not gate clear');
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
while(lock.player.punch){stepSurvival(lock,N);assert.deepEqual([lock.player.fx,lock.player.fy],facing);}
stepSurvival(lock,N);assert.ok(lock.player.fy>0.9,'reacquire after full recovery');

// Build a real sweet swing with two separate intersecting targets.
const multi=createRun({...options,fighter:'marco'});multi.enemies=multi.enemies.slice(0,2);
const ps={tick:0,fighters:[multi.player,multi.enemies[0].fighter],timed:false,hitstop:0,fightStartTick:0,result:null};
arenaCombat.processInput(ps,0,{...N,cross:true},[]);
multi.player.fx=1;multi.player.fy=0;multi.player.anchored=true;
multi.player.punch.frame=multi.player.punch.startup+multi.player.punch.sourEarly;
const pt=punchPoint(multi.player,multi.player.punch),spread=separation(multi.enemies[0].fighter,multi.enemies[1].fighter)/2+0.01;
assert.ok(spread<normalHurtRadius(multi.enemies[0].fighter)+punchCfg(multi.player,'cross').hitRadius);
multi.enemies.forEach((e,i)=>{e.fighter.x=pt.x;e.fighter.y=pt.y+(i?spread:-spread);e.fighter.anchored=true;e.attackWait=999;e.fighter.health=10000;});
const killing=structuredClone(multi);killing.enemies.forEach(e=>e.fighter.health=1);
const kills=stepSurvival(killing,N);
assert.equal(kills.filter(e=>e.kind==='kill').length,2);assert.equal(killing.waveZombieKills,2);assert.equal(killing.totalKills,2);
assert.equal(stepSurvival(killing,N).filter(e=>e.kind==='kill').length,0,'dead enemies are removed once');
const first=stepSurvival(multi,N);assert.equal(combatEvents(first).filter(e=>e.kind==='hit'&&e.attacker===0).length,2);
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
assert.ok(grow.enemies[0].maxHealth>hp&&grow.enemies[0].speedRatio>speed);

// Automatic checkpoint, balance mismatch, consumption, PB and invalid save.
const data=new Map(),adapter={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const store=new SurvivalStore(adapter),run=store.begin(options);run.remainingTicks=1;run.hitstop=1;
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
console.log('PASS Survival: deterministic zombies/bosses, 60s waves, defeat, kill healing, swing facing, multi-hit dedupe, spawn cap/bounds, checkpoint/version/PB and boxing adapter regression');
