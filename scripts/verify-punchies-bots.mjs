import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: `export * from './prototypes/punchies/src/sim/sim'; export {makeBot} from './prototypes/punchies/src/sim/bot'; export {tune} from './prototypes/punchies/src/sim/tune';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const { createSimState, step, makeBot, tune } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
// Scripted bots must manage stamina: little time exhausted, little time pinned on the ropes, and matches still finish.
for (const [a, b] of [['medium', 'medium'], ['hard', 'medium'], ['hard', 'hard']]) {
  let exhausted = 0, wall = 0, ticks = 0;
  const N = 12;
  for (let k = 0; k < N; k++) {
    const s = createSimState({ timed: true, fighters: [{ char: 'marco' }, { char: 'marco' }] });
    const bots = [makeBot(a, 0, 7 + k), makeBot(b, 1, 99 + k)];
    while (!s.result && s.tick < 20000) {
      step(s, [bots[0].think(s), bots[1].think(s)]);
      for (const f of s.fighters) {
        if (f.exhausted) exhausted++;
        const r = tune.ring;
        if (Math.min(f.x - r.left, r.right - f.x, f.y - r.top, r.bottom - f.y) < 30) wall++;
      }
    }
    assert(s.result, `${a} vs ${b} finishes`);
    ticks += s.tick;
  }
  assert(exhausted / (2 * N) < 400, `${a} vs ${b}: exhausted ticks per bot per fight ${exhausted / (2 * N)}`);
  assert(wall / (2 * N) < 250, `${a} vs ${b}: ticks pinned on the ropes per bot per fight ${wall / (2 * N)}`);
}
console.log('PASS: scripted bots recover on stamina, stay off the ropes and still finish their matches.');
