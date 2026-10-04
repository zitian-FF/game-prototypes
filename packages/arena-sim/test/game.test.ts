import assert from 'node:assert/strict';
import { dist } from '../src/map';
import type { GameEvent } from '../src/types';
import { viewFor } from '../src/fog';
import { test } from './harness';
import { SQUAD_ID, arrival, err, makeGame, marchAndArrive, must, player, scenarioTune, withTune } from './helpers';
import type { NodeDef } from './helpers';

const N0: NodeDef = { id: 'n0', kind: 'points', x: 300, y: 300 };
const N1: NodeDef = { id: 'n1', kind: 'points', tier: 2, x: 500, y: 300 };
const N2: NodeDef = { id: 'n2', kind: 'points', x: 700, y: 300 };

const ofType = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

// ------------------------------------------------------------ capturing

test('nodes: a squad marching to a neutral node captures it and earns points', () => {
  const g = makeGame({ nodes: [N0], players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])] });
  const started = must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n0' } });
  assert.equal(started[0].type, 'marchStarted');
  const events = g.advanceTo(arrival(g, 's0'));
  assert.equal(g.nodes.get('n0')!.owner, 0);
  assert.equal(g.squads.get('s0')!.state.kind, 'garrison');
  const cap = ofType(events, 'nodeCaptured')[0];
  assert.equal(cap.previous, null);
  const t0 = g.now;
  g.advanceTo(t0 + 10_000);
  // Tier 1 node (10/s) plus 10/s for the one commander garrisoned there.
  assert.ok(Math.abs(g.points()[0] - 200) < 1e-6, `points ${g.points()[0]}`);
  assert.equal(g.points()[1], 0);
});

test('nodes: march time is distance over base speed (tuned cross-map time)', () => {
  const g = makeGame({ nodes: [N0], players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])] });
  const from = g.squadPos(g.squads.get('s0')!);
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n0' } });
  const expected = (dist(from, { x: 300, y: 300 }) / g.marchSpeed) * 1000;
  assert.ok(Math.abs(arrival(g, 's0') - expected) < 1e-6);
  assert.ok(Math.abs(Math.hypot(1000, 600) / g.marchSpeed - g.tune.march.crossMapSeconds) < 1e-9);
});

test('nodes: an ungarrisoned node keeps its owner until an enemy touches it', () => {
  const g = makeGame({
    nodes: [N0, N1],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'cancel', playerId: 'a', squadId: 's0' }); // leaves the node empty
  const node = g.nodes.get('n0')!;
  assert.equal(node.garrison.length, 0);
  assert.equal(node.owner, 0, 'still a-team property while empty');
  const before = g.points()[0];
  g.advanceTo(g.now + 5000);
  assert.ok(g.points()[0] > before, 'still earning points');

  must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'node', nodeId: 'n0' } });
  const events = g.advanceTo(arrival(g, 's2'));
  assert.equal(node.owner, 1, 'control flips the moment the enemy touches it');
  assert.equal(ofType(events, 'combat').length, 0, 'no fight, nothing to fight');
  assert.equal(ofType(events, 'nodeCaptured').find((e) => e.nodeId === 'n0')!.previous, 0);
  assert.deepEqual(g.checkInvariants(), []);
});

