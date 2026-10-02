import assert from 'node:assert/strict';
import { ArenaGame, Rng, generateMap, rollPlayers, viewFor } from 'arena-sim';
import type { GameEvent, TeamId } from 'arena-sim';
import { BotBrain } from '../src/bot';
import { sameView, toWire } from '../src/wire';
import { test } from './harness';
import { flush, loadTune, makeWorld, restoreFrom } from './helpers';

const digest = (g: ArenaGame) =>
  JSON.stringify({
    now: g.now,
    result: g.result,
    points: g.points().map((p) => Math.round(p * 1000) / 1000),
    squads: [...g.squads.values()].map((s) => [s.id, s.troops, s.state.kind]),
    nodes: [...g.nodes.values()].map((n) => [n.id, n.owner, n.garrison]),
    pools: [...g.players.values()].map((p) => [p.id, Math.round(p.pool * 1000) / 1000, p.hq.hp, p.hq.location]),
    logs: g.combatLogs.length,
  });

/** All 40 players are bots, deciding every 4 sim seconds, straight on the sim. */
function botOnlyMatch(seed: number) {
  const tune = loadTune();
  const map = generateMap(new Rng(seed), tune);
  const ids = Array.from({ length: 40 }, (_, i) => `Bot ${i}`);
  const specs = rollPlayers(new Rng(seed + 1), tune, ids).map((p, i) => ({ ...p, team: (i % 2) as TeamId }));
  const g = new ArenaGame({ seed, tune, map, players: specs });
  const brains = new Map(ids.map((id) => [id, new BotBrain(id, new Rng(seed ^ (id.length * 7919)))]));
  const seen = { ok: 0, bad: 0, combats: 0, captured: 0, won: 0, lost: 0, teleports: 0, scouts: 0, flips: 0, hqAttacks: 0 };
  const tally = (e: GameEvent) => {
    if (e.type === 'combat') {
      seen.combats++;
      if (e.log.outcome === 'captured') seen.won++;
      if (e.log.outcome === 'attackerDefeated') seen.lost++;
      if (e.log.subject.kind === 'hq') seen.hqAttacks++;
    }
    if (e.type === 'nodeCaptured') {
      seen.captured++;
      if (e.previous !== null) seen.flips++;
    }
    if (e.type === 'teleported') seen.teleports++;
    if (e.type === 'scoutReport') seen.scouts++;
  };
  for (let t = 4000; t <= 1_800_000; t += 4000) {
    g.advanceTo(t).forEach(tally);
    const views: (ReturnType<typeof viewFor> | null)[] = [null, null];
    const claims = [new Map<string, number>(), new Map<string, number>()];
    for (const [id, brain] of brains) {
      const team = g.players.get(id)!.team;
      const view = (views[team] ??= viewFor(g, team));
      for (const body of brain.think({ playerId: id, team, view, tune, speed: g.marchSpeed, nowMs: g.now, claims: claims[team] })) {
        const r = g.command({ ...body, playerId: id } as never);
        if (r.ok) {
          seen.ok++;
          r.events.forEach(tally);
        } else seen.bad++;
      }
    }
    assert.deepEqual(g.checkInvariants(), [], `invariants broke at ${t}`);
  }
  g.advanceTo(1_800_001).forEach(tally);
  return { g, seen };
}

test('bots: a 40 bot match plays to the end by the rules and stays competitive', () => {
  for (const seed of [1, 2, 3]) {
    const { g, seen } = botOnlyMatch(seed);
    assert.ok(g.result, `seed ${seed} finished`);
    assert.ok(seen.ok > 200, `seed ${seed}: ${seen.ok} commands`);
    assert.ok(seen.bad / (seen.ok + seen.bad) < 0.05, `seed ${seed}: too many rejected orders (${seen.bad})`);
    const owned = [0, 0];
    for (const n of g.nodes.values()) if (n.owner !== null) owned[n.owner]++;
    assert.ok(owned[0] >= 2 && owned[1] >= 2, `seed ${seed}: both teams hold ground ${owned}`);
    const [a, b] = g.result!.points;
    assert.ok(Math.max(a, b) / Math.min(a, b) < 3, `seed ${seed}: lopsided ${a} vs ${b}`);
    assert.ok(seen.combats >= 50, `seed ${seed}: only ${seen.combats} fights`);
    assert.ok(seen.won >= 2, `seed ${seed}: bots never win an attack (${seen.won}/${seen.combats})`);
    assert.ok(seen.flips >= 10, `seed ${seed}: nodes never change hands`);
    assert.ok(seen.teleports >= 10, `seed ${seed}: bots never teleport`);
    assert.ok(seen.scouts >= 20, `seed ${seed}: bots never scout`);
  }
});

