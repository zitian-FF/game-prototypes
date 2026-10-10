import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = path.resolve('prototypes/punchies/src/sim');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (file.replaceAll('\\','/').endsWith('/i18n.ts')) return {setEnglishOverrides() {}};
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

const { createSimState, step, hurtRadius } = load(root + '/sim.ts');
const { NEUTRAL_INPUT } = load(root + '/types.ts');
const { tune } = load(root + '/tune.ts');
const { punchCfg } = load(root + '/character.ts');
const { fighterScale, normalHurtRadius, coreRadius, separation } = load(root + '/geometry.ts');
const { lookFor } = load(root + '/../render/characterLook.ts');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const ids = ['marco', 'mia', 'bruno', 'tee'];
near(fighterScale('tee'),fighterScale('mia'));
// Isolate reach boundaries from rope clamping at the largest debug scale.
Object.assign(tune.ring, { left: 0, top: 0, right: 1000, bottom: 600 });
for (const scale of [1, 1.5, 2]) {
  tune.view.fighterScale = scale;
  for (const attacker of ids) for (const defender of ids) {
    near(lookFor([attacker, defender], 0).scale, fighterScale(attacker));
    for (const type of ['jab', 'cross', 'hook', 'uppercut']) {
      const cfg = punchCfg(attacker, type);
      const reach = cfg.reach + cfg.hitRadius + normalHurtRadius(defender);
      for (const delta of [-0.01, 0.01]) {
        const sim = createSimState({ timed: false, fighters: [{ char: attacker }, { char: defender, anchored: true }] });
        const [a, b] = sim.fighters;
        a.x = 310; a.y = b.y = 210; b.x = a.x + reach + delta;
        a.stars = tune.stars.max;
        const health = b.health;
        for (let tick = 0; tick < cfg.startup + cfg.sourEarly + cfg.sweet + cfg.sour + 2; tick++) {
          step(sim, [tick === 0 ? { ...NEUTRAL_INPUT, [type]: true } : NEUTRAL_INPUT, NEUTRAL_INPUT]);
        }
        assert.equal(b.health < health, delta < 0, `${attacker}/${defender} ${type} scale ${scale} boundary ${delta}`);
      }
      // The smaller inner circle preserves a real body-shot spacing band.
      for (const delta of [-0.01, 0.01]) {
        const sim = createSimState({ timed: false, fighters: [{ char: attacker }, { char: defender, anchored: true }] });
        const [a, b] = sim.fighters;
        a.x = 310; a.y = b.y = 210;
        b.x = a.x + cfg.reach + cfg.hitRadius + coreRadius(b) + delta;
        a.stars = tune.stars.max;
        let hit;
        for (let tick = 0; tick < cfg.startup + cfg.sourEarly + cfg.sweet + cfg.sour + 2; tick++) {
          hit ??= step(sim, [tick === 0 ? { ...NEUTRAL_INPUT, [type]: true } : NEUTRAL_INPUT, NEUTRAL_INPUT])
            .find(event => event.kind === 'hit');
        }
        assert.ok(hit, `${attacker}/${defender} ${type} core boundary must still connect`);
        assert.equal(hit.row, type === 'uppercut' || delta < 0 ? 'vulnerable' : 'normal',
          `${attacker}/${defender} ${type} scale ${scale}: head/body spacing boundary`);
      }
    }
    const sim = createSimState({ timed: false, fighters: [{ char: attacker }, { char: defender, anchored: true }] });
    const [a, b] = sim.fighters;
    a.x = 390; b.x = 400; a.y = b.y = 210;
    step(sim, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
    near(b.x, 400); // Dummy stays anchored while the player is pushed away.
    near(b.x - a.x, separation(a, b));
    near(hurtRadius(a), normalHurtRadius(a));
    a.forceVulnerable = true;
    near(hurtRadius(a), tune.body.vulnerableHurtRadius * fighterScale(a));
    near(coreRadius(a), tune.body.coreRadius * fighterScale(a));
    a.x = tune.ring.left - 20; a.y = tune.ring.top - 20;
    step(sim, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
    near(a.x, tune.ring.left + normalHurtRadius(a));
    near(a.y, tune.ring.top + normalHurtRadius(a));
  }
}
console.log('Shared render/sim scale, all character/punch contact boundaries, vulnerable/core radii, anchored dummy spacing and rope clearance passed at 1x, 1.5x and 2x');