test('nodes: reinforcing an owned node garrisons instead of fighting', () => {
  const g = makeGame({
    nodes: [N0],
    players: [player('a', 0, [{ power: 60 }]), player('c', 0, [{ power: 55 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  const events = marchAndArrive(g, 'c', 's1', 'n0');
  assert.equal(ofType(events, 'combat').length, 0);
  assert.deepEqual(g.nodes.get('n0')!.garrison, ['s0', 's1']);
});

// -------------------------------------------------------------- combat

test('combat: defenders are fought last in, first out', () => {
  const g = makeGame({
    nodes: [N0],
    players: [player('a', 0, [{ power: 55 }]), player('a2', 0, [{ power: 56 }]), player('b', 1, [{ power: 80 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  marchAndArrive(g, 'a2', 's1', 'n0');
  must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'node', nodeId: 'n0' } });
  const events = g.advanceTo(arrival(g, 's2'));
  const log = ofType(events, 'combat')[0].log;
  assert.deepEqual(log.fights.map((f) => f.defender.squadId), ['s1', 's0']);
  assert.equal(log.outcome, 'captured');
  assert.equal(g.nodes.get('n0')!.owner, 1);
  assert.equal(g.squads.get('s2')!.state.kind, 'garrison', 'winner stays and garrisons');
});

test('combat: defeated defenders walk home at 50% speed, they are not deleted', () => {
  const g = makeGame({ nodes: [N0], players: [player('a', 0, [{ power: 55 }]), player('b', 1, [{ power: 80 }])] });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } });
  g.advanceTo(arrival(g, 's1'));
  const sq = g.squads.get('s0')!;
  assert.equal(sq.troops, 0);
  assert.equal(sq.state.kind, 'march');
  if (sq.state.kind !== 'march') return;
  assert.equal(sq.state.march.purpose, 'home');
  assert.ok(Math.abs(sq.state.march.speed - g.marchSpeed * 0.5) < 1e-9);
  // On arrival it refills from the reserve pool.
  g.advanceTo(arrival(g, 's0'));
  assert.equal(sq.state.kind, 'hq');
  assert.equal(sq.troops, 3000);
  assert.equal(g.players.get('a')!.pool, 45000 - 3000);
});

test('combat: a defeated attacker returns at 50% speed and the defender stays wounded', () => {
  const g = makeGame({ nodes: [N0], players: [player('a', 0, [{ power: 70 }]), player('b', 1, [{ power: 45 }])] });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } });
  const events = g.advanceTo(arrival(g, 's1'));
  const log = ofType(events, 'combat')[0].log;
  assert.equal(log.outcome, 'attackerDefeated');
  const node = g.nodes.get('n0')!;
  assert.equal(node.owner, 0);
  assert.deepEqual(node.garrison, ['s0']);
  const defender = g.squads.get('s0')!;
  assert.ok(defender.troops < 3000 && defender.troops > 2000, `defender troops ${defender.troops}`);
  const attacker = g.squads.get('s1')!;
  assert.equal(attacker.troops, 0);
  assert.ok(attacker.state.kind === 'march' && Math.abs(attacker.state.march.speed - g.marchSpeed * 0.5) < 1e-9);
  assert.ok(log.attacker.troopsBefore === 3000 && log.attacker.troopsAfter === 0);
});

test('combat: refill draws from a finite pool and can be partial', () => {
  const g = makeGame({
    nodes: [N0],
    players: [player('a', 0, [{ power: 70 }]), player('b', 1, [{ power: 45 }], 1000)],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } });
  g.advanceTo(arrival(g, 's1'));
  g.advanceTo(arrival(g, 's1'));
  g.advanceTo(g.now + 10 * 60_000);
  const b = g.players.get('b')!;
  assert.equal(b.pool, 0, 'pool drained');
  assert.equal(g.squads.get('s1')!.troops, 1000, 'only what the pool had');
  assert.equal(g.squads.get('s1')!.state.kind, 'hq');
});

test('combat: an attacker clears at most 10 defenders, then goes home alive', () => {
  // 11 commanders, one weak squad each (a node holds one squad per commander).
  const defenders = Array.from({ length: 11 }, (_, i) => player(`d${i}`, 0, [{ power: 50 }]));
  const g = makeGame({ nodes: [N0], players: [...defenders, player('b', 1, [{ power: 80 }])] });
  for (let i = 0; i < 11; i++) marchAndArrive(g, `d${i}`, SQUAD_ID(i), 'n0');
  assert.equal(g.nodes.get('n0')!.garrison.length, 11);
  must(g, { type: 'march', playerId: 'b', squadId: 's11', target: { kind: 'node', nodeId: 'n0' } });
  const events = g.advanceTo(arrival(g, 's11'));
  const log = ofType(events, 'combat')[0].log;
  assert.equal(log.fights.length, 10);
  assert.equal(log.outcome, 'capReached');
  const node = g.nodes.get('n0')!;
  assert.equal(node.owner, 0, 'node not taken');
  assert.deepEqual(node.garrison, ['s0'], 'earliest garrison squad is the last in line, so it is the one left');
  const attacker = g.squads.get('s11')!;
  assert.ok(attacker.troops > 0);
  assert.ok(attacker.state.kind === 'march' && attacker.state.march.purpose === 'home');
  assert.ok(attacker.state.kind === 'march' && Math.abs(attacker.state.march.speed - g.marchSpeed) < 1e-9, 'not defeated, so full speed');
  assert.deepEqual(g.checkInvariants(), []);
});

test('combat: node boosts apply (attack boost flips a close fight)', () => {
  const nodes: NodeDef[] = [N0, { id: 'atk', kind: 'attackBoost', x: 300, y: 100 }];
  const players = () => [player('a', 0, [{ power: 58 }, { power: 58 }]), player('b', 1, [{ power: 60 }])];
  const plain = makeGame({ nodes, players: players() });
  marchAndArrive(plain, 'b', 's2', 'n0');
  must(plain, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n0' } });
  plain.advanceTo(arrival(plain, 's0'));
  assert.equal(plain.nodes.get('n0')!.owner, 1, 'no boost: the 60m defender holds');

  const boosted = makeGame({ nodes, players: players() });
  marchAndArrive(boosted, 'a', 's1', 'atk');
  marchAndArrive(boosted, 'b', 's2', 'n0');
  must(boosted, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n0' } });
  boosted.advanceTo(arrival(boosted, 's0'));
  assert.equal(boosted.nodes.get('n0')!.owner, 0, '+5% attack makes 58m beat 60m');
});

test('combat: combat logs show full info for both sides, newest first', () => {
  const g = makeGame({ nodes: [N0], players: [player('a', 0, [{ power: 60, type: 'tank' }]), player('b', 1, [{ power: 80, type: 'aircraft' }])] });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } });
  g.advanceTo(arrival(g, 's1'));
  const log = g.combatLogs[0];
  assert.equal(log.attacker.commander, 'b');
  assert.equal(log.fights[0].defender.commander, 'a');
  assert.equal(log.fights[0].defender.type, 'tank');
  assert.equal(log.attacker.type, 'aircraft');
});

// ----------------------------------------------------------------- HQs

/** Team a captures n0 and teleports there; returns the game. */
function hqScene(extraNodes: NodeDef[] = [], tuneOverrides = {}) {
  const g = makeGame({
    nodes: [N0, ...extraNodes],
    tune: scenarioTune(tuneOverrides),
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 75 }, { power: 75 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  return g;
}

test('hq: cannot attack an HQ that is still in its safe zone', () => {
  const g = makeGame({ nodes: [N0], players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 75 }])] });
  assert.equal(err(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'hq', hqId: 'h0' } }), 'safeZone');
});

test('hq: 4 HP, one lost per cleared attack, 0 sends it to the safe zone at full HP', () => {
  const g = hqScene();
  const hq = g.players.get('a')!.hq;
  assert.equal(hq.location.kind, 'node');
  const seen: number[] = [];
  let lastEvents: GameEvent[] = [];
  for (let i = 0; i < 4; i++) {
    must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
    lastEvents = g.advanceTo(arrival(g, 's2'));
    seen.push(hq.hp);
    // Wait for the attacker to get home again before the next hit.
    g.advanceTo(arrival(g, 's2'));
  }
  assert.deepEqual(seen, [3, 2, 1, 4], 'HP drops 4 -> 3 -> 2 -> 1 then resets when defeated');
  assert.equal(hq.location.kind, 'safe');
  assert.ok(ofType(lastEvents, 'hqDefeated').length === 1);
  assert.ok(ofType(lastEvents, 'teleported')[0].forced);
  assert.ok(g.nodes.get('n0')!.slots.every((s) => s === null), 'slot freed');
  assert.equal(g.squads.get('s0')!.state.kind, 'hq', 'squads went with the HQ');
  assert.deepEqual(g.checkInvariants(), []);
});

test('hq: after an HQ attack the attacker returns home, win or lose', () => {
  const g = hqScene();
  must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
  g.advanceTo(arrival(g, 's2'));
  const sq = g.squads.get('s2')!;
  assert.ok(sq.state.kind === 'march' && sq.state.march.purpose === 'home');
  assert.ok(g.combatLogs[0].subject.kind === 'hq');
});

test('hq: only checked squads defend; unchecked HQ takes damage without a fight', () => {
  const g = hqScene();
  must(g, { type: 'setDefend', playerId: 'a', squadId: 's0', defend: false });
  must(g, { type: 'setDefend', playerId: 'a', squadId: 's1', defend: false });
  must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
  const events = g.advanceTo(arrival(g, 's2'));
  assert.equal(ofType(events, 'combat').length, 0);
  assert.equal(ofType(events, 'hqDamaged')[0].hp, 3);
});

