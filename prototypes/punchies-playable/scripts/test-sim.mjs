// Headless rule checks for the playable sim. Run from the repo root:
//   node prototypes/punchies-playable/scripts/test-sim.mjs
import { createServer } from 'vite';

const server = await createServer({ root: process.cwd(), configFile: false, logLevel: 'warn', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
const { createSim, classify, FPS } = await server.ssrLoadModule('/prototypes/punchies-playable/src/sim.ts');
const { tuneBaseline } = await server.ssrLoadModule('/prototypes/punchies-playable/src/tune.ts');
await server.close();

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };
const NONE = { jab: false, cross: false };

// Place one enemy at a distance, parked (not walking) so timing is exact.
function setup(mut) {
  const t = tuneBaseline();
  t.run.firstSpawnSec = 999; // no automatic spawns
  mut?.(t);
  const sim = createSim(t, 7);
  return { t, sim };
}
function addEnemy(sim, d, state = 'windup') {
  const e = { id: 99, d, state, frame: 0, side: 1 };
  sim.state.enemies.push(e);
  return e;
}
// Press a punch and run until it resolves or ends. Returns events seen.
function throwPunch(sim, type, frames = 80) {
  const evs = [];
  evs.push(...sim.step({ jab: type === 'jab', cross: type === 'cross' }));
  for (let i = 0; i < frames; i++) evs.push(...sim.step(NONE));
  return evs;
}
const park = (t) => { t.enemy.windupFrames = 9999; t.enemy.walkSpeed = 0; };

// Bands (centre distance, lane units).
check('band jab head', classify(tuneBaseline(), 'jab', 80) === 'head');
check('band jab body', classify(tuneBaseline(), 'jab', 100) === 'body');
check('band jab out', classify(tuneBaseline(), 'jab', 110) === 'out');
check('band cross sour', classify(tuneBaseline(), 'cross', 100) === 'sour');
check('band cross head', classify(tuneBaseline(), 'cross', 110) === 'head');
check('band cross body', classify(tuneBaseline(), 'cross', 120) === 'body');

// Head hit = 2, enemy knocked.
{ const { sim } = setup(park); const e = addEnemy(sim, 80); const ev = throwPunch(sim, 'jab');
  check('jab head scores 2', sim.state.score === 2 && ev.some((x) => x.kind === 'sweet' && x.zone === 'head'), `score=${sim.state.score}`);
  check('head hit knocks enemy', e.state === 'knocked' || !sim.state.enemies.includes(e));
  check('head hit no damage to player', sim.state.hp === 3); }
// Body hit = 1.
{ const { sim } = setup(park); addEnemy(sim, 100); throwPunch(sim, 'jab');
  check('jab body scores 1', sim.state.score === 1, `score=${sim.state.score}`); }
{ const { sim } = setup(park); addEnemy(sim, 110); throwPunch(sim, 'cross');
  check('cross head scores 2', sim.state.score === 2, `score=${sim.state.score}`); }
{ const { sim } = setup(park); addEnemy(sim, 122); throwPunch(sim, 'cross');
  check('cross body scores 1', sim.state.score === 1, `score=${sim.state.score}`); }
// Cross reaches farther than the jab.
{ const { sim } = setup(park); addEnemy(sim, 122); throwPunch(sim, 'jab');
  check('jab cannot reach 122', sim.state.score === 0); }
// Sour: cross on a close enemy does nothing, then the enemy punches for 1 damage.
{ const { t, sim } = setup((t) => { t.enemy.windupFrames = 10; t.enemy.walkSpeed = 0; });
  const e = addEnemy(sim, 80, 'windup');
  const ev = throwPunch(sim, 'cross', 60);
  check('sour cross scores 0', sim.state.score === 0 && ev.some((x) => x.kind === 'sour'));
  check('sour hit does not knock enemy', e.state !== 'knocked');
  check('enemy punches after sour for 1 damage', sim.state.hp === 2 && ev.some((x) => x.kind === 'playerHit'), `hp=${sim.state.hp}`);
  check('enemy leaves after punching', e.state === 'leave' || !sim.state.enemies.includes(e)); }
// Miss / no punch: enemy punches for 1.
{ const { sim } = setup((t) => { t.enemy.windupFrames = 10; t.enemy.walkSpeed = 0; });
  addEnemy(sim, 80, 'windup'); for (let i = 0; i < 40; i++) sim.step(NONE);
  check('no punch -> 1 damage', sim.state.hp === 2, `hp=${sim.state.hp}`); }
{ const { sim } = setup((t) => { t.enemy.windupFrames = 40; t.enemy.walkSpeed = 0; });
  addEnemy(sim, 200, 'windup'); const ev = throwPunch(sim, 'jab', 30);
  check('whiff emits event, no score', sim.state.score === 0 && ev.some((x) => x.kind === 'whiff')); }
// 3 HP end.
{ const { sim } = setup((t) => { t.enemy.windupFrames = 5; t.enemy.strikeFrames = 2; t.run.firstSpawnSec = 0.1; t.run.spawnMinSec = 0.5; t.run.spawnMaxSec = 0.5; t.enemy.walkSpeed = 400; });
  let end = null; for (let i = 0; i < 30 * FPS && !end; i++) for (const e of sim.step(NONE)) if (e.kind === 'end') end = e.reason;
  check('3 HP lost ends run early', end === 'dead' && sim.state.hp === 0 && sim.state.frame < 30 * FPS, `frame=${sim.state.frame}`); }
// 30 second end.
{ const { sim } = setup(); let end = null, n = 0; for (let i = 0; i < 40 * FPS && !end; i++, n++) for (const e of sim.step(NONE)) if (e.kind === 'end') end = e.reason;
  check('30 s ends the run', end === 'time' && sim.state.frame === 30 * FPS, `frame=${sim.state.frame}`);
  const before = sim.state.frame; sim.step(NONE); check('sim frozen after end', sim.state.frame === before); }
// Spawn cadence 1.5 to 2 s, overlap allowed.
{ const t = tuneBaseline(); t.run.playerHp = 999; const sim = createSim(t, 3); const at = [];
  for (let i = 0; i < 30 * FPS; i++) for (const e of sim.step(NONE)) if (e.kind === 'spawn') at.push(sim.state.frame);
  const gaps = at.slice(1).map((f, i) => (f - at[i]) / FPS);
  check('spawn gaps within 1.5 to 2.0 s', gaps.length > 5 && gaps.every((g) => g >= 1.49 && g <= 2.01), gaps.map((g) => g.toFixed(2)).join(',')); }
// Queue spacing: a second enemy never passes the first.
{ const { sim } = setup((t) => { t.run.firstSpawnSec = 0.1; t.run.spawnMinSec = 0.3; t.run.spawnMaxSec = 0.3; t.enemy.windupFrames = 9999; });
  let bad = false; for (let i = 0; i < 200; i++) { sim.step(NONE); const w = sim.state.enemies.map((e) => e.d).sort((a, b) => a - b); for (let k = 1; k < w.length; k++) if (w[k] - w[k - 1] < 69.9) bad = true; }
  check('queued enemies keep min gap', !bad); }

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