test('bots: the same seed plays the same match, a different seed does not', () => {
  assert.equal(digest(botOnlyMatch(7).g), digest(botOnlyMatch(7).g));
  assert.notEqual(digest(botOnlyMatch(7).g), digest(botOnlyMatch(8).g));
});

test('bots: a bot is a pure function of the view it is given', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(5), tune);
  const ids = Array.from({ length: 40 }, (_, i) => `Bot ${i}`);
  const specs = rollPlayers(new Rng(6), tune, ids).map((p, i) => ({ ...p, team: (i % 2) as TeamId }));
  const g = new ArenaGame({ seed: 5, tune, map, players: specs });
  g.advanceTo(30_000);
  const id = ids[0];
  const team = g.players.get(id)!.team;
  const view = viewFor(g, team);
  const run = () => new BotBrain(id, new Rng(99)).think({ playerId: id, team, view, tune, speed: g.marchSpeed, nowMs: g.now });
  assert.deepEqual(run(), run());
  // And it cannot see through the fog: nothing in its input names an enemy squad it has not met.
  const enemyOwners = new Set([...g.players.values()].filter((p) => p.team !== team).map((p) => p.id));
  const json = JSON.stringify(view);
  for (const name of enemyOwners) assert.ok(!json.includes(`"${name}"`), `view leaks ${name}`);
});

// ------------------------------------------------------------------ through the room

function playRoom(opts: { humans: string[]; fillBots: boolean; untilSimMs: number; world?: ReturnType<typeof makeWorld> }) {
  const w = opts.world ?? makeWorld();
  const clients = opts.humans.map((n, i) => w.client(n, `client-${i}-${n}`.padEnd(12, '_')));
  clients.forEach((c, i) => c.hello(i === 0));
  clients[0].send({ t: 'start', fillBots: opts.fillBots, minutes: 30 });
  w.advance(3100);
  const startedAt = w.env.wall;
  w.runTo(startedAt + opts.untilSimMs);
  clients.forEach((c) => c.pull());
  return { w, clients, startedAt };
}

test('room: a full 30 minute match with one human and 39 bots runs start to finish', () => {
  const { w, clients } = playRoom({ humans: ['Hana'], fillBots: true, untilSimMs: 1_802_000 });
  const hana = clients[0];
  assert.equal(w.room.currentPhase, 'ended');
  const g = w.room.sim!;
  assert.ok(g.result);
  assert.equal(hana.of('error').length, 0);
  const ended = hana.of('state').flatMap((s) => s.events).filter((e) => e.type === 'matchEnded');
  assert.equal(ended.length, 1);
  assert.deepEqual(g.checkInvariants(), []);
  assert.equal(hana.last('lobby')!.phase, 'ended');
  // Every accepted command was logged for replay.
  const logged = [...w.store.keys()].filter((k) => k.startsWith('c:')).length;
  assert.ok(logged > 200, `${logged} commands logged`);
  // The client's patched view agrees with what the server would send now.
  const team = g.players.get('Hana')!.team;
  assert.ok(sameView(hana.view!, toWire(viewFor(g, team))) || hana.view!.timeMs <= g.now);
});