test('hq: a defender fights for the HQ and is wounded', () => {
  const g = hqScene();
  must(g, { type: 'setDefend', playerId: 'a', squadId: 's1', defend: false });
  // Make refills slow so the wound is visible.
  const slow = hqScene([], { hq: { refillSeconds: 600 } });
  must(slow, { type: 'setDefend', playerId: 'a', squadId: 's1', defend: false });
  must(slow, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
  slow.advanceTo(arrival(slow, 's2'));
  assert.equal(slow.squads.get('s0')!.troops, 0, 'the 60m defender lost to a 75m attacker');
  assert.equal(slow.squads.get('s1')!.troops, 3000, 'unchecked squad did not fight');
});

test('hq: dodging, the HQ teleports away and the attacker arrives at an empty slot', () => {
  const n1: NodeDef = { id: 'n1', kind: 'points', x: 300, y: 150 };
  const g = hqScene([n1], { hq: { teleportCooldownSeconds: 30 } });
  marchAndArrive(g, 'a', 's1', 'n1'); // a also owns n1 now
  must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
  const mid = (g.now + arrival(g, 's2')) / 2;
  g.advanceTo(Math.max(mid, g.players.get('a')!.nextTeleportAtMs));
  assert.ok(g.now < arrival(g, 's2'));
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n1' });
  const hqBefore = g.players.get('a')!.hq.hp;
  const events = g.advanceTo(arrival(g, 's2'));
  assert.equal(g.players.get('a')!.hq.hp, hqBefore, 'no damage');
  assert.equal(ofType(events, 'combat').length, 0);
  const sq = g.squads.get('s2')!;
  assert.ok(sq.state.kind === 'march' && sq.state.march.purpose === 'home');
  assert.ok(sq.state.kind === 'march' && Math.abs(sq.state.march.speed - g.marchSpeed) < 1e-9, 'a whiff is not a defeat, full speed home');
});

// ------------------------------------------------------------- teleport

test('teleport: only to controlled nodes, instant, 2 minute cooldown', () => {
  const g = makeGame({
    nodes: [N0, N1],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  assert.equal(err(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' }), 'notControlled');
  marchAndArrive(g, 'a', 's0', 'n0');
  marchAndArrive(g, 'a', 's1', 'n1');
  const t = g.now;
  const events = must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  assert.equal(g.now, t, 'instant');
  assert.equal(ofType(events, 'teleported')[0].forced, false);
  const hq = g.players.get('a')!.hq;
  assert.equal(hq.location.kind, 'node');
  assert.ok(Math.abs(dist(hq.pos, { x: 300, y: 300 }) - 40) < 1e-9, 'sits on the slot ring');
  assert.equal(err(g, { type: 'teleport', playerId: 'a', nodeId: 'n1' }), 'onCooldown');
  g.advanceTo(t + 119_000);
  assert.equal(err(g, { type: 'teleport', playerId: 'a', nodeId: 'n1' }), 'onCooldown');
  g.advanceTo(t + 120_000);
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n1' });
  assert.equal(err(g, { type: 'teleport', playerId: 'a', nodeId: 'n1' }), 'onCooldown');
});

test('teleport: every squad goes home with the HQ and held nodes are left empty', () => {
  const g = makeGame({
    nodes: [N0, N1, N2],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  marchAndArrive(g, 'a', 's1', 'n1');
  must(g, { type: 'march', playerId: 'a', squadId: 's2', target: { kind: 'node', nodeId: 'n2' } });
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  for (const id of ['s0', 's1', 's2']) assert.equal(g.squads.get(id)!.state.kind, 'hq', id);
  assert.equal(g.nodes.get('n0')!.garrison.length, 0);
  assert.equal(g.nodes.get('n1')!.garrison.length, 0);
  assert.equal(g.nodes.get('n0')!.owner, 0, 'nodes stay owned until touched');
  assert.deepEqual(g.checkInvariants(), []);
  // The stale arrival of s2 must not do anything.
  g.advanceTo(g.now + 10 * 60_000);
  assert.equal(g.squads.get('s2')!.state.kind, 'hq');
});

test('teleport: cooldown nodes shorten the cooldown', () => {
  const tc: NodeDef = { id: 'tc', kind: 'teleportCooldown', x: 500, y: 300 };
  const g = makeGame({ nodes: [N0, tc], players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])] });
  marchAndArrive(g, 'a', 's0', 'n0');
  marchAndArrive(g, 'a', 's1', 'tc');
  const t = g.now;
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  assert.equal(g.players.get('a')!.nextTeleportAtMs - t, 105_000, '120s - 15s');
});

test('teleport: stranded HQs stay after a node flips and can be hit; the new owner can teleport in beside them', () => {
  const g = makeGame({
    nodes: [N0],
    tune: scenarioTune({ hq: { slotsPerNode: 2 } }),
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 75 }, { power: 75 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  marchAndArrive(g, 'b', 's1', 'n0'); // ungarrisoned, b touches it
  const node = g.nodes.get('n0')!;
  assert.equal(node.owner, 1);
  assert.equal(g.players.get('a')!.hq.location.kind, 'node', 'a HQ is stranded, not evicted');
  assert.equal(node.slots[0], 'h0');
  must(g, { type: 'teleport', playerId: 'b', nodeId: 'n0' });
  assert.equal(node.slots[1], 'h1', 'b takes the free slot beside the stranded HQ');
  // Stranded HQ is a valid target, and b is right next to it.
  must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
  assert.deepEqual(g.checkInvariants(), []);
});

test('teleport: a full ring of stranded HQs blocks the new owner', () => {
  const g = makeGame({
    nodes: [N0],
    tune: scenarioTune({ hq: { slotsPerNode: 1 } }),
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 75 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  marchAndArrive(g, 'b', 's1', 'n0');
  assert.equal(err(g, { type: 'teleport', playerId: 'b', nodeId: 'n0' }), 'noFreeSlot');
});

test('teleport: a stranded HQ can still jump away once off cooldown', () => {
  const n1: NodeDef = { id: 'n1', kind: 'points', x: 300, y: 150 };
  const g = makeGame({
    nodes: [N0, n1],
    tune: scenarioTune({ hq: { teleportCooldownSeconds: 20 } }),
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 75 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  marchAndArrive(g, 'a', 's1', 'n1');
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  marchAndArrive(g, 'b', 's2', 'n0');
  g.advanceTo(g.players.get('a')!.nextTeleportAtMs);
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n1' });
  assert.ok(g.nodes.get('n0')!.slots.every((s) => s === null));
});

// ---------------------------------------------------------------- cancel

test('cancel: a marching squad turns round from where it is and heads home', () => {
  const g = makeGame({ nodes: [N0], players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])] });
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n0' } });
  const total = arrival(g, 's0') - g.now;
  g.advanceTo(g.now + total / 2);
  const mid = g.squadPos(g.squads.get('s0')!);
  const events = must(g, { type: 'cancel', playerId: 'a', squadId: 's0' });
  assert.equal(events[0].type, 'marchCancelled');
  const sq = g.squads.get('s0')!;
  assert.ok(sq.state.kind === 'march' && sq.state.march.purpose === 'home');
  assert.ok(sq.state.kind === 'march' && dist(sq.state.march.from, mid) < 1e-6);
  assert.equal(err(g, { type: 'cancel', playerId: 'a', squadId: 's0' }), 'alreadyReturning');
  g.advanceTo(arrival(g, 's0'));
  assert.equal(sq.state.kind, 'hq');
  assert.equal(g.nodes.get('n0')!.owner, null, 'the old arrival did not capture anything');
});

// ---------------------------------------------------------------- scouts

test('scout: flies at 3x squad speed, reveals defenders, expires after 60s', () => {
  const g = makeGame({
    nodes: [N0],
    players: [
      player('a', 0, [{ power: 60, type: 'tank' }]),
      player('c', 0, [{ power: 55, type: 'missile' }]),
      player('b', 1, [{ power: 60 }]),
    ],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  marchAndArrive(g, 'c', 's1', 'n0');
  const start = g.now;
  must(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'node', nodeId: 'n0' } });
  const scout = g.players.get('b')!.scouts[0];
  assert.equal(scout.kind, 'out');
  if (scout.kind !== 'out') return;
  const expected = (dist(scout.from, scout.to) / (g.marchSpeed * 3)) * 1000;
  assert.ok(Math.abs(scout.arriveMs - start - expected) < 1e-6);

  const events = g.advanceTo(scout.arriveMs);
  const report = ofType(events, 'scoutReport')[0].report;
  assert.deepEqual(report.defenders.map((d) => d.squadId), ['s1', 's0'], 'last in first listed');
  assert.deepEqual(report.defenders.map((d) => d.type), ['missile', 'tank']);
  assert.deepEqual(report.defenders.map((d) => d.commander), ['c', 'a']);
  assert.equal(report.defenders[0].effectivePower, 55);
  assert.ok(Math.abs(report.expiresAtMs - report.takenAtMs - 60_000) < 1e-6);
  assert.equal(g.players.get('b')!.scouts[0].kind, 'back');
});

test('scout: reveals power adjusted by remaining troops', () => {
  const g = makeGame({
    nodes: [N0],
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 45 }, { power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'march', playerId: 'b', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } });
  g.advanceTo(arrival(g, 's1')); // loses, leaves the defender wounded
  const wounded = g.squads.get('s0')!;
  must(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'node', nodeId: 'n0' } });
  const scout = g.players.get('b')!.scouts[0];
  const events = g.advanceTo(scout.kind === 'out' ? scout.arriveMs : 0);
  const rev = ofType(events, 'scoutReport')[0].report.defenders[0];
  assert.ok(Math.abs(rev.effectivePower - (60 * wounded.troops) / wounded.maxTroops) < 1e-9);
  assert.ok(rev.effectivePower < 60);
});

test('scout: must come home before reuse, three per HQ, safe-zone HQs are off limits', () => {
  const g = makeGame({
    nodes: [N0],
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  assert.equal(err(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'hq', hqId: 'h0' } }), 'safeZone');
  assert.equal(err(g, { type: 'scout', playerId: 'b', scoutIndex: 3, target: { kind: 'node', nodeId: 'n0' } }), 'unknownScout');
  must(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'node', nodeId: 'n0' } });
  assert.equal(err(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'node', nodeId: 'n0' } }), 'scoutBusy');
  must(g, { type: 'scout', playerId: 'b', scoutIndex: 1, target: { kind: 'node', nodeId: 'n0' } });
  must(g, { type: 'scout', playerId: 'b', scoutIndex: 2, target: { kind: 'node', nodeId: 'n0' } });
  const first = g.players.get('b')!.scouts[0];
  g.advanceTo(first.kind === 'out' ? first.arriveMs : 0);
  assert.equal(err(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'node', nodeId: 'n0' } }), 'scoutBusy', 'still flying home');
  const back = g.players.get('b')!.scouts[0];
  g.advanceTo(back.kind === 'back' ? back.arriveMs : 0);
  assert.equal(g.players.get('b')!.scouts[0].kind, 'home');
  must(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'node', nodeId: 'n0' } });
});

