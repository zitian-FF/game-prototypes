import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: `export * from './prototypes/punchies/src/sim/sim'; export {punchCfg} from './prototypes/punchies/src/sim/character'; export {tune} from './prototypes/punchies/src/sim/tune';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const { createSimState, step, punchCfg, tune } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const n = { mx: 0, my: 0, jab: false, cross: false, hook: false, uppercut: false, dodge: false, guard: false };
const fresh = (d, mut) => { const s = createSimState({ timed: false, fighters: [{ char: 'marco' }, { char: 'marco' }] }); s.fighters[1].x = s.fighters[0].x + d; s.fighters[1].y = s.fighters[0].y; for (const f of s.fighters) f.regenWait = 1000; s.fighters[0].stars = tune.stars.max; if (mut) mut(s); return s; };
const throwPunch = (d, type, mut) => { const s = fresh(d, mut); const ev = []; for (let i = 0; i < 80; i++) ev.push(...step(s, [i === 0 ? { ...n, [type]: true } : n, n])); return { s, hit: ev.find((e) => e.kind === 'hit'), whiff: ev.find((e) => e.kind === 'whiff') }; };
const kind = (r) => (r.hit ? `${r.hit.sweet ? 'sweet' : 'sour'}-${r.hit.row === 'vulnerable' ? 'face' : 'body'}` : 'whiff');
// Connection ranges (centre distance px) from the chart agreed with the owner.
const expect = {
  jab: [[44, 'sour-face'], [60, 'sweet-face'], [66, 'sweet-body'], [72, 'whiff']],
  cross: [[44, 'sour-face'], [66, 'sour-face'], [74, 'sweet-face'], [82, 'sweet-body'], [90, 'whiff']],
  hook: [[44, 'sour-face'], [56, 'sweet-face'], [62, 'sweet-body'], [70, 'whiff']],
  uppercut: [[44, 'sweet-face'], [60, 'sweet-face'], [70, 'whiff']],
};
for (const [type, cases] of Object.entries(expect)) for (const [d, want] of cases) if (process.env.SWEEP) console.log(type, d, kind(throwPunch(d, type))); else assert.equal(kind(throwPunch(d, type)), want, `${type} at ${d}`);
// Jab body reach ends where the cross face band begins.
assert(punchCfg('marco', 'jab').reach + punchCfg('marco', 'jab').hitRadius + tune.body.hurtRadius >= 69);
// Defender loses stamina only on face hits; attacker still pays on a sour body clip.
const body = throwPunch(66, 'jab'); assert.equal(body.hit.row, 'normal'); assert.equal(body.s.fighters[1].stamina, fresh(66).fighters[1].stamina, 'body hit drains no defender stamina');
const face = throwPunch(74, 'cross'); assert.equal(face.hit.row, 'vulnerable'); assert.equal(face.s.fighters[1].stamina, fresh(74).fighters[1].stamina - punchCfg('marco', 'cross').staminaDamage, 'face hit drains defender stamina');
// Every punch type punishes a guard-release or post-dodge defender with the counter bonus.
for (const type of ['jab', 'cross', 'hook', 'uppercut']) {
  const d = type === 'cross' ? 74 : type === 'jab' ? 60 : 56;
  for (const mut of [(s) => { s.fighters[1].guardPenalty = 40; }, (s) => { s.fighters[1].postDodgeVulnerable = 40; }]) {
    const r = throwPunch(d, type, mut); assert(r.hit && r.hit.counter, `${type} punish counter`);
  }
  const plain = throwPunch(d, type); assert(!plain.hit || type === 'cross' || type === 'hook' || !plain.hit.counter, `${type} no counter on a neutral defender`);
}
assert.equal(tune.guard.penaltyFrames, 24); assert.equal(tune.dodge.vulnerableFrames, 24);
console.log('PASS: connection ranges per punch, face-only defender stamina loss, and punish counter for every punch.');
