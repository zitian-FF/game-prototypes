import { strict as assert } from 'node:assert';
import { test } from './harness';
import { FakeEnv, flush, makeWorld, restoreFrom } from './helpers';
import type { ArenaRoom } from '../src/index';

// Start a match with one human (Hana, on a phone) and 39 bots; returns the world and her client.
function start(waitMs = 0) {
  const w = makeWorld();
  const hana = w.client('Hana', 'client-hana-gamelog-0001');
  hana.hello(true, 'touch');
  hana.send({ t: 'start', fillBots: true, minutes: 10 });
  w.advance(3100 + waitMs);
  hana.pull();
  return { w, hana };
}

function firstTargets(hana: ReturnType<typeof start>['hana']) {
  const v = hana.view!;
  const info = hana.msgs.find((m) => m.t === 'matchStart');
  assert.ok(info && info.t === 'matchStart');
  const me = info.info.playerId;
  const squads = v.squads.filter((s) => s.owner === me && s.state === 'hq');
  const neutral = v.nodes.find((n) => n.owner == null && n.kind !== 'portal' && n.unlocksAtMs === undefined);
  const portal = v.nodes.find((n) => n.kind === 'portal');
  const enemy = v.nodes.find((n) => n.owner !== null && n.owner !== undefined && n.owner !== info.info.team && n.unlocksAtMs === undefined);
  const neutral2 = v.nodes.find((n) => n.owner == null && n.kind !== 'portal' && n.unlocksAtMs === undefined && n.id !== neutral?.id);
  assert.ok(squads.length >= 2, `squads ${squads.length}`);
  assert.ok(neutral, 'neutral node');
  assert.ok(portal, 'portal');
  return { squads, neutral, neutral2, portal, enemy };
}

test('game log: one record per human with the ordered targets, counts, pace, device and a hashed id', () => {
  const { w, hana } = start();
  // Wait until the bots hold some nodes (an enemy node to attack) while others are still neutral.
  for (let i = 0; i < 40; i++) {
    const info = hana.msgs.find((m) => m.t === 'matchStart');
    const team = info && info.t === 'matchStart' ? info.info.team : 0;
    const v = hana.view!;
    if (v.nodes.some((n) => n.owner != null && n.owner !== team && n.unlocksAtMs === undefined) && v.nodes.some((n) => n.owner == null && n.kind !== 'portal' && n.unlocksAtMs === undefined)) break;
    w.advance(10_000);
    hana.pull();
  }
  const t = firstTargets(hana);
  assert.ok(t.enemy, 'an enemy-held node');
  hana.cmd({ type: 'march', squadId: t.squads[0].id, target: { kind: 'node', nodeId: t.neutral.id } });
  w.advance(5000);
  hana.cmd({ type: 'scout', scoutIndex: 0, target: { kind: 'node', nodeId: t.enemy!.id } });
  w.advance(5000);
  hana.cmd({ type: 'march', squadId: t.squads[1].id, target: { kind: 'node', nodeId: t.enemy!.id } });
  hana.cmd({ type: 'setDefend', squadId: t.squads[1].id, defend: false });
  hana.cmd({ type: 'march', squadId: 'nope', target: { kind: 'node', nodeId: 'nowhere' } });
  w.runTo(w.env.wall + 10 * 60_000 + 5000);
  assert.equal(w.room.currentPhase, 'ended');
  assert.equal(w.env.gameLogs.length, 1, 'bots are not logged, and the match is logged once');
  const r = w.env.gameLogs[0];
  assert.equal(r.name, 'Hana');
  assert.equal(r.device, 'touch');
  assert.equal(r.humans, 1);
  assert.equal(r.bots, 39);
  assert.equal(r.pid.length, 14);
  assert.ok(!JSON.stringify(r).includes('client-hana'), 'the raw client id never appears');
  assert.equal(r.counts.captureNeutral, 1);
  assert.equal(r.counts.scoutNode, 1);
  assert.equal(r.counts.attackNode, 1);
  assert.equal(r.counts.defendToggles, 1);
  assert.ok(r.counts.rejected >= 1);
  assert.deepEqual(r.targets.map((x) => x.a), ['capture', 'scoutNode', 'attack']);
  assert.equal(r.targets[0].id, t.neutral.id);
  assert.equal(typeof r.targets[0].k, 'string');
  assert.ok(typeof r.targets[0].tier === 'number');
  assert.ok(r.firstOrderS !== null && r.firstOrderS >= 0);
  assert.equal(r.ordersByTenth.length, 10);
  assert.equal(r.ordersByTenth.reduce((a, b) => a + b, 0), 4, 'four accepted orders');
  assert.ok(['win', 'loss', 'draw'].includes(r.result));
  assert.equal(r.simSeconds, 600);
  assert.ok(r.score.rank !== null && r.score.rank >= 1);
  assert.ok(JSON.stringify(r).length < 4000, 'a record stays small');
});

