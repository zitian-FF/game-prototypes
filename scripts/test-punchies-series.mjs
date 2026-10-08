import assert from 'node:assert/strict';
import { i18nStub } from './lib-i18n-stub.mjs';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = path.resolve('prototypes/punchies/src/sim');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return { default: JSON.parse(fs.readFileSync(file, 'utf8')) };
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, structuredClone, console, setTimeout, clearTimeout,
    require: (id) => load(path.resolve(path.dirname(file), id.endsWith('.json') ? id : id + '.ts')) });
  return exports;
}
const { newSeries, finishRound } = load(root + '/series.ts');
for (const results of [[0, 0], [1, 1], [0, 1, 0], [1, 0, 1], [null, 0, null, 1, 0]]) {
  let series = newSeries(3);
  for (let i = 0; i < results.length; i++) {
    const prior = JSON.stringify(series);
    const result = finishRound(series, results[i]);
    assert.equal(JSON.stringify(series), prior, 'round scoring must not mutate its incoming state');
    assert.equal(result.complete, i === results.length - 1);
    series = result.series;
  }
  assert.equal(Math.max(...series.wins), 2);
}
assert.equal(finishRound(newSeries(1), null).complete, true);
assert.equal(finishRound(newSeries(1), 1).complete, true);
assert.equal(newSeries(3).wins.reduce((a, b) => a + b), 0, 'rematch resets score');
const { createSimState, step } = load(root + '/sim.ts');
const { NEUTRAL_INPUT } = load(root + '/types.ts');
const { tune, TICK_RATE } = load(root + '/tune.ts');
const a = createSimState({ timed: true, fighters: [{ char: 'mia' }, { char: 'bruno' }] });
a.fighters[0].health = 0;
a.fighters[1].stamina = 0;
const b = createSimState({ timed: true, fighters: [{ char: 'mia' }, { char: 'bruno' }] });
assert.ok(b.fighters.every(f => f.health > 0 && f.stamina > 0));
assert.equal(b.tick, 0);
assert.equal(b.result, null);
const intro = Math.round(tune.match.introSec * TICK_RATE);
let sawReady = false, sawGo = false;
const startX = b.fighters[0].x;
for (let i = 0; i <= intro; i++) {
  const events = step(b, [{ ...NEUTRAL_INPUT, mx: 1 }, NEUTRAL_INPUT]);
  sawReady ||= events.some(e => e.kind === 'ready');
  sawGo ||= events.some(e => e.kind === 'go');
  if (i < intro) assert.equal(b.fighters[0].x, startX, 'round announcement freezes combat');
}
assert.ok(sawReady && sawGo);
console.log('Bo3 sweeps, deciders, draws, Bo1, rematch score reset, fresh meters and frozen round intro passed');

