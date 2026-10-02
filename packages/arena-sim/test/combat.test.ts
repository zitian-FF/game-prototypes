import assert from 'node:assert/strict';
import { resolveFight } from '../src/combat';
import type { Combatant } from '../src/combat';
import { Rng } from '../src/rng';
import type { SquadType } from '../src/types';
import { test } from './harness';
import { scenarioTune, withTune } from './helpers';

const squad = (power: number, type: SquadType = 'tank', extra: Partial<Combatant> = {}): Combatant => ({
  type,
  power,
  troops: 3000,
  maxTroops: 3000,
  attackBonus: 0,
  defenseBonus: 0,
  ...extra,
});

const fight = (a: Combatant, b: Combatant, tune = scenarioTune(), seed = 1) =>
  resolveFight(a, b, tune, new Rng(seed));

test('combat: 45m attacking 60m ends 0% vs ~90% (acceptance target)', () => {
  const r = fight(squad(45), squad(60));
  assert.equal(r.aTroops, 0);
  const left = r.bTroops / 3000;
  assert.ok(left > 0.88 && left < 0.94, `defender kept ${(left * 100).toFixed(1)}%`);
});

test('combat: power gap curve matches the offline model', () => {
  // attacker power -> expected defender survivor fraction (60m defender)
  const expected: [number, number][] = [
    [40, 0.95],
    [50, 0.81],
    [55, 0.64],
    [58, 0.43],
  ];
  for (const [p, want] of expected) {
    const r = fight(squad(p), squad(60));
    assert.equal(r.aTroops, 0, `${p}m attacker should lose`);
    assert.ok(Math.abs(r.bTroops / 3000 - want) < 0.03, `${p}m: defender kept ${(r.bTroops / 30).toFixed(1)}% want ~${want * 100}%`);
  }
});

test('combat: equal power, same type is a mutual wipe', () => {
  const r = fight(squad(60), squad(60));
  assert.equal(r.aTroops, 0);
  assert.equal(r.bTroops, 0);
});

test('combat: a stronger attacker survives with troops left', () => {
  const r = fight(squad(70), squad(60));
  assert.ok(r.aTroops > 0 && r.bTroops === 0);
  assert.ok(r.aTroops / 3000 > 0.6 && r.aTroops / 3000 < 0.9);
});

test('combat: counter is 1.2x power, so a 50m counter ties a 60m squad', () => {
  const r = fight(squad(50, 'aircraft'), squad(60, 'tank'));
  assert.ok(Math.min(r.aTroops, r.bTroops) === 0 && Math.max(r.aTroops, r.bTroops) < 60, `${r.aTroops} vs ${r.bTroops}`);
});

test('combat: counter beats raw power gaps below 20%', () => {
  // 52m aircraft counters tank: 62.4 effective vs 60 -> attacker wins.
  const win = fight(squad(52, 'aircraft'), squad(60, 'tank'));
  assert.ok(win.aTroops > 0 && win.bTroops === 0);
  // The same 52m tank is countered by aircraft and loses badly.
  const lose = fight(squad(52, 'tank'), squad(60, 'aircraft'));
  assert.equal(lose.aTroops, 0);
  assert.ok(lose.bTroops / 3000 > 0.8);
});

test('combat: full counter triangle', () => {
  const beats: [SquadType, SquadType][] = [
    ['aircraft', 'tank'],
    ['tank', 'missile'],
    ['missile', 'aircraft'],
  ];
  for (const [w, l] of beats) {
    const r = fight(squad(60, w), squad(60, l));
    assert.ok(r.aTroops > 0 && r.bTroops === 0, `${w} should beat ${l}`);
  }
});

test('combat: attack boost can flip a close fight, defense boost saves troops', () => {
  assert.equal(fight(squad(58), squad(60)).aTroops, 0);
  assert.ok(fight(squad(58, 'tank', { attackBonus: 0.1 }), squad(60)).aTroops > 0);
  const plain = fight(squad(70), squad(60)).aTroops;
  const guarded = fight(squad(70, 'tank', { defenseBonus: 0.3 }), squad(60)).aTroops;
  assert.ok(guarded > plain);
});

test('combat: wounded squads fight weaker (strength scales with troops)', () => {
  const healthy = fight(squad(60), squad(60, 'tank', { troops: 3000 }));
  const wounded = fight(squad(60), squad(60, 'tank', { troops: 1500 }));
  assert.equal(healthy.aTroops, 0);
  assert.ok(wounded.aTroops > 0 && wounded.bTroops === 0, 'half-troop defender should lose');
});

test('combat: troop counts stay whole and bounded, rounds terminate', () => {
  const r = fight(squad(50), squad(50, 'tank'));
  assert.ok(Number.isInteger(r.aTroops) && Number.isInteger(r.bTroops));
  assert.ok(r.rounds > 0 && r.rounds < 100000);
});

test('combat: variance is reproducible per seed and actually varies', () => {
  const tune = withTune({ combat: { variance: 0.035 } });
  const results = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const a = resolveFight(squad(60), squad(60), tune, new Rng(seed));
    const b = resolveFight(squad(60), squad(60), tune, new Rng(seed));
    assert.deepEqual(a, b, 'same seed, same result');
    results.add(`${a.aTroops}/${a.bTroops}`);
  }
  assert.ok(results.size > 50, `only ${results.size} distinct outcomes in 200 seeds`);
});

test('combat: ~3.5% power variance makes even fights swingy but a 15% gap decisive', () => {
  const tune = withTune({ combat: { variance: 0.035 } });
  let upsets = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const r = resolveFight(squad(51), squad(60), tune, new Rng(seed));
    if (r.aTroops > 0) upsets++;
  }
  assert.equal(upsets, 0, '51m should essentially never beat 60m');
  let wins = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const r = resolveFight(squad(59), squad(60), tune, new Rng(seed));
    if (r.aTroops > 0) wins++;
  }
  assert.ok(wins > 100 && wins < 400, `59m vs 60m won ${wins}/500`);
});
