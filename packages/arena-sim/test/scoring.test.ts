import assert from 'node:assert/strict';
import { viewFor } from '../src/fog';
import type { GameEvent } from '../src/types';
import { test } from './harness';
import { arrival, makeGame, marchAndArrive, must, player, scenarioTune } from './helpers';
import type { NodeDef } from './helpers';

const node = (id: string, x: number, tier: number, kind: NodeDef['kind'] = 'points', y = 300): NodeDef => ({ id, kind, x, y, tier });

/** Score per second team 0 earns right now, measured over a short window. */
function rate(g: ReturnType<typeof makeGame>): number {
  const before = g.points()[0];
  g.advanceTo(g.now + 1000);
  return g.points()[0] - before;
}

test('scoring: node score per second by tier is 10, 30, 50, 80 (plus 10 for the garrisoned commander)', () => {
  const nodes = [node('t1', 300, 1), node('t2', 400, 2), node('t3', 500, 3), node('t4', 600, 4)];
  const g = makeGame({
    nodes,
    players: [player('a', 0, [{ power: 60 }, { power: 60 }, { power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  const want = [10, 30, 50, 80];
  let total = 0;
  nodes.forEach((n, i) => {
    marchAndArrive(g, 'a', `s${i}`, n.id);
    total += want[i] + 10;
    assert.ok(Math.abs(rate(g) - total) < 1e-6, `after ${n.id}: ${rate(g)} want ${total}`);
  });
});

test('scoring: power nodes score by their tier like any other node', () => {
  const g = makeGame({
    nodes: [node('atk1', 300, 1, 'attackBoost'), node('def2', 450, 2, 'defenseBoost')],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'atk1');
  marchAndArrive(g, 'a', 's1', 'def2');
  assert.ok(Math.abs(rate(g) - (10 + 10 + 30 + 10)) < 1e-6);
});

test('scoring: the garrison bonus counts once per commander per node, not per squad', () => {
  const g = makeGame({
    nodes: [node('n', 300, 1)],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }, { power: 60 }]), player('c', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n');
  assert.ok(Math.abs(rate(g) - 20) < 1e-6, '1 commander: 10 + 10');
  marchAndArrive(g, 'a', 's1', 'n');
  marchAndArrive(g, 'a', 's2', 'n');
  assert.deepEqual(g.nodes.get('n')!.garrison.length, 3);
  assert.ok(Math.abs(rate(g) - 20) < 1e-6, 'three squads, same commander: still +10');
  marchAndArrive(g, 'c', 's3', 'n');
  assert.ok(Math.abs(rate(g) - 30) < 1e-6, 'a second commander adds another +10');
});

test('scoring: a commander earns the bonus again on every different node', () => {
  const g = makeGame({
    nodes: [node('n1', 300, 1), node('n2', 450, 1)],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n1');
  marchAndArrive(g, 'a', 's1', 'n2');
  assert.ok(Math.abs(rate(g) - (2 * 10 + 2 * 10)) < 1e-6);
});

test('scoring: an empty node still pays its tier score but no garrison bonus', () => {
  const g = makeGame({
    nodes: [node('n1', 300, 2), node('n2', 450, 1)],
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n1');
  assert.ok(Math.abs(rate(g) - 40) < 1e-6);
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n2' } });
  assert.ok(Math.abs(rate(g) - 30) < 1e-6, 'left n1: its 30 stays, the garrison 10 is gone');
});

test('scoring: teleporting pulls every squad home, so the garrison bonus stops until redeployed', () => {
  const g = makeGame({
    nodes: [node('n1', 300, 1), node('n2', 450, 1)],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n1');
  marchAndArrive(g, 'a', 's1', 'n2');
  assert.ok(Math.abs(rate(g) - 40) < 1e-6);
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n1' });
  assert.ok(Math.abs(rate(g) - 20) < 1e-6, 'tier scores only');
});

test('scoring: losing a node stops its score and its garrison bonus for the loser', () => {
  const g = makeGame({
    nodes: [node('n1', 300, 1)],
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 80 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n1');
  assert.ok(Math.abs(rate(g) - 20) < 1e-6);
  must(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'node', nodeId: 'n1' } });
  g.advanceTo(arrival(g, 's1'));
  const before = g.points();
  g.advanceTo(g.now + 1000);
  const after = g.points();
  assert.ok(Math.abs(after[0] - before[0]) < 1e-6, 'team 0 earns nothing now');
  assert.ok(Math.abs(after[1] - before[1] - 20) < 1e-6, 'team 1: 10 tier + 10 garrison');
});

// ------------------------------------------------------ tiers and powers

test('tiers: a power node is stronger by tier (base value times tier)', () => {
  const mk = (tier: number) =>
    makeGame({
      nodes: [node('tc', 300, tier, 'teleportCooldown'), node('sp', 450, tier, 'speedBoost')],
      players: [player('a', 0, [{ power: 60 }, { power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
    });
  for (const tier of [1, 2]) {
    const g = mk(tier);
    marchAndArrive(g, 'a', 's0', 'tc');
    marchAndArrive(g, 'a', 's1', 'sp');
    const t = g.now;
    must(g, { type: 'teleport', playerId: 'a', nodeId: 'tc' });
    assert.equal(g.players.get('a')!.nextTeleportAtMs - t, (120 - 15 * tier) * 1000, `tier ${tier} cooldown`);
    must(g, { type: 'march', playerId: 'a', squadId: 's2', target: { kind: 'node', nodeId: 'sp' } });
    const m = g.squads.get('s2')!.state;
    assert.ok(m.kind === 'march' && Math.abs(m.march.speed - g.marchSpeed * (1 + 0.1 * tier)) < 1e-9, `tier ${tier} speed`);
  }
});

test('tiers: an attack boost tier 2 flips a fight a tier 1 boost cannot', () => {
  const run = (tier: number) => {
    const g = makeGame({
      nodes: [node('t', 300, 1), node('atk', 450, tier, 'attackBoost')],
      players: [player('a', 0, [{ power: 56 }, { power: 56 }]), player('b', 1, [{ power: 60 }])],
    });
    marchAndArrive(g, 'a', 's1', 'atk');
    marchAndArrive(g, 'b', 's2', 't');
    must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 't' } });
    g.advanceTo(arrival(g, 's0'));
    return g.nodes.get('t')!.owner;
  };
  assert.equal(run(1), 1, '56 * 1.05 = 58.8 still loses to 60');
  assert.equal(run(2), 0, '56 * 1.10 = 61.6 wins');
});

// ------------------------------------------------------------ view rules

test('view: your own garrison count is exact, an enemy one needs a scout and goes stale', () => {
  const g = makeGame({
    nodes: [node('n', 300, 1), node('m', 450, 1)],
    tune: scenarioTune({ scout: { revealSeconds: 10 } }),
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n');
  marchAndArrive(g, 'a', 's1', 'n');
  const nodeFor = (team: 0 | 1) => viewFor(g, team).nodes.find((n) => n.id === 'n')!;
  assert.equal(nodeFor(0).garrisonCount, 2);
  assert.equal(nodeFor(1).garrisonCount, undefined, 'enemy sees no count without a scout');

  must(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'node', nodeId: 'n' } });
  const sc = g.players.get('b')!.scouts[0];
  g.advanceTo(sc.kind === 'out' ? sc.arriveMs : 0);
  assert.equal(nodeFor(1).garrisonCount, 2);
  assert.equal(nodeFor(1).garrisonCountAsOfMs, g.now);
  // A squad leaves, but the scouted number is a snapshot.
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'm' } });
  assert.equal(nodeFor(0).garrisonCount, 1);
  assert.equal(nodeFor(1).garrisonCount, 2, 'the scouted count does not update');
  g.advanceTo(g.now + 11_000);
  assert.equal(nodeFor(1).garrisonCount, undefined, 'report expired, count hidden again');
});

test('view: defeated squads and damaged HQs burn, and the HQ resets when it is defeated', () => {
  const g = makeGame({
    nodes: [node('n', 300, 1)],
    tune: scenarioTune({ hq: { hp: 2 } }),
    players: [player('a', 0, [{ power: 55 }]), player('b', 1, [{ power: 80 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n');
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n' });
  assert.equal(viewFor(g, 0).hqs[0].burning, false);

  must(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'hq', hqId: 'h0' } });
  g.advanceTo(arrival(g, 's1'));
  const mine = viewFor(g, 0).hqs.find((h) => h.id === 'h0')!;
  assert.equal(mine.hp, 1);
  assert.equal(mine.burning, true, 'below full HP');
  assert.equal(mine.maxHp, 2);
  g.advanceTo(g.now + 10 * 60_000);
  assert.equal(viewFor(g, 0).hqs.find((h) => h.id === 'h0')!.burning, true, 'it never regenerates');

  must(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'hq', hqId: 'h0' } });
  g.advanceTo(arrival(g, 's1'));
  const reset = viewFor(g, 0).hqs.find((h) => h.id === 'h0')!;
  assert.equal(reset.hp, 2);
  assert.equal(reset.burning, false, 'defeated and reset');
});

test('view: a defeated squad is marked burning on the way home, for its team and for watchers', () => {
  const g = makeGame({
    nodes: [node('n', 300, 1), node('v', 450, 1, 'largeVision')],
    players: [player('a', 0, [{ power: 80 }]), player('b', 1, [{ power: 45 }, { power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n');
  marchAndArrive(g, 'a', 's0', 'v');
  marchAndArrive(g, 'b', 's2', 'n');
  must(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'node', nodeId: 'v' } });
  g.advanceTo(arrival(g, 's1')); // loses to the strong garrison at v
  const own = viewFor(g, 1).squads.find((s) => s.id === 's1')!;
  assert.equal(own.burning, true);
  assert.equal(own.state, 'march');
  const seen = viewFor(g, 0).enemyMarches.find((m) => m.id === 's1');
  assert.equal(seen?.burning, true, 'visible to the team that holds vision');
  const healthy = viewFor(g, 1).squads.find((s) => s.id === 's2')!;
  assert.equal(healthy.burning, false);
});

test('view: teleport events say where the HQ left and where it landed', () => {
  const g = makeGame({
    nodes: [node('n', 300, 1)],
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n');
  const from = g.players.get('a')!.hq.pos;
  const events: GameEvent[] = must(g, { type: 'teleport', playerId: 'a', nodeId: 'n' });
  const tp = events.find((e) => e.type === 'teleported');
  assert.ok(tp && tp.type === 'teleported');
  assert.deepEqual(tp.from, from);
  assert.deepEqual(tp.to, g.players.get('a')!.hq.pos);
  assert.notDeepEqual(tp.from, tp.to);
});

test('view: your team sees its own HQs and scouts, with allies included', () => {
  const g = makeGame({
    nodes: [node('n', 300, 1)],
    players: [player('a', 0, [{ power: 60 }]), player('c', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  const v = viewFor(g, 0);
  assert.deepEqual(v.hqs.map((h) => h.owner).sort(), ['a', 'c']);
  assert.equal(v.scouts.length, 6);
  assert.ok(v.scouts.every((s) => s.state === 'home'));
  must(g, { type: 'scout', playerId: 'a', scoutIndex: 0, target: { kind: 'node', nodeId: 'n' } });
  const out = viewFor(g, 0).scouts.find((s) => s.owner === 'a' && s.index === 0)!;
  assert.equal(out.state, 'out');
  assert.ok(out.arriveMs! > g.now);
  assert.equal(viewFor(g, 1).scouts.every((s) => s.owner === 'b'), true, 'never the other team scouts');
});
