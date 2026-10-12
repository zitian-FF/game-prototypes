// Headless rule checks for the playable sim. Run from the repo root:
//   node prototypes/punchies-playable/scripts/test-sim.mjs
import { createServer } from 'vite';

const server = await createServer({ root: process.cwd(), configFile: false, logLevel: 'warn', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
const { createSim, classify, spawnFrame, spawnBearing, FPS } = await server.ssrLoadModule('/prototypes/punchies-playable/src/sim.ts');
const { tuneBaseline } = await server.ssrLoadModule('/prototypes/punchies-playable/src/tune.ts');
await server.close();

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };
const NONE = { jab: false, cross: false };

// Place one enemy at a distance, parked (not walking) so timing is exact.
function setup(mut) {
  const t = tuneBaseline();
  t.run.zombieCount = 0; // no automatic spawns
  mut?.(t);
  const sim = createSim(t);
  return { t, sim };
}
function addEnemy(sim, d, state = 'windup') {
  const e = { id: 99, d, ang: 0, state, frame: 0, side: 1 };
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
{ const { sim } = setup((t) => { t.enemy.windupFrames = 5; t.enemy.strikeFrames = 2; t.run.zombieCount = 40; t.run.firstSpawnSec = 0.1; t.run.lastSpawnSec = 8; t.enemy.walkSpeed = 400; });
  let end = null; for (let i = 0; i < 30 * FPS && !end; i++) for (const e of sim.step(NONE)) if (e.kind === 'end') end = e.reason;
  check('3 HP lost ends run early', end === 'dead' && sim.state.hp === 0 && sim.state.frame < 30 * FPS, `frame=${sim.state.frame}`); }
// 30 second end.
{ const { sim } = setup(); let end = null, n = 0; for (let i = 0; i < 40 * FPS && !end; i++, n++) for (const e of sim.step(NONE)) if (e.kind === 'end') end = e.reason;
  check('30 s ends the run', end === 'time' && sim.state.frame === 30 * FPS, `frame=${sim.state.frame}`);
  const before = sim.state.frame; sim.step(NONE); check('sim frozen after end', sim.state.frame === before); }
// Fixed zombie plan: the same count, timing and entry positions every run.
{ const runOnce = () => { const t = tuneBaseline(); t.run.playerHp = 999; const sim = createSim(t); const spawns = [];
    for (let i = 0; i < 30 * FPS; i++) for (const e of sim.step(NONE)) if (e.kind === 'spawn') spawns.push({ frame: sim.state.frame, ang: e.ang });
    return { t, spawns }; };
  const a = runOnce(), b = runOnce(), n = a.t.run.zombieCount;
  check(`exactly ${n} zombies spawn within the 30 s timer`, a.spawns.length === n, `got ${a.spawns.length}`);
  check('two runs are identical (frames and entry angles)', JSON.stringify(a.spawns) === JSON.stringify(b.spawns));
  const gaps = a.spawns.slice(1).map((x, i) => x.frame - a.spawns[i].frame);
  check('spawns are evenly spaced', Math.max(...gaps) - Math.min(...gaps) <= 1, gaps.join(','));
  check('first and last spawn match tune', a.spawns[0].frame === spawnFrame(a.t, 0) && a.spawns[n - 1].frame === Math.round(a.t.run.lastSpawnSec * FPS));
  const deg = a.spawns.map((x) => Math.round((x.ang * 180) / Math.PI));
  check('entry angles use several positions and stay within the limit', new Set(deg).size >= 3 && deg.every((d) => Math.abs(d) <= a.t.enemy.maxBearingDeg), deg.join(','));
  check('both sides are used', deg.some((d) => d < 0) && deg.some((d) => d > 0));
  check('bearing helper matches the sim', a.spawns.every((x, i) => Math.abs(x.ang - spawnBearing(a.t, i)) < 1e-9));
  // Fairness: even the last zombie can arrive, wind up, and be dealt with before time runs out.
  const arrive = a.t.run.lastSpawnSec + (a.t.enemy.spawnDistance - a.t.enemy.attackDistance) / a.t.enemy.walkSpeed + (a.t.enemy.windupFrames + a.t.enemy.strikeFrames) / FPS;
  check('the last zombie is resolved before the timer ends', arrive < a.t.run.durationSec, `resolved by ${arrive.toFixed(1)} s of ${a.t.run.durationSec}`); }
// A defeated zombie keeps flying, then is removed after knockFrames.
{ const { t, sim } = setup(park); const e = addEnemy(sim, 80); e.ang = 0.3; throwPunch(sim, 'jab', 3 + 11);
  check('defeated zombie is in the knocked state', e.state === 'knocked');
  const keep = e.ang; for (let i = 0; i < t.enemy.knockFrames - 3; i++) sim.step(NONE);
  check('knocked zombie keeps its blow bearing', e.ang === keep);
  for (let i = 0; i < 10; i++) sim.step(NONE);
  check('defeated zombie is removed after the knock off', !sim.state.enemies.includes(e)); }
// Queue spacing: a second enemy never passes the first.
{ const { sim } = setup((t) => { t.run.zombieCount = 40; t.run.firstSpawnSec = 0.1; t.run.lastSpawnSec = 4; t.enemy.windupFrames = 9999; });
  let bad = false; for (let i = 0; i < 200; i++) { sim.step(NONE); const w = sim.state.enemies.map((e) => e.d).sort((a, b) => a - b); for (let k = 1; k < w.length; k++) if (w[k] - w[k - 1] < 69.9) bad = true; }
  check('queued enemies keep min gap', !bad); }

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
