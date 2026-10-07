import assert from 'node:assert/strict';
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
  return {};
} });
function online(series, winner) {
  const scene = new sceneExports.MatchScene();
  Object.assign(scene, { series, match: { round: 7, localIdx: 0, session: { send: m => sent.push(m) } },
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