test('scout: scouting an HQ that already teleported away finds nothing', () => {
  const g = hqScene([{ id: 'n1', kind: 'points', x: 300, y: 150 }], { hq: { teleportCooldownSeconds: 30 } });
  marchAndArrive(g, 'a', 's1', 'n1');
  must(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'hq', hqId: 'h0' } });
  const scout = g.players.get('b')!.scouts[0];
  g.advanceTo(Math.max(g.now, g.players.get('a')!.nextTeleportAtMs));
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n1' });
  const events = g.advanceTo(scout.kind === 'out' ? scout.arriveMs : 0);
  const report = ofType(events, 'scoutReport')[0].report;
  assert.ok(report.empty && report.defenders.length === 0);
});

// ---------------------------------------------------------------- turrets

test('turret: fires at every enemy-held tier 3+ node, a hit takes a flat % of max troops from each garrison', () => {
  const T: NodeDef = { id: 'T', kind: 'turret', x: 500, y: 300, tier: 2 };
  const t3: NodeDef = { id: 't3', kind: 'points', x: 900, y: 100, tier: 3 };
  const t4: NodeDef = { id: 't4', kind: 'points', x: 100, y: 500, tier: 4 };
  const low: NodeDef = { id: 'low', kind: 'points', x: 700, y: 500, tier: 1 };
  const g = makeGame({
    nodes: [T, t3, t4, low],
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }, { power: 60 }, { power: 60 }, { power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'T');
  marchAndArrive(g, 'b', 's1', 't3');
  marchAndArrive(g, 'b', 's2', 't4');
  marchAndArrive(g, 'b', 's3', 'low');
  const launches: GameEvent[] = [];
  const hits: GameEvent[] = [];
  const next = (Math.floor(g.now / 5_000) + 1) * 5_000;
  const ev = g.advanceTo(next + 200_000);
  launches.push(...ofType(ev, 'missileLaunched'));
  hits.push(...ofType(ev, 'turretPulse'));
  const targets = new Set(ofType(ev, 'missileLaunched').map((m) => m.nodeId));
  assert.deepEqual([...targets].sort(), ['t3', 't4'], 'only tier 3 and 4 enemy nodes are targeted');
  const first = ofType(ev, 'missileLaunched')[0];
  assert.equal(first.team, 0);
  assert.ok(Math.abs((first.arriveMs - first.startMs) - (dist(first.from, first.to) / (g.marchSpeed * 5)) * 1000) < 1e-6, 'five times unit speed');
  assert.ok(hits.length >= 2);
  assert.equal(g.squads.get('s3')!.troops, 3000, 'a tier 1 node is not targeted');
  assert.equal(g.squads.get('s0')!.troops, 3000, 'own team untouched');
  const s1 = g.squads.get('s1')!;
  assert.ok(s1.troops < 3000 && s1.troops >= 1, 'damaged but never killed');
  assert.deepEqual(g.checkInvariants(), []);
});

test('turret: one hit is a flat 5% of max troops, and a squad is never taken below the floor', () => {
  const T: NodeDef = { id: 'T', kind: 'turret', x: 500, y: 300, tier: 2 };
  const t3: NodeDef = { id: 't3', kind: 'points', x: 900, y: 100, tier: 3 };
  const g = makeGame({
    nodes: [T, t3],
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'T');
  const events = marchAndArrive(g, 'b', 's1', 't3');
  void events;
  const sq = g.squads.get('s1')!;
  const before = sq.troops;
  const ev = g.advanceTo(g.now + 80_000);
  const hit = ofType(ev, 'turretPulse')[0];
  assert.deepEqual(hit.hits[0], { squadId: 's1', damage: 150 }, '5% of 3000');
  assert.ok(sq.troops < before);
  g.advanceTo(g.now + 5_000_000 > 1_800_000 ? 1_799_000 : g.now + 5_000_000);
  assert.ok(sq.troops >= 1, `never below the floor, got ${sq.troops}`);
  assert.equal(sq.state.kind, 'garrison', 'stays garrisoned');
});

test('turret: a missile whose target was already retaken by the firing team does nothing', () => {
  const T: NodeDef = { id: 'T', kind: 'turret', x: 500, y: 300, tier: 2 };
  const t3: NodeDef = { id: 't3', kind: 'points', x: 900, y: 100, tier: 3 };
  const g = makeGame({
    nodes: [T, t3],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'T');
  marchAndArrive(g, 'b', 's2', 't3');
  // Fire, then change hands while the missile is still in the air.
  const launch = ofType(g.advanceTo((Math.floor(g.now / 5_000) + 1) * 5_000 + 1), 'missileLaunched')[0];
  assert.ok(launch);
  g.nodes.get('t3')!.owner = 0; // the node was taken by the firing team
  const ev = g.advanceTo(launch.arriveMs + 1);
  assert.equal(ofType(ev, 'turretPulse').filter((h) => h.nodeId === 't3').length, 0);
});

// ------------------------------------------------------------- orders

test('orders: a squad in the field can only be told to come home', () => {
  const g = makeGame({ nodes: [N0, N1], players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])] });
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n0' } });
  assert.equal(err(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n1' } }), 'alreadyMarching');
  g.advanceTo(arrival(g, 's0'));
  assert.equal(g.squads.get('s0')!.state.kind, 'garrison');
  assert.equal(err(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n1' } }), 'notAtHq');
  must(g, { type: 'cancel', playerId: 'a', squadId: 's0' }); // recall from the garrison
  assert.equal(g.nodes.get('n0')!.garrison.length, 0);
  assert.equal(err(g, { type: 'cancel', playerId: 'a', squadId: 's0' }), 'alreadyReturning');
  assert.equal(err(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n1' } }), 'alreadyMarching');
  g.advanceTo(arrival(g, 's0'));
  assert.equal(g.squads.get('s0')!.state.kind, 'hq');
  assert.equal(err(g, { type: 'cancel', playerId: 'a', squadId: 's0' }), 'alreadyHome');
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n1' } });
});

// ------------------------------------------------------------ hospital

test('hospital: refills every ally pool by 20 a second times tier while held, never past the start', () => {
  const H: NodeDef = { id: 'H', kind: 'hospital', x: 300, y: 300, tier: 1 };
  const g = makeGame({
    nodes: [H],
    players: [player('a', 0, [{ power: 60 }], 1000), player('c', 0, [{ power: 60 }], 1000), player('b', 1, [{ power: 60 }], 1000)],
  });
  for (const id of ['a', 'c', 'b']) g.players.get(id)!.pool = 100;
  marchAndArrive(g, 'a', 's0', 'H');
  const t0 = g.now;
  g.advanceTo(t0 + 3_000);
  assert.ok(Math.abs(g.players.get('a')!.pool - 160) < 1e-6, `a pool ${g.players.get('a')!.pool}`);
  assert.ok(Math.abs(g.players.get('c')!.pool - 160) < 1e-6, 'every ally, not just the holder');
  assert.equal(g.players.get('b')!.pool, 100, 'the enemy gets nothing');
  g.advanceTo(t0 + 60_000);
  assert.equal(g.players.get('a')!.pool, 1000, 'capped at the starting pool');
});

// ---------------------------------------------------------------- boosts

test('boost nodes: speed boost makes marches faster', () => {
  const sp: NodeDef = { id: 'sp', kind: 'speedBoost', x: 300, y: 100 };
  const g = makeGame({
    nodes: [N0, sp],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'sp');
  must(g, { type: 'march', playerId: 'a', squadId: 's1', target: { kind: 'node', nodeId: 'n0' } });
  const m = g.squads.get('s1')!.state;
  assert.ok(m.kind === 'march' && Math.abs(m.march.speed - g.marchSpeed * 1.1) < 1e-9);
});

// ----------------------------------------------------------------- match

test('match: team with more points wins; commands are rejected afterwards', () => {
  const g = makeGame({
    nodes: [N1],
    tune: scenarioTune({ match: { durationSeconds: 400 } }),
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n1');
  const events = g.advanceTo(400_000);
  const end = ofType(events, 'matchEnded')[0];
  assert.equal(end.result.winner, 0);
  assert.equal(end.result.reason, 'points');
  assert.ok(end.result.points[0] > 0 && end.result.points[1] === 0);
  assert.equal(g.nextEventAt(), null);
  assert.equal(err(g, { type: 'cancel', playerId: 'a', squadId: 's0' }), 'matchEnded');
  const frozen = g.points()[0];
  g.advanceTo(900_000);
  assert.equal(g.points()[0], frozen);
});

test('match: nobody capturing anything is a draw', () => {
  const g = makeGame({
    nodes: [N1],
    tune: scenarioTune({ match: { durationSeconds: 60 } }),
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  g.advanceTo(60_000);
  assert.deepEqual({ ...g.result!, leaderboard: [] }, { winner: 'draw', points: [0, 0], reason: 'draw', leaderboard: [] });
});

test('match: equal points go to the team that reached the total first', () => {
  const g = makeGame({
    nodes: [N1],
    tune: scenarioTune({ match: { durationSeconds: 20 } }),
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  // Team 0 hit 5 at 10s and stopped; team 1 only got to 5 at the whistle.
  const internals = g as unknown as {
    history: { t: number; p: [number, number] }[];
    pointTotals: [number, number];
    lastAccrueMs: number;
    nowMs: number;
  };
  internals.history = [
    { t: 0, p: [0, 0] },
    { t: 10_000, p: [5, 2] },
    { t: 20_000, p: [5, 5] },
  ];
  internals.pointTotals = [5, 5];
  internals.lastAccrueMs = 20_000;
  g.advanceTo(20_000);
  assert.deepEqual({ ...g.result!, leaderboard: [] }, { winner: 0, points: [5, 5], reason: 'tieBreak', leaderboard: [] });
});

test('match: withTune helper really overrides nested values', () => {
  assert.equal(withTune({ hq: { hp: 9 } }).hq.hp, 9);
  assert.equal(withTune({ hq: { hp: 9 } }).hq.slotsPerNode, 8);
});

// ------------------------------------------------- HQ garrison + vanity score

function allyHqScene() {
  const g = makeGame({
    nodes: [N0],
    tune: scenarioTune(),
    players: [
      player('a', 0, [{ power: 60 }, { power: 60 }]),
      player('c', 0, [{ power: 60 }, { power: 60 }]),
      player('b', 1, [{ power: 75 }, { power: 75 }]),
    ],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  return g;
}

test('hq garrison: an ally can garrison a friendly HQ with the same limits as a node', () => {
  const g = allyHqScene();
  must(g, { type: 'march', playerId: 'c', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
  // The same commander cannot queue a second squad behind the first.
  assert.equal(err(g, { type: 'march', playerId: 'c', squadId: 's3', target: { kind: 'hq', hqId: 'h0' } }), 'commanderAlreadyThere');
  const events = g.advanceTo(arrival(g, 's2'));
  assert.equal(events.filter((e) => e.type === 'hqGarrisoned').length, 1);
  const sq = g.squads.get('s2')!;
  assert.equal(sq.state.kind, 'hqGarrison');
  assert.deepEqual(g.players.get('a')!.hq.garrison, ['s2']);
  assert.equal(err(g, { type: 'march', playerId: 'c', squadId: 's3', target: { kind: 'hq', hqId: 'h0' } }), 'commanderAlreadyThere');
  assert.equal(err(g, { type: 'march', playerId: 'c', squadId: 's2', target: { kind: 'node', nodeId: 'n0' } }), 'notAtHq');
  assert.deepEqual(g.checkInvariants(), []);
  // Return to HQ works from an HQ garrison like from a node garrison.
  must(g, { type: 'cancel', playerId: 'c', squadId: 's2' });
  assert.equal(g.players.get('a')!.hq.garrison.length, 0);
  assert.equal(g.squads.get('s2')!.state.kind, 'march');
  assert.deepEqual(g.checkInvariants(), []);
});

test('hq garrison: guests defend the HQ, fight first when last in, and walk home defeated', () => {
  const g = allyHqScene();
  must(g, { type: 'march', playerId: 'c', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
  g.advanceTo(arrival(g, 's2'));
  must(g, { type: 'march', playerId: 'b', squadId: 's4', target: { kind: 'hq', hqId: 'h0' } });
  const events = g.advanceTo(arrival(g, 's4'));
  const combat = events.filter((e) => e.type === 'combat') as Extract<GameEvent, { type: 'combat' }>[];
  assert.equal(combat.length, 1);
  assert.equal(combat[0].log.fights[0].defender.squadId, 's2', 'the guest fought first (last in)');
  const guest = g.squads.get('s2')!;
  if (guest.troops <= 0) {
    assert.ok(guest.state.kind === 'march' && guest.state.march.purpose === 'home', 'a defeated guest walks home');
    assert.equal(g.players.get('a')!.hq.garrison.length, 0);
  }
  assert.deepEqual(g.checkInvariants(), []);
});

test('hq garrison: when the HQ teleports, guests walk home from where it was', () => {
  const g = makeGame({
    nodes: [N0, N1],
    tune: scenarioTune(),
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('c', 0, [{ power: 60 }]), player('b', 1, [{ power: 75 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n0' });
  must(g, { type: 'march', playerId: 'c', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
  g.advanceTo(arrival(g, 's2'));
  assert.equal(g.squads.get('s2')!.state.kind, 'hqGarrison');
  const old = { ...g.players.get('a')!.hq.pos };
  marchAndArrive(g, 'a', 's1', 'n1');
  g.advanceTo(g.now + 200_000); // wait out the teleport cooldown
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'n1' });
  const guest = g.squads.get('s2')!;
  assert.ok(guest.state.kind === 'march' && guest.state.march.purpose === 'home', 'the guest was sent home');
  assert.deepEqual(guest.state.kind === 'march' ? guest.state.march.from : null, old, 'from the old HQ spot');
  assert.equal(g.players.get('a')!.hq.garrison.length, 0);
  assert.deepEqual(g.checkInvariants(), []);
});

test('vanity score: troops defeated, nodes captured, garrison seconds and HQs downed', () => {
  const g = makeGame({
    nodes: [N0],
    tune: scenarioTune(),
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 75 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  const t0 = g.now;
  assert.equal(g.players.get('a')!.stats.nodesCaptured, 1);
  g.advanceTo(t0 + 10_000);
  assert.ok(Math.abs(g.players.get('a')!.stats.garrisonSeconds - 10) < 1e-6, 'garrison seconds accrue');
  marchAndArrive(g, 'b', 's1', 'n0');
  const a = g.players.get('a')!.stats;
  const b = g.players.get('b')!.stats;
  assert.ok(b.troopsDefeated > 0 && a.troopsDefeated > 0, 'both sides are credited with the troops they defeated');
  assert.equal(b.nodesCaptured, 1);
  const lb = g.leaderboard();
  assert.equal(lb.length, 2);
  const row = lb.find((r) => r.id === 'b')!;
  assert.equal(row.score, Math.round(b.troopsDefeated * 1 + 1000 + b.garrisonSeconds * 10));
  assert.ok(lb[0].score >= lb[1].score, 'best first');
});

test('vanity score: bringing an HQ to 0 HP pays 500 and the result carries the leaderboard', () => {
  const g = hqScene();
  for (let i = 0; i < 4; i++) {
    must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'hq', hqId: 'h0' } });
    g.advanceTo(arrival(g, 's2'));
    g.advanceTo(arrival(g, 's2'));
  }
  assert.equal(g.players.get('b')!.stats.hqsDowned, 1);
  g.advanceTo(g.tune.match.durationSeconds * 1000 + 1);
  assert.ok(g.result && g.result.leaderboard.length === 2);
});

// ------------------------------------------------------------ escalation

test('phases: tier 3 opens with 75% of the clock left and tier 4 with 50% left', () => {
  const T3: NodeDef = { id: 'T3', kind: 'points', x: 300, y: 300, tier: 3 };
  const T4: NodeDef = { id: 'T4', kind: 'points', x: 500, y: 300, tier: 4 };
  const g = makeGame({
    nodes: [N0, T3, T4],
    tune: withTune({ combat: { variance: 0 }, match: { durationSeconds: 1000 } }),
    players: [player('a', 0, [{ power: 60 }, { power: 60 }, { power: 60 }])],
  });
  assert.equal(err(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'T3' } }), 'nodeLocked');
  assert.equal(err(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'T4' } }), 'nodeLocked');
  assert.equal(err(g, { type: 'scout', playerId: 'a', scoutIndex: 0, target: { kind: 'node', nodeId: 'T3' } }), 'nodeLocked');
  const locked = viewFor(g, 0).nodes;
  assert.equal(locked.find((n) => n.id === 'T3')!.unlocksAtMs, 250_000);
  assert.equal(locked.find((n) => n.id === 'T4')!.unlocksAtMs, 500_000);
  assert.equal(locked.find((n) => n.id === 'n0')!.unlocksAtMs, undefined, 'tier 1 is open from the start');
  marchAndArrive(g, 'a', 's0', 'n0');

  const events = g.advanceTo(250_000);
  assert.ok(events.some((e) => e.type === 'nodesUnlocked' && e.tier === 3));
  must(g, { type: 'march', playerId: 'a', squadId: 's1', target: { kind: 'node', nodeId: 'T3' } });
  assert.equal(err(g, { type: 'march', playerId: 'a', squadId: 's2', target: { kind: 'node', nodeId: 'T4' } }), 'nodeLocked');
  assert.equal(viewFor(g, 0).nodes.find((n) => n.id === 'T3')!.unlocksAtMs, undefined);

  const later = g.advanceTo(500_000);
  assert.ok(later.some((e) => e.type === 'nodesUnlocked' && e.tier === 4));
  must(g, { type: 'march', playerId: 'a', squadId: 's2', target: { kind: 'node', nodeId: 'T4' } });
});

// ------------------------------------------------------------ score pools

const PN0: NodeDef = { id: 'n0', kind: 'points', x: 300, y: 300 };
const PN1: NodeDef = { id: 'n1', kind: 'points', x: 400, y: 300 };

function poolScene() {
  const g = makeGame({
    nodes: [PN0, PN1],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }, { power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  return g;
}

test('pool: points earned in the first minute are permanent, the pool opens after settleSeconds', () => {
  const g = poolScene();
  const n0 = g.nodes.get('n0')!;
  const t0 = g.now;
  assert.equal(n0.poolOpen, false);
  g.advanceTo(t0 + 59_000);
  assert.equal(n0.poolOpen, false);
  assert.equal(n0.pool, 0);
  const events = g.advanceTo(t0 + 60_000);
  assert.ok(events.some((e) => e.type === 'poolOpened'));
  assert.equal(n0.poolOpen, true);
  g.advanceTo(t0 + 70_000);
  // Tier 1 earns 10 a second; only that part feeds the pool, not the garrison bonus.
  assert.ok(Math.abs(n0.pool - 100) < 1e-6, `pool ${n0.pool}`);
  assert.equal(n0.caches.length, 0, 'no caches until the first batch of 500 has been earned');
});

test('pool: caches appear every 500 earned, four first then one more up to eight, each fixed at pool / caches', () => {
  const T4: NodeDef = { id: 'T4', kind: 'points', x: 300, y: 300, tier: 4 };
  const g = makeGame({ nodes: [T4], players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])] });
  marchAndArrive(g, 'a', 's0', 'T4');
  const node = g.nodes.get('T4')!;
  const open = g.now + 60_000;
  g.advanceTo(open + 6_000); // 480 earned at 80 a second: nothing yet
  assert.equal(node.caches.length, 0);
  g.advanceTo(open + 6_300); // 504 earned: the first four appear, worth 500 / 4 each
  assert.equal(node.caches.length, 4, 'a minimum of four');
  for (const c of node.caches) {
    const d = dist(c.pos, node.pos);
    assert.ok(d >= 1.8 * 40 - 1e-6 && d <= 4.6 * 40 + 1e-6, `cache ${d} units away`);
    assert.ok(Math.abs(c.value - 125) < 1e-6, `each holds 125, not ${c.value}`);
  }
  // Nothing about a cache changes while the pool keeps growing.
  const before = node.caches.map((c) => c.value);
  g.advanceTo(open + 6_300 + 4_000);
  assert.deepEqual(node.caches.map((c) => c.value), before);
  // The second step: one more cache, worth the pool then (1000) over five caches; the old ones keep their value.
  g.advanceTo(open + 12_600);
  assert.equal(node.caches.length, 5);
  assert.ok(Math.abs(node.caches[4].value - 200) < 1e-6, `new cache ${node.caches[4].value}`);
  assert.ok(node.caches.slice(0, 4).every((c) => Math.abs(c.value - 125) < 1e-6), 'older caches never change');
  g.advanceTo(open + 100_000);
  assert.equal(node.caches.length, 8, 'never more than eight');
});

test('pool: losing the node takes the pool away from the holder and starts a fresh minute for the new owner', () => {
  const g = poolScene();
  const n0 = g.nodes.get('n0')!;
  g.advanceTo(g.now + 90_000);
  g.squads.get('s0')!.troops = 100; // a weak garrison
  must(g, { type: 'march', playerId: 'b', squadId: 's2', target: { kind: 'node', nodeId: 'n0' } });
  const hit = arrival(g, 's2');
  g.advanceTo(hit - 1);
  const before = g.points()[0];
  const pool = n0.pool;
  assert.ok(pool > 200);
  g.advanceTo(hit);
  assert.equal(n0.owner, 1);
  assert.ok(Math.abs(before - g.points()[0] - pool) < 1, `holder lost exactly the pool (${before} to ${g.points()[0]}, pool ${pool})`);
  assert.equal(n0.pool, 0);
  assert.equal(n0.caches.length, 0);
  assert.equal(n0.poolOpen, false);
  g.advanceTo(hit + 59_000);
  assert.equal(n0.poolOpen, false, 'the new owner waits a full minute');
  g.advanceTo(hit + 60_000);
  assert.equal(n0.poolOpen, true);
});

test('pool: an enemy scout steals a cache, the holder own scout only secures it', () => {
  const g = poolScene();
  marchAndArrive(g, 'b', 's2', 'n1'); // b holds n1 next door, and sees the caches around n0
  g.advanceTo(g.now + 90_000);
  const n0 = g.nodes.get('n0')!;

  // The holder's own scout: the share leaves the pool, the holder total is unchanged by it.
  const mine = n0.caches[0];
  must(g, { type: 'scout', playerId: 'a', scoutIndex: 0, target: { kind: 'cache', cacheId: mine.id } });
  const sa = g.players.get('a')!.scouts[0];
  const aArrive = sa.kind === 'out' ? sa.arriveMs : g.now;
  g.advanceTo(aArrive - 1);
  const poolA = n0.pool;
  const valueA = mine.value;
  const totalA = g.points()[0];
  g.advanceTo(aArrive);
  assert.equal(n0.caches.find((c) => c.id === mine.id), undefined, 'collected');
  assert.ok(Math.abs(poolA - n0.pool - valueA) < 1, 'the share left the pool');
  assert.ok(Math.abs(g.points()[0] - totalA) < 1, 'securing your own cache does not change your total');

  // An enemy scout: the share leaves the holder and lands with the thief.
  const visible = viewFor(g, 1).caches;
  assert.ok(visible.length > 0, 'the neighbour sees them');
  must(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'cache', cacheId: visible[0].id } });
  const sb = g.players.get('b')!.scouts[0];
  const bArrive = sb.kind === 'out' ? sb.arriveMs : g.now;
  g.advanceTo(bArrive - 1);
  const taken = n0.caches.find((c) => c.id === visible[0].id)!;
  const value = taken.value;
  const [a0, b0] = g.points();
  const events = g.advanceTo(bArrive);
  const got = events.find((e) => e.type === 'cacheCollected');
  assert.ok(got && got.type === 'cacheCollected' && got.team === 1 && Math.abs(got.amount - value) < 1);
  const [a1, b1] = g.points();
  assert.ok(Math.abs(b1 - b0 - value) < 1, 'the thief banked it');
  assert.ok(Math.abs(a0 - a1 - value) < 1, 'the holder lost it');
  assert.deepEqual(g.checkInvariants(), []);
});

test('pool: caches are only known inside your vision, and a gone cache is unknown', () => {
  const g = poolScene();
  g.advanceTo(g.now + 150_000);
  const n0 = g.nodes.get('n0')!;
  assert.equal(viewFor(g, 1).caches.length, 0, 'b has no vision there');
  assert.equal(err(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'cache', cacheId: n0.caches[0].id } }), 'notVisible');
  assert.equal(err(g, { type: 'scout', playerId: 'a', scoutIndex: 0, target: { kind: 'cache', cacheId: 'nope' } }), 'unknownCache');
  assert.ok(viewFor(g, 0).caches.length >= 1, 'the holder sees its own caches');
  const own = viewFor(g, 0).nodes.find((n) => n.id === 'n0')!;
  assert.ok(own.poolOpen && (own.pool ?? 0) > 0);
});

test('fog: an enemy scout is listed only while it is inside your vision, with its commander name', () => {
  const g = poolScene();
  must(g, { type: 'scout', playerId: 'b', scoutIndex: 0, target: { kind: 'node', nodeId: 'n0' } });
  const sc = g.players.get('b')!.scouts[0];
  assert.ok(sc.kind === 'out');
  const { startMs, arriveMs } = sc.kind === 'out' ? sc : { startMs: 0, arriveMs: 0 };
  g.advanceTo(startMs + 1_000);
  assert.equal(viewFor(g, 0).enemyScouts.length, 0, 'still far outside a vision radius');
  g.advanceTo(arriveMs - 500);
  const seen = viewFor(g, 0).enemyScouts;
  assert.equal(seen.length, 1, 'inside the holder vision just before it lands');
  assert.equal(seen[0].owner, 'b');
  assert.equal(viewFor(g, 1).enemyScouts.length, 0, 'b sees its own scout in scouts, not as an enemy');
});

// ----------------------------------------------------------------- portal nexus

test('portal: both teams may teleport onto it, it cannot be captured, and it lights its 8 cells for both', () => {
  const P: NodeDef = { id: 'P', kind: 'portal', x: 300, y: 300 };
  const g = makeGame({ nodes: [P, N1], players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])] });
  assert.equal(err(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'P' } }), 'notCapturable');
  assert.equal(err(g, { type: 'scout', playerId: 'a', scoutIndex: 0, target: { kind: 'node', nodeId: 'P' } }), 'notCapturable');

  // Neither team holds it, yet both can teleport there, into different slots.
  must(g, { type: 'teleport', playerId: 'a', nodeId: 'P' });
  must(g, { type: 'teleport', playerId: 'b', nodeId: 'P' });
  const slots = g.nodes.get('P')!.slots.filter((s) => s !== null);
  assert.equal(slots.length, 2);
  assert.equal(g.nodes.get('P')!.owner, null, 'still neutral');

  // Everyone sees the cells right around it (and so the HQs that landed), nothing further out.
  assert.ok(g.isVisibleTo(0, { x: 340, y: 340 }) && g.isVisibleTo(1, { x: 340, y: 340 }), 'the 8 cells around it are visible to both');
  assert.ok(!g.isVisibleTo(0, { x: 300 + 40 * 4, y: 300 }) && !g.isVisibleTo(1, { x: 300 + 40 * 4, y: 300 }), 'but not further out');
  assert.equal(viewFor(g, 0).enemyHqs.length, 1, 'a sees b HQ at the portal');
  assert.equal(viewFor(g, 1).enemyHqs.length, 1, 'b sees a HQ at the portal');
  assert.deepEqual(g.checkInvariants(), []);
});
