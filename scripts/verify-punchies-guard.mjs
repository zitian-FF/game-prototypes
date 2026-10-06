import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: `export * from './prototypes/punchies/src/sim/sim'; export {punchCfg} from './prototypes/punchies/src/sim/character'; export {tune} from './prototypes/punchies/src/sim/tune'; export {makeBot} from './prototypes/punchies/src/sim/bot';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const { createSimState, step, stanceOf, isVulnerable, punchCfg, tune, makeBot } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const neutral = { mx: 0, my: 0, jab: false, cross: false, hook: false, uppercut: false, dodge: false, guard: false };
const guard = { ...neutral, guard: true };
const fresh = () => createSimState({ timed: false, fighters: [{}, { anchored: true }] });

const s = fresh(), f = s.fighters[0];
step(s, [guard, neutral]);
for (let i = 0; i < tune.guard.perfectFrames; i++) {
  assert.equal(stanceOf(f), 'perfectGuard', 'every initial guard has exactly the tight perfect window');
  step(s, [guard, neutral]);
}
assert.equal(stanceOf(f), 'guard', 'holding beyond the perfect window becomes ordinary guard');
step(s, [neutral, neutral]);
assert.equal(f.guardPenalty, tune.guard.penaltyFrames - 1, 'release itself is the first vulnerable frame');
assert.equal(stanceOf(f), 'vulnerable');
while (f.guardPenalty > 0) {
  assert(isVulnerable(f));
  step(s, [guard, neutral]);
  assert.equal(f.guarding, false, 'holding/mashing guard must not bypass or extend the penalty');
}
step(s, [guard, neutral]);
assert.equal(stanceOf(f), 'perfectGuard', 'no separate cooldown delays the next legal perfect guard');
assert.equal(f.guardFrames, 0);

for (const action of ['jab', 'dodge']) {
  const cancel = fresh(); step(cancel, [guard, neutral]);
  step(cancel, [{ ...neutral, [action]: true }, neutral]);
  assert.equal(cancel.fighters[0].guardPenalty, tune.guard.penaltyFrames - 1, 'cancel into another move must preserve release penalty');
}
const idle = fresh();
for (let i = 0; i < 30; i++) step(idle, [neutral, neutral]);
assert.equal(idle.fighters[0].guardPenalty, 0, 'being unguarded alone is not a release');

// Put an actual jab on its sweet frame, touching only the outer hurt ring.
function incoming(s) {
  const a = s.fighters[1]; a.anchored = true; a.x = s.fighters[0].x + 70;
  const cfg = punchCfg(a, 'jab');
  a.punch = { type: 'jab', frame: cfg.startup + cfg.sourEarly, startup: cfg.startup, sourEarly: cfg.sourEarly, sweet: cfg.sweet, sour: cfg.sour, recovery: cfg.recovery, reach: cfg.reach, startReach: cfg.reach * cfg.startReachFrac, damageMult: 1, buffed: false, resolved: false, connected: false, hand: 0 };
}
const release = fresh(); step(release, [guard, neutral]); incoming(release);
const hit = step(release, [neutral, neutral]).find(e => e.kind === 'hit');
assert(hit, 'jab must land during release');
assert.equal(hit.row, 'vulnerable');
assert.equal(hit.damage, punchCfg(release.fighters[1], 'jab').damage * tune.hit.counterDamageMult, 'sweet outer-ring hit during penalty takes full damage plus the punish counter');

const reraised = fresh(); step(reraised, [guard, neutral]); step(reraised, [neutral, neutral]);
while (reraised.fighters[0].guardPenalty > 0) step(reraised, [neutral, neutral]);
incoming(reraised);
assert(step(reraised, [guard, neutral]).some(e => e.kind === 'perfectGuard'), 'fresh raise immediately after penalty must parry an incoming punch');

const frozen = fresh(); step(frozen, [guard, neutral]); step(frozen, [neutral, neutral]);
const remaining = frozen.fighters[0].guardPenalty; frozen.hitstop = 2;
step(frozen, [guard, neutral]); assert.equal(frozen.fighters[0].guardPenalty, remaining, 'hit-stop freezes penalty with combat');
const replay = structuredClone(frozen);
for (let i = 0; i < 50; i++) {
  const inputs = [i % 4 === 0 ? neutral : guard, neutral];
  assert.deepEqual(step(frozen, inputs), step(replay, inputs));
  assert.deepEqual(frozen, replay, 'cloned rollback state must replay penalty deterministically');
}
const bots = fresh(), ai = makeBot('hard', 0, 123);
for (let i = 0; i < 180; i++) step(bots, [ai.think(bots), neutral]);
assert.equal('perfectCooldownFrames' in tune.guard, false);
console.log('PASS: guard release vulnerability/full damage, exact lockout, fresh three-frame perfect windows, punch/dodge cancels, hit-stop, deterministic rollback replay, and bot compatibility.');
