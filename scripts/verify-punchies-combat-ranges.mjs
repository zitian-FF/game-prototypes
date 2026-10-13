import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: `export * from './prototypes/punchies/src/sim/sim'; export {punchCfg} from './prototypes/punchies/src/sim/character'; export {tune} from './prototypes/punchies/src/sim/tune';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const { createSimState, step, punchCfg, tune } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const n = { mx: 0, my: 0, jab: false, cross: false, hook: false, uppercut: false, dodge: false, guard: false };
const fresh = (d, mut) => { const s = createSimState({ timed: false, fighters: [{ char: 'marco' }, { char: 'marco' }] }); s.fighters[1].x = s.fighters[0].x + d; s.fighters[1].y = s.fighters[0].y; for (const f of s.fighters) f.regenWait = 1000; s.fighters[0].stars = tune.stars.max; if (mut) mut(s); return s; };
const throwPunch = (d, type, mut) => { const s = fresh(d, mut); const ev = []; for (let i = 0; i < 80; i++) ev.push(...step(s, [i === 0 ? { ...n, [type]: true } : n, n])); return { s, hit: ev.find((e) => e.kind === 'hit'), whiff: ev.find((e) => e.kind === 'whiff') }; };
const kind = (r) => (r.hit ? `${r.hit.sweet ? 'sweet' : 'sour'}-${r.hit.row === 'vulnerable' ? 'face' : 'body'}` : 'whiff');
// Geometry scales with the artwork (see test-punchies-geometry.mjs for exact boundaries),
// so find distances by scanning instead of pinning pixel values.
const scan = (type, want) => { for (let d = 30; d <= 160; d++) if (kind(throwPunch(d, type)) === want) return d; return null; };
const scanLast = (type, want) => { let last = null; for (let d = 30; d <= 160; d++) if (kind(throwPunch(d, type)) === want) last = d; return last; };
// Each punch must have a face band that ends in a body band (uppercut is face only), then whiff.
for (const type of ['jab', 'cross', 'hook']) {
  const face = scanLast(type, 'sweet-face') ?? scanLast(type, 'sour-face'); assert(face, `${type} has a face band`);
  const bodyHit = kind(throwPunch(face + 1, type)); assert(bodyHit.endsWith('body') || bodyHit === 'whiff', `${type} face band ends in body or whiff, got ${bodyHit}`);
  assert.equal(kind(throwPunch(170, type)), 'whiff', `${type} whiffs far away`);
}
assert.equal(kind(throwPunch(170, 'uppercut')), 'whiff');
// Defender loses stamina only on face hits; attacker still pays on a body clip.
const bodyD = scan('jab', 'sweet-body') ?? scan('jab', 'sour-body'); assert(bodyD, 'jab has a body band');
const body = throwPunch(bodyD, 'jab'); assert.equal(body.hit.row, 'normal'); assert.equal(body.s.fighters[1].stamina, fresh(bodyD).fighters[1].stamina, 'body hit drains no defender stamina');
const faceD = scanLast('cross', 'sweet-face') ?? scanLast('cross', 'sour-face');
const face = throwPunch(faceD, 'cross'); assert.equal(face.hit.row, 'vulnerable'); assert.equal(face.s.fighters[1].stamina, fresh(faceD).fighters[1].stamina - punchCfg('marco', 'cross').staminaDamage, 'face hit drains defender stamina');
// Every punch type punishes a guard-release or post-dodge defender with the counter bonus.
for (const type of ['jab', 'cross', 'hook', 'uppercut']) {
  const d = scanLast(type, 'sweet-face') ?? scanLast(type, 'sour-face');
  for (const mut of [(s) => { s.fighters[1].guardPenalty = 40; }, (s) => { s.fighters[1].postDodgeVulnerable = 40; }]) {
    const r = throwPunch(d, type, mut); assert(r.hit && r.hit.counter, `${type} punish counter`);
  }
}
assert.equal(tune.guard.penaltyFrames, 24); assert.equal(tune.dodge.vulnerableFrames, 24);
console.log('PASS: face and body bands per punch, face-only defender stamina loss, and punish counter for every punch.');