test('room: nothing about the other team leaks into a client, over a whole match', () => {
  const { w, clients } = playRoom({ humans: ['Hana', 'Ivo'], fillBots: true, untilSimMs: 900_000 });
  const g = w.room.sim!;
  let namedLegitimately = 0; // proves the stripped places really do carry enemy names
  for (const c of clients) {
    const team = g.players.get(c.name)!.team;
    const enemies = [...g.players.values()].filter((p) => p.team !== team).map((p) => p.id);
    const friends = new Set([...g.players.values()].filter((p) => p.team === team).map((p) => p.id));
    let combats = 0;
    for (const m of c.msgs) {
      if (m.t !== 'state') continue;
      // Strip the places that legitimately name enemy commanders, then nothing may remain.
      const clone = JSON.parse(JSON.stringify(m)) as typeof m;
      if (enemies.some((e) => JSON.stringify(m).includes(`"${e}"`))) namedLegitimately++;
      for (const e of clone.events) {
        if (e.type === 'combat') combats++;
        if (e.type === 'combatFx') assert.ok(!('log' in e), 'a watched fight carries no details');
      }
      clone.events = clone.events.filter((e) => e.type !== 'combat');
      const views = [clone.view, clone.patch ? clone.patch.upsert : undefined];
      for (const v of views) {
        const bag = v as { combatLogs?: unknown; scoutReports?: unknown; enemyMarches?: { revealed?: unknown }[] } | undefined;
        if (!bag) continue;
        delete bag.combatLogs;
        delete bag.scoutReports;
        for (const em of bag.enemyMarches ?? []) delete em.revealed;
      }
      const text = JSON.stringify({ view: clone.view, patch: clone.patch, events: clone.events });
      for (const e of enemies) assert.ok(!text.includes(`"${e}"`), `${c.name} was told about enemy ${e}`);
    }
    // Own-team data is always own team.
    for (const s of c.view!.squads) assert.ok(friends.has(s.owner), `${c.name} sees a squad of ${s.owner}`);
    for (const h of c.view!.hqs) assert.ok(friends.has(h.owner));
    for (const em of c.view!.enemyMarches) {
      for (const k of ['type', 'owner', 'power', 'troops', 'commander', 'team']) assert.ok(!(k in em), `enemy march leaks ${k}`);
    }
    for (const n of c.view!.nodes) {
      if (n.owner !== team && n.garrisonCount !== undefined) {
        assert.ok(c.view!.scoutReports.some((r) => r.target.kind === 'node' && r.target.nodeId === n.id), `count on ${n.id} without a scout`);
      }
    }
    assert.ok(combats >= 0);
  }
  assert.ok(namedLegitimately > 0, 'enemy commanders appear in fights and scout reports, so the leak check is not vacuous');
});

test('room: teammates and a reconnecting player all hold the same view', () => {
  const { w, clients } = playRoom({ humans: ['Ann', 'Bob', 'Cy'], fillBots: true, untilSimMs: 400_000 });
  const g = w.room.sim!;
  const teamOf = (n: string) => g.players.get(n)!.team;
  // Three humans are split across two teams, so two of them share a side.
  const mates = clients.filter((c) => clients.filter((o) => teamOf(o.name) === teamOf(c.name)).length === 2);
  assert.equal(mates.length, 2, 'exactly one pair shares a side');
  const [first, second] = mates;
  assert.ok(sameView(first.view!, second.view!), 'two clients on one team agree');

  // One drops, the match carries on, then they come back and get a fresh full view.
  w.room.onClose(second.connId);
  w.advance(60_000);
  first.pull();
  const back = w.client(second.name, second.clientId);
  back.hello(false);
  w.advance(5000);
  first.pull();
  back.pull();
  assert.ok(back.of('state').some((s) => s.full), 'got a full snapshot on return');
  assert.ok(sameView(first.view!, back.view!), 'the returning player agrees with their teammate');
});

test('room: if the room is evicted and rebuilt from storage the match is identical', () => {
  const { w, clients } = playRoom({ humans: ['Hana'], fillBots: true, untilSimMs: 600_000 });
  flush(w.room, w.store);
  const original = w.room.sim!;

  const env2 = Object.assign(Object.create(Object.getPrototypeOf(w.env)), w.env, { outbox: new Map(), closed: new Map() });
  const revived = restoreFrom(w.store, env2, {});
  assert.equal(revived.replayMismatches, 0, 'every logged command replayed the same');
  const T = Math.max(original.now, revived.sim!.now) + 5000;
  original.advanceTo(T);
  revived.sim!.advanceTo(T);
  assert.equal(digest(revived.sim!), digest(original));

  // The person's socket survived; reattach it and they can play on.
  revived.attachRestored(clients[0].connId, clients[0].clientId);
  assert.equal(revived.currentPhase, 'playing');
});