// Exercise the online scene's actual round handshake without a browser transport.
const transitions = [], sent = [], splashes = [];
let resultActions;
const sceneExports = {};
const sceneFile = path.resolve(root, '../scenes/MatchScene.ts');
const sceneCode = ts.transpileModule(fs.readFileSync(sceneFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(sceneCode, { exports: sceneExports, performance, console, require: (id) => {
  if (id === 'phaser') return { default: { Scene: class {} } };
  if (id === '../sim/series') return { newSeries, finishRound };
  if (id === '../sim/tune') return { tune, TICK_RATE };
  if (id === '../ui/matchPresentation') return {
    roundSplash: (_scene, next) => splashes.push(next),
    matchResult: (_scene, _text, actions) => { resultActions = actions; return { setText() {} }; },
  };
  if (id === '../ui/presentation') return { startScreen: (_scene, key, data) => transitions.push({ key, data }) };
  if (id === '../i18n') return i18nStub;
  if (id === '../portal/gameplay') return { setGameplay() {}, trackFightScene() {} };
  if (id === '../portal/analytics') return { track() {} };
  return {};
} });
function online(series, winner) {
  const scene = new sceneExports.MatchScene();
  Object.assign(scene, { series, match: { round: 7, localIdx: 0, chars: ['marco', 'mia'], session: { send: m => sent.push(m) } },
    ls: { confirmedResult: () => ({ winner }) }, waiting: { setVisible() {} },
    stage: { setSeries() {} }, time: { addEvent() {} },
    scene: { restart: data => transitions.push({ key: 'restart', data }) } });
  return scene;
}
const early = online(newSeries(3), 0);
early.rematchRemote = true; // Opponent finished its KO before this client.
early.tryRematch();
assert.equal(splashes.length, 0, 'never advance before our round is confirmed');
early.showResult();
early.tryRematch();
assert.equal(splashes.length, 1, 'duplicate readiness must not restart twice');
assert.equal(sent.at(-1).round, 8);
splashes.pop()();
assert.equal(transitions.at(-1).data.round, 8);
assert.equal(transitions.at(-1).data.series.wins[0], 1);
const late = online(newSeries(3), 1);
late.showResult();
assert.equal(splashes.length, 0, 'wait for the other client');
late.rematchRemote = true;
late.tryRematch();
assert.equal(splashes.length, 1);
splashes.pop()();
const final = online({ bestOf: 3, roundNumber: 2, wins: [1, 0] }, 0);
final.showResult();
assert.equal(splashes.length, 0, 'series completion stays on the result');
resultActions.rematch();
final.rematchRemote = true;
final.tryRematch();
splashes.pop()();
assert.equal(transitions.at(-1).data.series, undefined, 'online rematch creates a fresh series');
console.log('Online early/late readiness, duplicate packets, carried score, final result and rematch reset passed');

// First-match showcase runs before the ordinary round countdown, not combat.
const showcase=createSimState({timed:true,showcase:true,fighters:[{char:'mia'},{char:'bruno'}]});
const showcaseTicks=Math.round(tune.view.fightPresentation.showcaseMs*TICK_RATE/1000);
assert.equal(showcase.fightStartTick,intro+showcaseTicks);
const initial=JSON.stringify(showcase.fighters);
let readyAt=-1,goAt=-1;
for(let i=0;i<showcase.fightStartTick;i++){
 const events=step(showcase,[{...NEUTRAL_INPUT,mx:1,jab:true,dodge:true,guard:true},NEUTRAL_INPUT]);
 if(events.some(e=>e.kind==='ready'))readyAt=i;
 if(events.some(e=>e.kind==='go'))goAt=i+1;
 assert.equal(JSON.stringify(showcase.fighters),initial,'showcase/countdown must freeze all combat resources and motion');
}
assert.equal(readyAt,showcaseTicks);assert.equal(goAt,showcase.fightStartTick);
const {Rollback,hashState}=load(path.resolve(root,'../net/rollback.ts'));
const peers=[0,1].map(i=>new Rollback(i,3,12,1,()=>{},()=>{},['mia','bruno'],{showcase:true}));
assert.equal(hashState(peers[0].sim),hashState(peers[1].sim),'both peers use the same frozen intro timing');
assert.ok(tune.view.fightPresentation.koHoldMs+tune.view.fightPresentation.fadeMs<=Math.min(tune.ko.dropMs,tune.ko.flyMs+tune.ko.sitMs)+tune.ko.resultDelayMs,'KO title finishes before result/round splash');
console.log('First-round showcase timing, delayed ROUND/FIGHT, full combat freeze, online peer hashes and KO/result ordering passed');

// A delayed tween must never linger behind the result panel.
const stageExports={};
const stageCode=ts.transpileModule(fs.readFileSync(path.resolve(root,'../scenes/FightStage.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(stageCode,{exports:stageExports,require:()=>({})});
let clears=0,finished=false;
const stageStub={ko:{finished:()=>finished},clearKoTitle:()=>clears++};
assert.equal(stageExports.FightStage.prototype.koFinished.call(stageStub,{},0),false);
assert.equal(clears,0);finished=true;
assert.equal(stageExports.FightStage.prototype.koFinished.call(stageStub,{},2000),true);
assert.equal(clears,1);
assert.equal(stageStub.clearKoTitle,null);
console.log('Completed KO removes presentation before results, including delayed background-tab tweens');