test('game log: counters survive the room being evicted and rebuilt', () => {
  const { w, hana } = start();
  const t = firstTargets(hana);
  hana.cmd({ type: 'march', squadId: t.squads[0].id, target: { kind: 'node', nodeId: t.neutral.id } });
  w.advance(70_000); // more than the minute between saves
  hana.cmd({ type: 'scout', scoutIndex: 0, target: { kind: 'node', nodeId: t.neutral2!.id } });
  flush(w.room, w.store);
  const env2 = new FakeEnv();
  env2.wall = w.env.wall;
  const revived: ArenaRoom = restoreFrom(w.store, env2, {}, undefined);
  revived.onConnect('c-new');
  revived.onMessage('c-new', JSON.stringify({ t: 'hello', v: 8, clientId: 'client-hana-gamelog-0001', name: 'Hana', device: 'touch' }));
  // Run the rebuilt room to the end of the match.
  for (let guard = 0; guard < 100000; guard++) {
    const wake = revived.nextWakeAt();
    if (wake === null || revived.currentPhase === 'ended') break;
    env2.wall = Math.max(env2.wall, wake);
    revived.onAlarm();
  }
  assert.equal(env2.gameLogs.length, 1);
  assert.equal(env2.gameLogs[0].counts.captureNeutral, 1);
  assert.equal(env2.gameLogs[0].counts.scoutNode, 1);
  assert.ok(env2.gameLogs[0].joins >= 1);
});

test('game log: a match the host ends early is still logged, as abandoned', () => {
  const { w, hana } = start();
  const t = firstTargets(hana);
  hana.cmd({ type: 'march', squadId: t.squads[0].id, target: { kind: 'node', nodeId: t.neutral.id } });
  w.advance(20_000);
  hana.send({ t: 'endRoom' });
  assert.equal(w.env.gameLogs.length, 1);
  assert.equal(w.env.gameLogs[0].result, 'abandoned');
  assert.equal(w.env.gameLogs[0].counts.captureNeutral, 1);
});

test('opening reveal: the match clock starts only after the intro, and orders wait for it', () => {
  const w = makeWorld({ introSeconds: 7 });
  const hana = w.client('Hana', 'client-hana-intro-00001');
  hana.hello(true);
  hana.send({ t: 'start', fillBots: true, minutes: 10 });
  w.advance(3100); // the start countdown ends: the reveal begins
  hana.pull();
  const info = hana.msgs.find((m) => m.t === 'matchStart');
  assert.ok(info && info.t === 'matchStart');
  assert.ok(info.info.startedAtServerMs > w.env.wall + 6000, 'the match clock is set about 7 seconds ahead');
  assert.equal(info.info.tune.match.introSeconds, 7);
  w.advance(5000);
  assert.equal(w.room.sim!.now, 0, 'no sim time passes during the reveal');
  const v = hana.view!;
  const squad = v.squads.find((s) => s.owner === info.info.playerId)!;
  const node = v.nodes.find((n) => n.owner == null && n.kind !== 'portal' && n.unlocksAtMs === undefined)!;
  const before = hana.cmd({ type: 'march', squadId: squad.id, target: { kind: 'node', nodeId: node.id } });
  const refused = hana.msgs.find((m) => m.t === 'cmdResult' && m.id === before);
  assert.ok(refused && refused.t === 'cmdResult' && !refused.ok, 'an order during the reveal is refused');
  w.advance(4000); // 9 seconds after the countdown: the round has been running for about 2
  assert.ok(w.room.sim!.now > 1500 && w.room.sim!.now < 3000, `sim ${w.room.sim!.now}`);
  const after = hana.cmd({ type: 'march', squadId: squad.id, target: { kind: 'node', nodeId: node.id } });
  const accepted = hana.msgs.find((m) => m.t === 'cmdResult' && m.id === after);
  assert.ok(accepted && accepted.t === 'cmdResult' && accepted.ok, 'and accepted once the round has started');
});