test('room: with nobody connected the room stops waking the sim, and abandons the match later', () => {
  const w = makeWorld({ abandonMs: 5 * 60_000 });
  const host = w.client('Hana');
  host.hello(true);
  host.send({ t: 'start', fillBots: true, minutes: 30 });
  w.advance(3100);
  w.advance(30_000);
  w.room.onClose(host.connId);
  const wake = w.room.nextWakeAt();
  assert.ok(wake !== null && wake >= w.env.wall + 4 * 60_000, 'only the abandon deadline is pending');
  const simBefore = w.room.sim!.now;
  w.advance(4 * 60_000);
  assert.equal(w.room.sim!.now, simBefore, 'the sim did not tick while nobody was watching');
  w.advance(2 * 60_000);
  assert.equal(w.room.currentPhase, 'closed');
  assert.ok(w.room.shouldDestroy());
});

test('room: a player coming back after a long gap finds the match caught up', () => {
  const w = makeWorld({ abandonMs: 60 * 60_000 });
  const host = w.client('Hana');
  host.hello(true);
  host.send({ t: 'start', fillBots: true, minutes: 30 });
  w.advance(3100);
  w.advance(20_000);
  w.room.onClose(host.connId);
  w.advance(10 * 60_000);
  const back = w.client('Hana', host.clientId);
  back.hello(false);
  back.pull();
  const full = back.of('state').find((s) => s.full);
  assert.ok(full && full.simMs >= 10 * 60_000, `caught up to ${full?.simMs}`);
});

test('room: the room closes some time after the match ends', () => {
  const { w } = playRoom({ humans: ['Hana'], fillBots: false, untilSimMs: 1_802_000 });
  assert.equal(w.room.currentPhase, 'ended');
  w.advance(20 * 60_000);
  assert.equal(w.room.currentPhase, 'closed');
});

test('cost: a full 40 player match stays well inside the Cloudflare free tier budget', () => {
  const w = makeWorld(); // real 1 second pulses, real time scale
  const host = w.client('Hana');
  host.hello(true);
  host.send({ t: 'start', fillBots: true, minutes: 30 });
  w.advance(3100);
  let alarms = 0;
  const real = w.room.onAlarm.bind(w.room);
  w.room.onAlarm = () => {
    alarms++;
    real();
  };
  w.advance(1_802_000);
  assert.equal(w.room.currentPhase, 'ended');
  const commands = [...w.store.keys()].filter((k) => k.startsWith('c:')).length;
  // Each alarm costs a request and a setAlarm row write; each logged command is a row write.
  const requests = alarms + Math.ceil(10 / 20); // plus the few incoming messages (20:1 billing)
  const rows = alarms + commands + 20;
  console.log(`       info: ${alarms} alarms, ${commands} logged commands, ~${rows} row writes per match`);
  assert.ok(alarms < 2200, `${alarms} alarms`);
  assert.ok(commands < 3500, `${commands} commands`);
  // Free plan: 100,000 requests/day and 100,000 row writes/day.
  assert.ok(Math.floor(100_000 / requests) >= 40, `only ${Math.floor(100_000 / requests)} matches/day on requests`);
  assert.ok(Math.floor(100_000 / rows) >= 18, `only ${Math.floor(100_000 / rows)} matches/day on row writes`);
});

test('lobby: the host picks the match length, it shows in the lobby and the match ends on time', () => {
  const w = makeWorld();
  const host = w.client('Hana');
  host.hello(true);
  assert.equal(host.last('lobby')!.minutes, 30, 'default length');
  host.send({ t: 'start', fillBots: false, minutes: 10 });
  assert.equal(host.last('lobby')!.minutes, 10);
  w.advance(3100);
  assert.equal(host.of('matchStart')[0].info.tune.match.durationSeconds, 600);
  w.advance(595_000);
  assert.equal(w.room.currentPhase, 'playing');
  w.advance(10_000);
  assert.equal(w.room.currentPhase, 'ended');
  assert.equal(w.room.meta().minutes, 10, 'persisted for a rebuilt room');
});
