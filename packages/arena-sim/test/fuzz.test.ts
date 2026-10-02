import assert from 'node:assert/strict';
import { ArenaGame } from '../src/game';
import { generateMap } from '../src/map';
import { Rng } from '../src/rng';
import { rollPlayers } from '../src/roster';
import type { Command, GameEvent } from '../src/types';
import { test } from './harness';
import { loadTune } from './helpers';

interface RunStats {
  digest: string;
  counts: Record<string, number>;
  accepted: number;
  rejected: number;
}

/** Play a full 40 player match with random legal-ish commands, checking invariants all the way. */
function playRandomMatch(seed: number): RunStats {
  const tune = loadTune();
  const map = generateMap(new Rng(seed), tune);
  const ids = Array.from({ length: 40 }, (_, i) => `p${i}`);
  const players = rollPlayers(new Rng(seed + 1), tune, ids);
  const g = new ArenaGame({ seed, tune, map, players });
  const r = new Rng(seed + 2);
  const counts: Record<string, number> = {};
  const tally = (events: GameEvent[]) => events.forEach((e) => (counts[e.type] = (counts[e.type] ?? 0) + 1));
  let accepted = 0;
  let rejected = 0;
  const hqIds = Array.from(g.players.values()).map((p) => p.hq.id);
  const nodeIds = map.nodes.map((n) => n.id);

  const randomCommand = (): Command => {
    const p = r.pick(players);
    const roll = r.next();
    const squadId = r.pick(g.players.get(p.id)!.squadIds);
    const target = r.chance(0.7)
      ? ({ kind: 'node', nodeId: r.pick(nodeIds) } as const)
      : ({ kind: 'hq', hqId: r.pick(hqIds) } as const);
    if (roll < 0.5) return { type: 'march', playerId: p.id, squadId, target };
    if (roll < 0.6) return { type: 'cancel', playerId: p.id, squadId };
    if (roll < 0.75) return { type: 'teleport', playerId: p.id, nodeId: r.pick(nodeIds) };
    if (roll < 0.9) return { type: 'scout', playerId: p.id, scoutIndex: r.int(0, 2), target };
    return { type: 'setDefend', playerId: p.id, squadId, defend: r.chance(0.7) };
  };

  let t = 0;
  const end = tune.match.durationSeconds * 1000;
  while (t < end) {
    t = Math.min(end, t + r.int(500, 12_000));
    tally(g.advanceTo(t));
    for (let i = r.int(1, 6); i > 0; i--) {
      const res = g.command(randomCommand());
      if (res.ok) {
        accepted++;
        tally(res.events);
      } else rejected++;
    }
    const bad = g.checkInvariants();
    assert.deepEqual(bad, [], `invariants broke at t=${t}: ${bad.slice(0, 3).join('; ')}`);
  }
  tally(g.advanceTo(end + 1000));
  assert.ok(g.result, 'match must finish');

  const digest = JSON.stringify({
    result: g.result,
    now: g.now,
    squads: Array.from(g.squads.values()).map((s) => [s.id, s.troops, s.state.kind]),
    nodes: Array.from(g.nodes.values()).map((n) => [n.id, n.owner, n.garrison]),
    pools: Array.from(g.players.values()).map((p) => [p.id, p.pool, p.hq.hp, p.hq.location]),
    logs: g.combatLogs.length,
    reports: g.scoutReports.length,
    counts,
  });
  return { digest, counts, accepted, rejected };
}

test('fuzz: full 40 player matches keep every invariant and finish', () => {
  for (const seed of [1, 2, 3]) {
    const s = playRandomMatch(seed);
    assert.ok(s.accepted > 100, `seed ${seed}: only ${s.accepted} commands accepted`);
    for (const need of ['nodeCaptured', 'combat', 'teleported', 'scoutReport', 'marchStarted', 'matchEnded']) {
      assert.ok((s.counts[need] ?? 0) > 0, `seed ${seed}: no ${need} events happened (${JSON.stringify(s.counts)})`);
    }
  }
});

test('fuzz: the same seed and commands replay to an identical match', () => {
  const a = playRandomMatch(11);
  const b = playRandomMatch(11);
  assert.equal(a.digest, b.digest);
  assert.notEqual(a.digest, playRandomMatch(12).digest);
});
