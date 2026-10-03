import assert from 'node:assert/strict';
import { Rng } from '../src/rng';
import { powerBand, rollPlayers, squadCounts } from '../src/roster';
import { test } from './harness';
import { loadTune } from './helpers';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

test('roster: rank 1 is the top 1.5m slice, rank 20 the bottom', () => {
  const tune = loadTune();
  const [lo1, hi1] = powerBand(1, tune);
  assert.ok(Math.abs(lo1 - 78.5) < 1e-9 && Math.abs(hi1 - 80) < 1e-9);
  const [lo20, hi20] = powerBand(20, tune);
  assert.ok(Math.abs(lo20 - 50) < 1e-9 && Math.abs(hi20 - 51.5) < 1e-9);
  // Bands tile the range with no gaps.
  for (let r = 1; r < 20; r++) assert.ok(Math.abs(powerBand(r, tune)[0] - powerBand(r + 1, tune)[1]) < 1e-9);
});

test('roster: squads follow the brief (4/3/2 split, overlapping bands, weak 3rd and 4th, troops, pool)', () => {
  const tune = loadTune();
  const bands = tune.roster.bands;
  for (let s = 0; s + 1 < bands.length; s++) assert.ok(bands[s + 1][0] <= bands[s][1], `band ${s + 1} overlaps band ${s + 2}`);
  assert.ok(bands[0][1] < 20 && bands[1][1] < 20, 'squads 1 and 2 never reach the weakest ranks');
  const types: Record<string, number> = { missile: 0, aircraft: 0, tank: 0 };
  for (let seed = 1; seed <= 100; seed++) {
    const specs = rollPlayers(new Rng(seed), tune, ids(40));
    for (const team of [0, 1]) {
      const counts = specs.filter((p) => p.team === team).map((p) => p.squads.length);
      assert.equal(counts.filter((c) => c === 4).length, 4, '20% have four squads');
      assert.equal(counts.filter((c) => c === 3).length, 6, '30% have three squads');
      assert.equal(counts.filter((c) => c === 2).length, 10, 'the rest have two');
    }
    for (const p of specs) {
      assert.ok(p.pool >= 40000 && p.pool <= 50000, `pool ${p.pool}`);
      p.squads.forEach((s, i) => {
        const [min, max] = bands[i];
        assert.ok(s.rank >= min && s.rank <= max, `squad ${i + 1} rank ${s.rank}`);
        const [lo, hi] = powerBand(s.rank, tune);
        assert.ok(s.power >= lo && s.power <= hi, `power ${s.power} outside band of rank ${s.rank}`);
        assert.ok(s.maxTroops >= 2700 && s.maxTroops <= 3300, `maxTroops ${s.maxTroops}`);
        types[s.type]++;
      });
    }
  }
  const total = types.missile + types.aircraft + types.tank;
  for (const t of Object.keys(types)) assert.ok(Math.abs(types[t] / total - 1 / 3) < 0.03, `${t} share`);
});

test('roster: the shares hold per team when teams are given, and small teams still get two squads each', () => {
  const tune = loadTune();
  const team = (id: string) => (Number(id.slice(1)) < 5 ? 0 : 1);
  const specs = rollPlayers(new Rng(5), tune, ids(30), team);
  assert.equal(specs.filter((p) => p.team === 0).length, 5);
  for (const p of specs) assert.ok(p.squads.length >= 2 && p.squads.length <= 4);
  assert.deepEqual(squadCounts(20, tune).sort(), [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4]);
});

test('roster: teams are balanced and rolls are reproducible', () => {
  const tune = loadTune();
  const a = rollPlayers(new Rng(7), tune, ids(40));
  const b = rollPlayers(new Rng(7), tune, ids(40));
  assert.deepEqual(a, b);
  assert.equal(a.filter((p) => p.team === 0).length, 20);
  assert.equal(a.filter((p) => p.team === 1).length, 20);
  const odd = rollPlayers(new Rng(7), tune, ids(7));
  assert.equal(Math.abs(odd.filter((p) => p.team === 0).length - odd.filter((p) => p.team === 1).length), 1);
});

test('roster: duplicate power ranks are allowed across players', () => {
  const tune = loadTune();
  const specs = rollPlayers(new Rng(3), tune, ids(40));
  const ranks = specs.flatMap((p) => p.squads.map((s) => s.rank));
  assert.ok(new Set(ranks).size < ranks.length);
});
