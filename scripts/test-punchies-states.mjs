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
// Active ends at frame 45; recovery then runs 200 frames (total 245), the last `whiffFrames` of which are the whiff tail.
const fakePunch = (frame, whiffFrames = 0) => ({ type: 'jab', frame, startup: 40, sourEarly: 3, sweet: 2, sour: 0, recovery: 200, whiffFrames, reach: 0, startReach: 0,
  damageMult: 1, buffed: false, resolved: true, connected: true, hand: 0 });
function land(type, setup, defInput = N, aStars = tune.stars.max) {
  const s = state(); const [a, b] = s.fighters;
  const cfg = punchCfg(a, type);
  a.stars = aStars;
  b.x = a.x + cfg.reach + cfg.hitRadius + tune.body.hurtRadius * tune.view.fighterScale - 0.1;
  setup(b);
  const all = [];
  for (let t = 0; t < 60; t++) {
    all.push(...step(s, [t === 0 ? { ...N, [type]: true } : N, defInput], false));
    if (all.some(e => e.kind === 'hit' || e.kind === 'block')) break;
  }
  return { event: all.find(e => e.kind === 'hit' || e.kind === 'block'), b, a };
}
// 1. Counter flags decide who punishes a defender in punch startup or in the whiff tail of recovery.
for (const type of TYPES) {
  const flags = tune.punches[type];
  const startup = land(type, (b) => { b.punch = fakePunch(0); });
  const whiffTail = land(type, (b) => { b.punch = fakePunch(150, 100); });
  const whiffHead = land(type, (b) => { b.punch = fakePunch(48, 100); });
  const connectedRecovery = land(type, (b) => { b.punch = fakePunch(60, 0); });
  const neutral = land(type, (b) => { b.forceVulnerable = true; });
  for (const r of [startup, whiffTail, whiffHead, connectedRecovery]) assert.equal(r.event.kind, 'hit');
  assert.equal(!!startup.event.counter, flags.counterStartup > 0, `${type} startup counter follows its flag`);
  assert.equal(!!whiffTail.event.counter, flags.counterWhiff > 0, `${type} whiff-tail counter follows its flag`);
  assert.equal(!!whiffHead.event.counter, false, `${type} does not counter the base recovery of a whiffed punch`);
  assert.equal(!!connectedRecovery.event.counter, false, `${type} does not counter the recovery of a punch that connected`);
  assert.equal(!!neutral.event.counter, false, `${type} never counters a plain vulnerable defender`);
}
// Flags are live tune values: flipping one changes the outcome.
{
  const before = tune.punches.jab.counterStartup;
  tune.punches.jab.counterStartup = 1;
  assert.equal(land('jab', (b) => { b.punch = fakePunch(0); }).event.counter, true);
  tune.punches.jab.counterStartup = before;
}
// Guard release and dodge exposure leave the defender vulnerable (full damage) but are never counters.
for (const type of TYPES) {
  for (const pen of ['guardPenalty', 'postDodgeVulnerable']) {
    const r = land(type, (b) => { b[pen] = 100; });
    assert.equal(r.event.kind, 'hit');
    assert.equal(!!r.event.counter, false, `${type} does not counter ${pen}`);
    assert.equal(r.event.row, 'vulnerable', `${type} still takes the vulnerable row during ${pen}`);
  }
}
// A counter gives stars.counterGain, a plain sweet hit gives 1.
{
  const before = tune.punches.jab.counterStartup;
  tune.punches.jab.counterStartup = 1;
  const counter = land('jab', (b) => { b.punch = fakePunch(0); }, N, 0);
  assert.equal(counter.a.stars, tune.stars.counterGain, 'counter stars');
  tune.punches.jab.counterStartup = before;
  const plain = land('jab', (b) => { b.forceVulnerable = true; }, N, 0);
  assert.equal(plain.a.stars, 1, 'plain sweet hit gives one star');
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
console.log('Per-punch counter flags (startup / whiff tail only), guard release and dodge exposure are vulnerable but not counters, counter stars, exhausted guard chip with uppercut exception and no perfect guard, and half-efficacy exhausted dodge passed');

// 4. Hit and block stun: the defender is locked (no actions, no walking), the lock scales with the character push
// multiplier, and the frame advantage follows the design: sweet hit favours the attacker, block and sour hit the defender.
function advantage(type, mode) {
  const sim = createSimState({ timed: false, fighters: [{ char: 'marco', infiniteStamina: true }, { char: 'marco', anchored: true, infiniteStamina: true }] });
  const [a, b] = sim.fighters;
  a.x = 200; a.y = b.y = 210; a.stars = tune.stars.max;
  const cfg = punchCfg(a, type);
  const dist = mode === 'sour' ? 56 : cfg.reach + cfg.hitRadius + tune.body.hurtRadius * tune.view.fighterScale - 0.1;
  b.x = a.x + dist;
  const def = mode === 'block' ? { ...N, guard: true } : N;
  let hit = null, ta = null, td = null, t0 = null, locked = null;
  for (let t = 0; t < 140 && (ta === null || td === null); t++) {
    const ev = step(sim, [t === 0 ? { ...N, [type]: true } : N, def], false);
    const h = ev.find(e => e.kind === 'hit' || e.kind === 'block');
    if (h && hit === null) { hit = h; t0 = t; locked = b.lock; }
    if (hit) { if (ta === null && a.punch === null) ta = t; if (td === null && b.lock === 0) td = t; }
  }
  return { hit, advantage: td - ta, locked, b, sim };
}
for (const type of ['jab', 'cross', 'hook']) {
  const sweet = advantage(type, 'hit'), block = advantage(type, 'block'), sour = advantage(type, 'sour');
  assert.equal(sweet.hit.kind, 'hit'); assert.equal(sweet.hit.sweet, true);
  assert.ok(sweet.advantage >= 0 && sweet.advantage <= 4, `${type} sweet hit is a small attacker advantage (${sweet.advantage})`);
  assert.equal(block.hit.kind, 'block');
  assert.ok(block.advantage < 0, `${type} block favours the defender (${block.advantage})`);
  assert.equal(sour.hit.kind, 'hit'); assert.equal(sour.hit.sweet, false);
  assert.ok(sour.advantage < 0, `${type} sour hit favours the defender (${sour.advantage})`);
  assert.equal(sweet.locked, punchCfg('marco', type).hitStun, `${type} lock equals its hit stun`);
  assert.equal(block.locked, punchCfg('marco', type).blockStun, `${type} lock equals its block stun`);
  // A counter widens the window but never guarantees a jab follow-up (contact needs startup + early frames after the attacker is free).
  const jab = punchCfg('marco', 'jab');
  const counterAdvantage = sweet.advantage + Math.round(punchCfg('marco', type).hitStun * tune.hit.counterStunMult) - punchCfg('marco', type).hitStun;
  assert.ok(counterAdvantage > sweet.advantage, `${type} counter gives a bigger window`);
  assert.ok(counterAdvantage < jab.startup + jab.sourEarly, `${type} counter (${counterAdvantage}) does not guarantee a jab follow-up`);
}
{
  const up = advantage('uppercut', 'hit').advantage;
  const jab = punchCfg('marco', 'jab');
  const counterUp = up + Math.round(punchCfg('marco', 'uppercut').hitStun * tune.hit.counterStunMult) - punchCfg('marco', 'uppercut').hitStun;
  assert.ok(up > 0 && counterUp < jab.startup + jab.sourEarly, `uppercut advantage ${up}, counter ${counterUp}`);
}
// Character push scales the stun along with the shove.
near(punchCfg('bruno', 'cross').hitStun, Math.round(tune.punches.cross.hitStun * tune.characters.bruno.cross.push));
assert.ok(punchCfg('bruno', 'cross').hitStun > punchCfg('marco', 'cross').hitStun);
// While locked: no punches or dodges start, no walking, and the guard is held without a release penalty.
{
  const r = advantage('jab', 'hit');
  const b = r.b, sim = r.sim;
  b.lock = 6; b.punch = null; b.dodge = null;
  const x0 = b.x;
  step(sim, [N, { ...N, jab: true, mx: 100 }], false);
  assert.equal(b.punch, null, 'cannot punch while locked');
  b.anchored = false; b.pushFrames = 0; b.pushX = b.pushY = 0;
  const bx = b.x;
  step(sim, [N, { ...N, mx: -100 }], false);
  near(bx - b.x, tune.movement.speed * tune.movement.lockMoveMult / 60, 'a locked fighter walks at the lock multiplier');
  b.anchored = true;
  const g = advantage('cross', 'block');
  assert.ok(g.b.guardPenalty === 0, 'blocking never starts a release penalty');
  g.b.lock = 4;
  g.b.guarding = true;
  step(g.sim, [N, N], false);
  assert.ok(g.b.guarding && g.b.guardPenalty === 0, 'guard is held through block stun even if the button is released');
}
// A counter stretches the window so the attacker can follow up.
{
  const normal = advantage('jab', 'hit');
  const counter = (() => {
    const sim = createSimState({ timed: false, fighters: [{ char: 'marco', infiniteStamina: true }, { char: 'marco', anchored: true, infiniteStamina: true }] });
    const [a, b] = sim.fighters;
    a.x = 200; a.y = b.y = 210;
    b.x = a.x + punchCfg(a, 'jab').reach + punchCfg(a, 'jab').hitRadius + tune.body.hurtRadius * tune.view.fighterScale - 0.1;
    b.punch = fakePunch(0);
    tune.punches.jab.counterStartup = 1;
    let lock = null;
    for (let t = 0; t < 40 && lock === null; t++) {
      const ev = step(sim, [t === 0 ? { ...N, jab: true } : N, N], false);
      if (ev.some(e => e.kind === 'hit' && e.counter)) lock = b.lock;
    }
    tune.punches.jab.counterStartup = 0;
    return lock;
  })();
  assert.equal(counter, Math.round(punchCfg('marco', 'jab').hitStun * tune.hit.counterStunMult));
  assert.ok(counter > normal.locked);
}
console.log('Hit and block stun: locks actions, slows walking, scales with push, advantage signs, guard held through block stun, counter window passed');

// A real whiff adds the whiff tail to the punch; a punch that connects never has one.
for (const type of ['jab', 'cross', 'hook']) {
  const sim = createSimState({ timed: false, fighters: [{ char: 'marco', infiniteStamina: true }, { char: 'marco', anchored: true, infiniteStamina: true }] });
  const [a, b] = sim.fighters; a.x = 200; b.x = 900; a.y = b.y = 210;
  let whiffed = false;
  for (let t = 0; t < 60 && !whiffed; t++) whiffed = step(sim, [t === 0 ? { ...N, [type]: true } : N, N], false).some(e => e.kind === 'whiff');
  assert.ok(whiffed && a.punch, `${type} whiffs`);
  assert.equal(a.punch.whiffFrames, tune.punches[type].whiffRecovery, `${type} whiff tail length`);
  const hit = land(type, (d) => { d.forceVulnerable = true; });
  assert.equal(hit.a.punch === null || hit.a.punch.whiffFrames === 0, true, `${type} that connects has no whiff tail`);
}
console.log('Whiff tail is attached to missed punches only');
