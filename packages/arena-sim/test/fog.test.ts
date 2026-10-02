import assert from 'node:assert/strict';
import { viewFor } from '../src/fog';
import { test } from './harness';
import { arrival, makeGame, marchAndArrive, must, player, scenarioTune } from './helpers';
import type { NodeDef } from './helpers';

test('fog: enemy marches are masked, scout reveals show type for 10s (tuned) then mask again', () => {
  const nodes: NodeDef[] = [
    { id: 'n0', kind: 'points', x: 300, y: 300 },
    { id: 'v', kind: 'largeVision', x: 600, y: 300 },
    { id: 'x', kind: 'points', x: 300, y: 100 },
  ];
  const g = makeGame({
    nodes,
    tune: scenarioTune({ scout: { revealSeconds: 10 } }),
    players: [player('a', 0, [{ power: 60, type: 'tank' }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'b', 's1', 'v');
  marchAndArrive(g, 'a', 's0', 'n0');

  must(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'node', nodeId: 'n0' } });
  const scout = g.players.get('b')!.scouts[0];
  g.advanceTo(scout.kind === 'out' ? scout.arriveMs : 0);
  assert.equal(viewFor(g, 1).scoutReports.length, 1);
  assert.equal(viewFor(g, 0).scoutReports.length, 0, 'the other team does not see our scouting');

  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'x' } });
  const t0 = g.now;
  g.advanceTo(t0 + 5_000);
  let seen = viewFor(g, 1).enemyMarches;
  assert.equal(seen.length, 1);
  assert.equal(seen[0].revealed?.type, 'tank');
  assert.equal(seen[0].revealed?.commander, 'a');
  for (const k of ['type', 'owner', 'power', 'troops', 'commander', 'team']) {
    assert.ok(!(k in seen[0]), `enemy march leaks ${k}`);
  }

  g.advanceTo(t0 + 12_000);
  seen = viewFor(g, 1).enemyMarches;
  assert.equal(seen.length, 1, 'still visible, still marching');
  assert.equal(seen[0].revealed, undefined, 'reveal expired, masked again');
  assert.equal(viewFor(g, 1).scoutReports.length, 0, 'expired report is gone');
});

test('fog: you only see enemy marches inside your own nodes vision', () => {
  const nodes: NodeDef[] = [
    { id: 'n0', kind: 'points', x: 300, y: 300 },
    { id: 'n2', kind: 'points', x: 700, y: 300 },
  ];
  const g = makeGame({
    nodes,
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }, { power: 60 }])],
  });
  marchAndArrive(g, 'b', 's1', 'n2'); // b owns n2 (vision 220 around x=700)
  assert.equal(viewFor(g, 1).enemyMarches.length, 0);
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n2' } });
  const start = g.now;
  const total = arrival(g, 's0') - start;
  g.advanceTo(start + total * 0.1);
  assert.equal(viewFor(g, 1).enemyMarches.length, 0, 'far from b vision');
  g.advanceTo(start + total * 0.97);
  assert.equal(viewFor(g, 1).enemyMarches.length, 1, 'inside b vision');
  assert.equal(viewFor(g, 0).enemyMarches.length, 0, 'a sees no enemy marches');
  assert.equal(viewFor(g, 0).squads.length, 1, 'own squads always visible');
});

test('fog: nodes outside vision keep their last known owner, unseen ones are unexplored', () => {
  const nodes: NodeDef[] = [
    { id: 'L', kind: 'largeVision', x: 300, y: 300 },
    { id: 'F', kind: 'points', x: 700, y: 300 },
    { id: 'X', kind: 'points', x: 300, y: 100 },
  ];
  const g = makeGame({
    nodes,
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }, { power: 60 }])],
  });
  const f = () => viewFor(g, 0).nodes.find((n) => n.id === 'F')!;
  assert.equal(f().explored, false, 'never seen anything yet');

  marchAndArrive(g, 'a', 's0', 'L'); // L has vision radius 600, covers F
  assert.ok(f().visible && f().explored && f().owner === null);

  marchAndArrive(g, 'b', 's1', 'F');
  assert.ok(f().visible && f().owner === 1, 'a sees b take F');

  // a leaves L empty and goes to X, b then touches L: a loses the big vision.
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'X' } });
  g.advanceTo(arrival(g, 's0'));
  marchAndArrive(g, 'b', 's2', 'L');
  assert.equal(g.nodes.get('L')!.owner, 1);
  assert.equal(f().visible, false);
  assert.equal(f().explored, true);
  assert.equal(f().owner, 1, 'remembered');
});

test('fog: enemy HQs show only inside vision, never in a safe zone', () => {
  const nodes: NodeDef[] = [
    { id: 'n0', kind: 'points', x: 300, y: 300 },
    { id: 'n1', kind: 'points', x: 300, y: 150 },
    { id: 'far', kind: 'points', x: 900, y: 500 },
  ];
  const g = makeGame({
    nodes,
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }, { power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  assert.equal(viewFor(g, 1).enemyHqs.length, 0, 'in the safe zone');
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  assert.equal(viewFor(g, 1).enemyHqs.length, 0, 'b has no vision there');
  marchAndArrive(g, 'b', 's1', 'n1'); // 150 from n0, inside the 220 radius
  const hqs = viewFor(g, 1).enemyHqs;
  assert.equal(hqs.length, 1);
  assert.deepEqual(Object.keys(hqs[0]).sort(), ['burning', 'id', 'pos'], 'no owner or exact HP leaked');
  assert.equal(hqs[0].burning, false, 'undamaged');
});

test('fog: combat logs reach both sides with full info, newest first', () => {
  const g = makeGame({
    nodes: [{ id: 'n0', kind: 'points', x: 300, y: 300 }],
    players: [player('a', 0, [{ power: 70 }, { power: 70 }]), player('b', 1, [{ power: 60 }, { power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'node', nodeId: 'n0' } });
  g.advanceTo(arrival(g, 's2')); // b loses
  g.advanceTo(arrival(g, 's2'));
  must(g, { type: 'march', playerId: 'b', squadId: 's3', target: { kind: 'node', nodeId: 'n0' } });
  g.advanceTo(arrival(g, 's3'));
  for (const team of [0, 1] as const) {
    const logs = viewFor(g, team).combatLogs;
    assert.equal(logs.length, 2);
    assert.ok(logs[0].id > logs[1].id, 'most recent first');
    assert.equal(logs[0].fights[0].defender.commander, 'a');
    assert.equal(logs[0].attacker.commander, 'b');
  }
});
