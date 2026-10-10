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
const { createSimState, step, stanceOf } = load(root + '/sim.ts');
const { NEUTRAL_INPUT: N } = load(root + '/types.ts');
const { tune, TICK_RATE } = load(root + '/tune.ts');
const { maxStamina, regenMult, punchCfg } = load(root + '/character.ts');
Object.assign(tune.ring, { left: 0, top: 0, right: 1200, bottom: 800 });
function state(char = 'marco') {
  const s = createSimState({ timed: false, fighters: [{ char }, { char: 'marco', anchored: true }] });
  s.fighters[0].x = 200; s.fighters[1].x = 800;
  return s;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
for (const char of ['marco', 'mia', 'bruno']) {
  const s = state(char), f = s.fighters[0];
  f.stamina = 0; f.regenWait = 99;
  let events = step(s, [{ ...N, guard: true }, N], false);
  assert.ok(f.exhausted && f.guarding && !f.dodge, 'exhausted fighters may guard');
  assert.equal(stanceOf(f), 'guard', 'no perfect guard window while exhausted');
  assert.ok(!events.some(e => e.kind === 'staminaRejected'));
  events = step(s, [{ ...N, dodge: true }, N], false);
  assert.ok(f.exhausted && f.dodge && !f.guarding, 'exhausted fighters may dodge at reduced efficacy');
  assert.ok(!events.some(e => e.kind === 'staminaRejected'));
  f.dodge = null; f.postDodgeVulnerable = 0; f.stamina = 0; f.regenWait = 99;
  step(s, [N, N], false);
  const rate = tune.stamina.regenIdlePerSec * regenMult(f) / TICK_RATE;
  near(f.stamina, rate);
  f.stamina = 21;
  step(s, [N, N], false);
  assert.ok(f.exhausted, 'old recovery threshold must not exit emergency');
  near(f.stamina, 21 + rate);
  for (const type of ['jab', 'cross', 'hook', 'uppercut']) {
    f.punch = null; f.stunTimer = 0; f.stars = tune.stars.max;
    const before = f.stamina;
    events = step(s, [{ ...N, [type]: true }, N], false);
    assert.ok(events.some(e => e.kind === 'throw' && e.punch === type));
    near(f.stamina, before + rate);
  }
  f.stunTimer = 10; f.regenWait = 99; s.hitstop = 3;
  const before = f.stamina;
  step(s, [N, N], false);
  near(f.stamina, before + rate, 'hitstop must not stall recovery');
  s.hitstop = 0; f.punch = null; f.stamina = maxStamina(f) - rate / 2;
  step(s, [N, N], false);
  assert.equal(f.exhausted, false);
  near(f.stamina, maxStamina(f));
}
// A normal punch which exactly empties the meter enters emergency immediately.
const depleted = state();
depleted.fighters[0].stamina = punchCfg('marco', 'jab').staminaCost;
step(depleted, [{ ...N, jab: true }, N], false);
assert.ok(depleted.fighters[0].exhausted);
for (const char of ['marco', 'mia', 'bruno']) for (const type of ['jab', 'cross', 'hook', 'uppercut']) {
  const insufficient = state(char), f = insufficient.fighters[0];
  f.stamina = 1; f.stars = tune.stars.max;
  const events = step(insufficient, [{ ...N, [type]: true }, N], false);
  assert.ok(events.some(e => e.kind === 'throw' && e.punch === type));
  assert.ok(!events.some(e => e.kind === 'staminaRejected'));
  assert.ok(f.exhausted, 'unaffordable punch enters emergency');
}
const lowDodge = state(); lowDodge.fighters[0].stamina = 1;
assert.ok(step(lowDodge, [{ ...N, dodge: true }, N], false).some(e => e.kind === 'staminaRejected'));
assert.equal(lowDodge.fighters[0].dodge, null);
for (const [type, cost] of Object.entries({ jab: 4.8, cross: 10.8, hook: 8.4, uppercut: 12 })) near(tune.punches[type].staminaCost, cost);
near(tune.dodge.staminaCost, 17.28); near(tune.guard.staminaDrainPerSec, 7.2);

function hit(type, emergencyAtt, emergencyDef, counter = false, buff = false, fatigued = false) {
  const s = state(); const [a, b] = s.fighters;
  const cfg = punchCfg(a, type);
  a.stamina = emergencyAtt ? 0 : maxStamina(a);
  a.exhausted = emergencyAtt;
  a.stars = tune.stars.max;
  if (fatigued && type !== 'uppercut') a.fatigue[type] = 6;
  a.dashBuff = buff ? 20 : 0;
  b.x = a.x + cfg.reach + cfg.hitRadius + tune.body.hurtRadius * tune.view.fighterScale - 0.1;
  b.forceVulnerable = !emergencyDef;
  b.stamina = emergencyDef ? 20 : maxStamina(b);
  b.exhausted = emergencyDef;
  b.guardPenalty = counter ? 100 : 0;
  const all = [];
  for (let t = 0; t < 50; t++) {
    all.push(...step(s, [t === 0 ? { ...N, [type]: true } : N, N], false));
    if (all.some(e => e.kind === 'hit')) break;
  }
  return { event: all.find(e => e.kind === 'hit'), defender: b, sim: s };
}
for (const type of ['jab', 'cross', 'hook', 'uppercut']) {
  for (const counter of [false, true]) for (const buff of [false, true]) for (const fatigued of [false, true]) {
    const normal = hit(type, false, false, counter, buff, fatigued);
    const emergency = hit(type, true, false, counter, buff, fatigued);
    assert.ok(normal.event && emergency.event);
    near(emergency.event.damage, normal.event.damage * 0.5);
    const exposed = hit(type, false, true, counter, buff, fatigued);
    assert.equal(exposed.event.row, 'vulnerable', 'outer body contact is a headshot in emergency');
    near(exposed.defender.stamina, 20 + exposed.sim.tick * tune.stamina.regenIdlePerSec * regenMult(exposed.defender) / TICK_RATE);
    assert.ok(exposed.defender.exhausted);
  }
}
const s = state(); s.fighters[0].exhausted = true; s.fighters[0].dodge = { frame: 0, dx: 1, dy: 0 };
assert.equal(stanceOf(s.fighters[0]), 'dodging');
s.fighters[0].dodge.frame = Math.round(tune.dodge.iFrames * tune.dodge.exhaustedEfficacy);
assert.equal(stanceOf(s.fighters[0]), 'vulnerable', 'exhausted dodge keeps half the invincible frames');
console.log('Emergency entry/full-only exit, uninterrupted protected recovery, all punches, exhausted guard and half dodge, headshots and half damage with counter/buff multipliers passed');
