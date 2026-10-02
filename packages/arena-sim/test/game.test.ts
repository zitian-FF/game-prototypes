import assert from 'node:assert/strict';
import { dist } from '../src/map';
import type { GameEvent } from '../src/types';
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

test('nodes: march time is distance over base speed (3 min across the map)', () => {
  const g = makeGame({ nodes: [N0], players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])] });
  const from = g.squadPos(g.squads.get('s0')!);
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n0' } });
  const expected = (dist(from, { x: 300, y: 300 }) / g.marchSpeed) * 1000;
  assert.ok(Math.abs(arrival(g, 's0') - expected) < 1e-6);
  assert.ok(Math.abs(Math.hypot(1000, 600) / g.marchSpeed - 180) < 1e-9);
});

test('nodes: an ungarrisoned node keeps its owner until an enemy touches it', () => {
  const g = makeGame({
    nodes: [N0, N1],
    players: [player('a', 0, [{ power: 60 }, { power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'n0');
  must(g, { type: 'march', playerId: 'a', squadId: 's0', target: { kind: 'node', nodeId: 'n1' } });
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

test('turret: pulses a fixed % off enemy garrisons nearby, ignores far ones', () => {
  const T: NodeDef = { id: 'T', kind: 'turret', x: 500, y: 300 };
  const near: NodeDef = { id: 'near', kind: 'points', x: 600, y: 300 };
  const far: NodeDef = { id: 'far', kind: 'points', x: 900, y: 100 };
  const g = makeGame({
    nodes: [T, near, far],
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }, { power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'T');
  marchAndArrive(g, 'b', 's1', 'near');
  marchAndArrive(g, 'b', 's2', 'far');
  // Pulses already fired while the later squads were still marching, so
  // measure from the state right before the next one.
  const s1 = g.squads.get('s1')!;
  const before = s1.troops;
  const events: GameEvent[] = [];
  const nextPulse = (Math.floor(g.now / 30_000) + 1) * 30_000;
  events.push(...g.advanceTo(nextPulse));
  const pulse = ofType(events, 'turretPulse')[0];
  assert.equal(pulse.nodeId, 'T');
  const damage = Math.ceil(before * 0.05);
  assert.deepEqual(pulse.hits, [{ squadId: 's1', damage }]);
  assert.equal(s1.troops, before - damage);
  assert.equal(g.squads.get('s2')!.troops, 3000, 'out of range');
  assert.equal(g.squads.get('s0')!.troops, 3000, 'own team untouched');
  g.advanceTo(nextPulse + 30_000);
  assert.equal(s1.troops, before - damage - Math.ceil((before - damage) * 0.05), 'percent of current troops');
});

test('turret: a garrison worn to 0 is defeated and walks home', () => {
  const T: NodeDef = { id: 'T', kind: 'turret', x: 500, y: 300 };
  const near: NodeDef = { id: 'near', kind: 'points', x: 600, y: 300 };
  const g = makeGame({
    nodes: [T, near],
    tune: scenarioTune({ turret: { damageFraction: 1 } }),
    players: [player('a', 0, [{ power: 60 }]), player('b', 1, [{ power: 60 }])],
  });
  marchAndArrive(g, 'a', 's0', 'T');
  marchAndArrive(g, 'b', 's1', 'near');
  g.advanceTo(Math.ceil(g.now / 30_000) * 30_000);
  const sq = g.squads.get('s1')!;
  assert.equal(sq.troops, 0);
  assert.ok(sq.state.kind === 'march' && Math.abs(sq.state.march.speed - g.marchSpeed * 0.5) < 1e-9);
  assert.equal(g.nodes.get('near')!.garrison.length, 0);
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
  assert.deepEqual(g.result, { winner: 'draw', points: [0, 0], reason: 'draw' });
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
  assert.deepEqual(g.result, { winner: 0, points: [5, 5], reason: 'tieBreak' });
});

test('match: withTune helper really overrides nested values', () => {
  assert.equal(withTune({ hq: { hp: 9 } }).hq.hp, 9);
  assert.equal(withTune({ hq: { hp: 9 } }).hq.slotsPerNode, 8);
});
