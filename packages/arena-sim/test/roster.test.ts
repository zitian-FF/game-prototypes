import assert from 'node:assert/strict';
import { Rng } from '../src/rng';
import { powerBand, rollPlayers } from '../src/roster';
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

test('roster: squads follow the brief (counts, rank ranges, bands, troops, pool)', () => {
  const tune = loadTune();
  let players = 0;
  let second = 0;
  let third = 0;
  const types: Record<string, number> = { missile: 0, aircraft: 0, tank: 0 };
  for (let seed = 1; seed <= 100; seed++) {
    for (const p of rollPlayers(new Rng(seed), tune, ids(40))) {
      players++;
      assert.ok(p.squads.length >= 1 && p.squads.length <= 3);
      if (p.squads.length >= 2) second++;
      if (p.squads.length === 3) third++;
      assert.ok(p.pool >= 40000 && p.pool <= 50000, `pool ${p.pool}`);
      p.squads.forEach((s, i) => {
        const [min, max] = [
          [tune.roster.squad1RankMin, tune.roster.squad1RankMax],
          [tune.roster.squad2RankMin, tune.roster.squad2RankMax],
          [tune.roster.squad3RankMin, tune.roster.squad3RankMax],
        ][i];
        assert.ok(s.rank >= min && s.rank <= max, `squad ${i + 1} rank ${s.rank}`);
        const [lo, hi] = powerBand(s.rank, tune);
        assert.ok(s.power >= lo && s.power <= hi, `power ${s.power} outside band of rank ${s.rank}`);
        assert.ok(s.power >= 50 && s.power <= 80);
        assert.ok(s.maxTroops >= 2700 && s.maxTroops <= 3300, `maxTroops ${s.maxTroops}`);
        types[s.type]++;
      });
    }
  }
  const f2 = second / players;
  const f3 = third / players;
  assert.ok(Math.abs(f2 - 0.8) < 0.03, `second squad share ${f2}`);
  assert.ok(f3 > 0.05 && f3 < 0.11, `third squad share ${f3}`);
  const total = types.missile + types.aircraft + types.tank;
  for (const t of Object.keys(types)) assert.ok(Math.abs(types[t] / total - 1 / 3) < 0.03, `${t} share`);
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
