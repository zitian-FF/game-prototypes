import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['prototypes/punchies/src/sim/sim.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { createSimState, step } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const neutral = { mx: 0, my: 0, jab: false, cross: false, hook: false, uppercut: false, dodge: false, guard: false };

const training = createSimState({ timed: false, fighters: [{}, { anchored: true }] });
training.fighters[1].health = 0;
const originalX = training.fighters[0].x;
for (let i = 0; i < 120; i++) {
  const events = step(training, [{ ...neutral, mx: -100 }, neutral], false);
  assert(!events.some(e => e.kind === 'ko'));
}
assert.equal(training.result, null);
assert.equal(training.fighters[1].health, 0);
assert(training.tick >= 120 && training.fighters[0].x !== originalX, 'input must keep working at zero HP');

const hitting = createSimState({ timed: false, fighters: [{}, { anchored: true }] });
hitting.fighters[0].x = 410;
hitting.fighters[1].x = 445;
hitting.fighters[1].health = 1;
hitting.fighters[1].forceVulnerable = true;
let hitAfterZero = false;
for (let i = 0; i < 600; i++) {
  const wasZero = hitting.fighters[1].health === 0;
  const events = step(hitting, [{ ...neutral, cross: i % 80 === 0 }, neutral], false);
  if (wasZero && events.some(e => e.kind === 'hit')) hitAfterZero = true;
  assert(!events.some(e => e.kind === 'ko'));
}
assert.equal(hitting.fighters[1].health, 0);
assert.equal(hitting.result, null);
assert(hitAfterZero, 'subsequent punches must still connect after lethal damage');

const match = createSimState({ timed: false, fighters: [{}, {}] });
match.fighters[1].health = 0;
assert(step(match, [neutral, neutral]).some(e => e.kind === 'ko'));
assert.equal(match.result?.reason, 'ko');
console.log('PASS: zero-HP training keeps input/hits, emits no KO, preserves HP floor, and ordinary matches still KO.');
