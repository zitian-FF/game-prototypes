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
const { createSimState, step, stanceOf, dodgeIFrames } = load(root + '/sim.ts');
const { NEUTRAL_INPUT: N } = load(root + '/types.ts');
const { tune, TICK_RATE } = load(root + '/tune.ts');
const { maxStamina, regenMult, punchCfg } = load(root + '/character.ts');
Object.assign(tune.ring, { left: 0, top: 0, right: 1200, bottom: 800 });
function state(char = 'marco') {
  const s = createSimState({ timed: false, fighters: [{ char }, { char: 'marco', anchored: true }] });
  s.fighters[0].x = 200; s.fighters[1].x = 800;
  return s;
}
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-7, `${m ?? ''} ${a} != ${b}`);
const TYPES = ['jab', 'cross', 'hook', 'uppercut'];
// A defender mid-punch: startup, or recovery, with its own fist already resolved so it cannot interfere.
const fakePunch = (frame) => ({ type: 'jab', frame, startup: 40, sourEarly: 3, sweet: 2, sour: 0, recovery: 100, reach: 0, startReach: 0,
  damageMult: 1, buffed: false, resolved: true, connected: true, hand: 0 });
function land(type, setup, defInput = N) {
  const s = state(); const [a, b] = s.fighters;
  const cfg = punchCfg(a, type);
  a.stars = tune.stars.max;
  b.x = a.x + cfg.reach + cfg.hitRadius + tune.body.hurtRadius * tune.view.fighterScale - 0.1;
  setup(b);
  const all = [];
  for (let t = 0; t < 60; t++) {
    all.push(...step(s, [t === 0 ? { ...N, [type]: true } : N, defInput], false));
    if (all.some(e => e.kind === 'hit' || e.kind === 'block')) break;
  }
  return { event: all.find(e => e.kind === 'hit' || e.kind === 'block'), b };
}
// 1. Counter flags decide who punishes a defender in startup or recovery.
for (const type of TYPES) {
  const flags = tune.punches[type];
  const startup = land(type, (b) => { b.punch = fakePunch(0); });
  const recovery = land(type, (b) => { b.punch = fakePunch(46); });
  const neutral = land(type, (b) => { b.forceVulnerable = true; });
  assert.equal(startup.event.kind, 'hit'); assert.equal(recovery.event.kind, 'hit');
  assert.equal(!!startup.event.counter, flags.counterStartup > 0, `${type} startup counter follows its flag`);
  assert.equal(!!recovery.event.counter, flags.counterRecovery > 0, `${type} recovery counter follows its flag`);
  assert.equal(!!neutral.event.counter, false, `${type} never counters a plain vulnerable defender`);
}
// Flags are live tune values: flipping one changes the outcome.
{
  const before = tune.punches.jab.counterStartup;
  tune.punches.jab.counterStartup = 1;
  assert.equal(land('jab', (b) => { b.punch = fakePunch(0); }).event.counter, true);
  tune.punches.jab.counterStartup = before;
}
// Punished states still counter with any punch.
for (const type of TYPES) {
  for (const pen of ['guardPenalty', 'postDodgeVulnerable']) {
    assert.equal(land(type, (b) => { b[pen] = 100; }).event.counter, true, `${type} counters ${pen}`);
  }
}
// 2. An exhausted guard blocks, with chip from every punch except the uppercut, and has no Perfect Guard window.
for (const type of ['jab', 'cross', 'hook']) {
  const r = land(type, (b) => { b.exhausted = true; b.stamina = 0; b.guarding = true; b.guardFrames = 0; }, { ...N, guard: true });
  assert.equal(r.event.kind, 'block', `${type} is blocked by an exhausted guard`);
  const dmg = punchCfg('marco', type).damage;
  const sweet = dmg * tune.guard.exhaustedChipMult;
  assert.ok(Math.abs(r.event.chip - sweet) < 1e-7 || Math.abs(r.event.chip - sweet * tune.hit.reducedDamageMult) < 1e-7, `${type} chip ${r.event.chip} is a share of ${dmg}`);
  near(r.b.health, tune.health.max - r.event.chip, `${type} health lost equals chip`);
}
{
  const r = land('uppercut', (b) => { b.exhausted = true; b.stamina = 0; b.guarding = true; b.guardFrames = 10; }, { ...N, guard: true });
  assert.equal(r.event.kind, 'hit', 'uppercut ignores an exhausted guard');
  assert.equal(r.event.row, 'vulnerable');
  assert.ok(r.b.health < tune.health.max);
}
{
  const s = state(); const f = s.fighters[0];
  f.exhausted = true; f.stamina = 0;
  step(s, [{ ...N, guard: true }, N], false);
  assert.ok(f.guarding);
  assert.equal(stanceOf(f), 'guard');
  assert.notEqual(stanceOf(f), 'perfectGuard');
  const stamina = f.stamina;
  step(s, [{ ...N, guard: true }, N], false);
  assert.ok(f.stamina >= stamina, 'guarding while exhausted never drains stamina');
}
// 3. An exhausted dodge keeps half the invincible frames and half the distance, and costs nothing.
{
  const full = state(); const half = state();
  half.fighters[0].exhausted = true; half.fighters[0].stamina = 0;
  const input = { ...N, dodge: true, mx: 100 };
  step(full, [input, N], false); step(half, [input, N], false);
  assert.ok(full.fighters[0].dodge && half.fighters[0].dodge);
  assert.equal(dodgeIFrames(half.fighters[0]), Math.round(tune.dodge.iFrames * tune.dodge.exhaustedEfficacy));
  assert.equal(dodgeIFrames(full.fighters[0]), tune.dodge.iFrames);
  const x0 = 200;
  for (let i = 0; i < tune.dodge.frames; i++) { step(full, [N, N], false); step(half, [N, N], false); }
  const dFull = full.fighters[0].x - x0, dHalf = half.fighters[0].x - x0;
  assert.ok(dFull > 0 && Math.abs(dHalf / dFull - tune.dodge.exhaustedEfficacy) < 0.12, `dodge distance ratio ${dHalf / dFull}`);
  assert.ok(half.fighters[0].exhausted);
  // Hits during the kept invincible frames are dodged, hits after them are not.
  const f = half.fighters[0];
  f.postDodgeVulnerable = 0; f.dodge = { frame: 0, dx: 1, dy: 0 };
  assert.equal(stanceOf(f), 'dodging');
  f.dodge.frame = dodgeIFrames(f);
  assert.equal(stanceOf(f), 'vulnerable');
}
console.log('Per-punch counter flags (startup/recovery), punished states, exhausted guard chip with uppercut exception and no perfect guard, and half-efficacy exhausted dodge passed');
