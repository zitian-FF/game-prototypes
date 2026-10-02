import assert from 'node:assert/strict';
import { viewFor } from '../src/fog';
import type { GameEvent } from '../src/types';
import { test } from './harness';
import { arrival, err, makeGame, marchAndArrive, must, player, scenarioTune } from './helpers';
import type { NodeDef } from './helpers';

const N0: NodeDef = { id: 'n0', kind: 'points', x: 300, y: 300 };
const ofType = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

test('garrison: a node holds up to 20 squads, the 21st is refused', () => {
  const commanders = Array.from({ length: 21 }, (_, i) => player(`c${i}`, 0, [{ power: 60 }]));
  const g = makeGame({ nodes: [N0], players: [...commanders, player('b', 1, [{ power: 60 }])] });
  for (let i = 0; i < 20; i++) marchAndArrive(g, `c${i}`, `s${i}`, 'n0');
  assert.equal(g.nodes.get('n0')!.garrison.length, 20);
  assert.equal(err(g, { type: 'march', playerId: 'c20', squadId: 's20', target: { kind: 'node', nodeId: 'n0' } }), 'nodeFull');
  assert.deepEqual(g.checkInvariants(), []);
});

test('garrison: only one squad per commander in a node', () => {
  const g = makeGame({
    nodes: [N0, { id: 'n1', kind: 'points', x: 500, y: 300 }],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  assert.equal(err(g, { type: 'march', playerId: 'a', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } }), 'commanderAlreadyThere');
  // A different node is fine: one squad per commander per node, not per commander overall.
  marchAndArrive(g, 'a', 's1', 'n1');
  assert.equal(g.squads.get('s1')!.state.kind, 'garrison');
});

test('garrison: a commander cannot queue a second squad behind one already marching to the node', () => {
  const g = makeGame({
    nodes: [N0],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('c', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'c', 's2', 'n0'); // team 0 owns n0
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n0' } });
  assert.equal(err(g, { type: 'march', playerId: 'a', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } }), 'commanderAlreadyThere');
  g.advanceTo(arrival(g, 's0'));
  assert.deepEqual(g.nodes.get('n0')!.garrison, ['s2', 's0']);
});

test('garrison: arrival backstop, a squad turns back if the node filled while it marched', () => {
  const commanders = Array.from({ length: 3 }, (_, i) => player(`c${i}`, 0, [{ power: 60 }]));
  const g = makeGame({
    nodes: [N0],
    tune: scenarioTune({ garrison: { maxSquads: 2 } }),
    players: [...commanders, player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'c0', 's0', 'n0'); // owns n0, 1 of 2 slots used
  // c1 and c2 both set off before either arrives, so both pass the order check.
  must(g, { type: 'march', playerId: 'c1', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } });
  must(g, { type: 'march', playerId: 'c2', squadId: 's2', target: { kind: 'node', nodeId: 'n0' } });
  const events = g.advanceTo(Math.max(arrival(g, 's1'), arrival(g, 's2')));
  const rejected = ofType(events, 'garrisonRejected');
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, 'nodeFull');
  assert.equal(g.nodes.get('n0')!.garrison.length, 2);
  const turned = g.squads.get(rejected[0].squadId)!;
  assert.ok(turned.state.kind === 'march' && turned.state.march.purpose === 'home');
  assert.ok(turned.state.kind === 'march' && Math.abs(turned.state.march.speed - g.marchSpeed) < 1e-9, 'not a defeat, full speed');
  assert.ok(turned.troops > 0);
  assert.deepEqual(g.checkInvariants(), []);
});

test('garrison: two squads of one commander sent to attack the same node, the second turns back after the first captures it', () => {
  const g = makeGame({
    nodes: [N0],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n0' } });
  must(g, { type: 'march', playerId: 'a', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } });
  const events = g.advanceTo(Math.max(arrival(g, 's0'), arrival(g, 's1')));
  assert.equal(g.nodes.get('n0')!.garrison.length, 1);
  assert.equal(ofType(events, 'garrisonRejected')[0].reason, 'commanderAlreadyThere');
});

test('garrison: an attacker still only fights through 10 of a full 20 squad garrison', () => {
  const defenders = Array.from({ length: 20 }, (_, i) => player(`d${i}`, 0, [{ power: 50 }]));
  const g = makeGame({ nodes: [N0], players: [...defenders, player('b', 1, [{ power: 80 }])] });
  for (let i = 0; i < 20; i++) marchAndArrive(g, `d${i}`, `s${i}`, 'n0');
  assert.equal(g.nodes.get('n0')!.garrison.length, 20);
  must(g, { type: 'march', playerId: 'b', squadId: 's20', target: { kind: 'node', nodeId: 'n0' } });
  const events = g.advanceTo(arrival(g, 's20'));
  const log = ofType(events, 'combat')[0].log;
  assert.equal(log.fights.length, 10);
  assert.equal(log.outcome, 'capReached');
  assert.equal(g.nodes.get('n0')!.garrison.length, 10, 'the 10 earliest squads are left');
  assert.equal(g.nodes.get('n0')!.owner, 0);
});

test('garrison: a full garrison pays 20 commanders x 10 on top of the tier score', () => {
  const commanders = Array.from({ length: 20 }, (_, i) => player(`c${i}`, 0, [{ power: 60 }]));
  const g = makeGame({ nodes: [{ ...N0, tier: 4 }], players: [...commanders, player('b', 1, [{ power: 60 }])] });
  for (let i = 0; i < 20; i++) marchAndArrive(g, `c${i}`, `s${i}`, 'n0');
  const before = g.points()[0];
  g.advanceTo(g.now + 1000);
  assert.ok(Math.abs(g.points()[0] - before - (80 + 20 * 10)) < 1e-6);
  assert.equal(viewFor(g, 0).nodes.find((n) => n.id === 'n0')!.garrisonCount, 20);
});
