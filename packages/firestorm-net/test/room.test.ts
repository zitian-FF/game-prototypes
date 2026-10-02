import assert from 'node:assert/strict';
import { test } from './harness';
import { loadTune, makeWorld, withTune } from './helpers';

const errorsOf = (c: ReturnType<ReturnType<typeof makeWorld>['client']>) => c.of('error').map((e) => e.code);

// ------------------------------------------------------------------ lobby

test('lobby: host creates a room, a joiner joins, both see the roster', () => {
  const w = makeWorld();
  const host = w.client('Hana');
  const joiner = w.client('Jo');
  host.hello(true);
  joiner.hello(false);
  const welcome = host.last('welcome')!;
  assert.equal(welcome.isHost, true);
  assert.equal(welcome.room, 'ABCDE');
  assert.equal(joiner.last('welcome')!.isHost, false);
  for (const c of [host, joiner]) {
    const lobby = c.last('lobby')!;
    assert.equal(lobby.phase, 'lobby');
    assert.deepEqual(lobby.players.map((p) => p.name), ['Hana', 'Jo']);
    assert.equal(lobby.hostId, host.clientId);
  }
});

test('lobby: joining a room that does not exist is refused and the socket dropped', () => {
  const w = makeWorld();
  const c = w.client('Jo');
  c.hello(false);
  assert.deepEqual(errorsOf(c), ['roomNotFound']);
  assert.ok(c.closedInfo);
});

test('lobby: creating a code that is already taken is refused', () => {
  const w = makeWorld();
  w.client('Hana').hello(true);
  const other = w.client('Other');
  other.hello(true);
  assert.deepEqual(errorsOf(other), ['roomExists']);
});

test('lobby: the room fills up', () => {
  const w = makeWorld({ maxHumans: 2 });
  w.client('A').hello(true);
  w.client('B').hello(false);
  const third = w.client('C');
  third.hello(false);
  assert.deepEqual(errorsOf(third), ['roomFull']);
});

test('lobby: messages before hello are refused, wrong protocol version is fatal', () => {
  const w = makeWorld();
  const c = w.client('A');
  c.send({ t: 'start', fillBots: false });
  assert.deepEqual(errorsOf(c), ['noHello']);
  c.send({ t: 'hello', v: 99, clientId: c.clientId, name: 'A', create: true });
  assert.ok(errorsOf(c).includes('badVersion'));
  assert.ok(c.closedInfo);
});

test('lobby: garbage is answered with an error and does not crash the room', () => {
  const w = makeWorld();
  const c = w.client('A');
  c.hello(true);
  w.room.onMessage(c.connId, '{{{{');
  w.room.onMessage(c.connId, 'x'.repeat(5000));
  assert.deepEqual(errorsOf(c), ['badMessage', 'badMessage']);
  assert.equal(w.room.currentPhase, 'lobby');
});

test('lobby: only the host can start, and only from the lobby', () => {
  const w = makeWorld();
  const host = w.client('Hana');
  const j = w.client('Jo');
  host.hello(true);
  j.hello(false);
  j.send({ t: 'start', fillBots: false });
  assert.deepEqual(errorsOf(j), ['notHost']);
  host.send({ t: 'start', fillBots: false });
  assert.equal(w.room.currentPhase, 'countdown');
  host.send({ t: 'start', fillBots: false });
  assert.ok(errorsOf(host).includes('badPhase'));
});

test('lobby: start gives a 3 second countdown the host can cancel', () => {
  const w = makeWorld();
  const host = w.client('Hana');
  host.hello(true);
  host.send({ t: 'start', fillBots: true });
  const lobby = host.last('lobby')!;
  assert.equal(lobby.phase, 'countdown');
  assert.equal(lobby.countdownEndsAtMs, w.env.wall + 3000);
  assert.equal(lobby.fillBots, true);

  w.advance(2000);
  host.send({ t: 'cancelStart' });
  assert.equal(w.room.currentPhase, 'lobby');
  w.advance(5000);
  assert.equal(w.room.currentPhase, 'lobby', 'a cancelled countdown never starts the match');
  assert.equal(host.of('matchStart').length, 0);
});

test('lobby: the match begins when the countdown ends', () => {
  const w = makeWorld();
  const host = w.client('Hana');
  host.hello(true);
  host.send({ t: 'start', fillBots: false });
  w.advance(2999);
  assert.equal(w.room.currentPhase, 'countdown');
  w.advance(2);
  assert.equal(w.room.currentPhase, 'playing');
  assert.equal(host.of('matchStart').length, 1);
});

test('lobby: a newer socket for the same client replaces the old one', () => {
  const w = makeWorld();
  const first = w.client('Hana', 'client-hana-0001');
  first.hello(true);
  const second = w.client('Hana', 'client-hana-0001');
  second.hello(false);
  assert.ok(errorsOf(first).includes('replaced'));
  assert.equal(first.closedInfo?.code, 4001);
  assert.equal(second.last('welcome')!.isHost, true, 'still the host');
  assert.equal(second.last('lobby')!.players.length, 1);
});

test('lobby: a non-host who leaves disappears, the host gets a grace period', () => {
  const w = makeWorld({ hostGraceMs: 30_000 });
  const host = w.client('Hana');
  const j = w.client('Jo');
  host.hello(true);
  j.hello(false);
  w.room.onClose(j.connId);
  assert.deepEqual(host.last('lobby')!.players.map((p) => p.name), ['Hana']);

  w.room.onClose(host.connId);
  w.advance(20_000);
  assert.equal(w.room.currentPhase, 'lobby', 'still waiting for the host');
  const back = w.client('Hana', host.clientId);
  back.hello(false);
  assert.equal(back.last('welcome')!.isHost, true);
  w.advance(60_000);
  assert.equal(w.room.currentPhase, 'lobby', 'host came back in time');
});

test('lobby: a host who never returns closes the room', () => {
  const w = makeWorld({ hostGraceMs: 30_000 });
  const host = w.client('Hana');
  const j = w.client('Jo');
  host.hello(true);
  j.hello(false);
  w.room.onClose(host.connId);
  w.advance(31_000);
  assert.equal(w.room.currentPhase, 'closed');
  assert.ok(w.room.shouldDestroy());
  assert.ok(errorsOf(j).includes('hostLeft'));
});

// ------------------------------------------------------------------ match start

function startMatch(names: string[], fillBots: boolean, opts = {}) {
  const w = makeWorld(opts);
  const clients = names.map((n, i) => w.client(n, `client-${i}-${n.replace(/\W/g, '')}`.padEnd(12, '_')));
  clients.forEach((c, i) => c.hello(i === 0));
  clients[0].send({ t: 'start', fillBots });
  w.advance(3100);
  clients.forEach((c) => c.pull());
  return { w, clients };
}

test('match: every human gets matchStart before any state, with their own details', () => {
  const { clients } = startMatch(['Ann', 'Bob', 'Cy'], false);
  for (const c of clients) {
    const idx = c.msgs.findIndex((m) => m.t === 'matchStart');
    const firstState = c.msgs.findIndex((m) => m.t === 'state');
    assert.ok(idx >= 0 && firstState > idx, `${c.name}: matchStart then state`);
    const info = c.last('matchStart')!.info;
    assert.equal(info.playerId, c.name);
    assert.equal(info.tune.scoring.garrisonPointsPerSecond, 10, 'server sends its own tune');
    assert.equal(info.map.nodes.length, 35);
    assert.ok(info.hqId.startsWith('h'));
  }
});

test('match: humans are split across the two teams, and only teammates are named', () => {
  const { clients } = startMatch(['Ann', 'Bob', 'Cy', 'Di'], false);
  const infos = clients.map((c) => c.last('matchStart')!.info);
  const t0 = infos.filter((i) => i.team === 0).length;
  assert.equal(t0, 2, 'two humans per team');
  for (const info of infos) {
    const mates = info.teammates;
    const enemies = infos.filter((o) => o.team !== info.team).map((o) => o.playerId);
    for (const e of enemies) assert.ok(!mates.includes(e), 'enemy names are not disclosed');
  }
});

test('match: filling with bots makes it 20 v 20 and names stay unique', () => {
  const { w, clients } = startMatch(['Ann', 'Ann', 'Bot Alpha'], true);
  const g = w.room.sim!;
  assert.equal(g.players.size, 40);
  const teams = [0, 0];
  for (const p of g.players.values()) teams[p.team]++;
  assert.deepEqual(teams, [20, 20]);
  assert.equal(new Set([...g.players.keys()].map((n) => n.toLowerCase())).size, 40);
  const names = clients.map((c) => c.last('matchStart')!.info.playerId);
  assert.equal(new Set(names).size, 3, 'duplicate human names are made distinct');
});

test('match: without bots only the humans play, teams differ by at most one', () => {
  const { w } = startMatch(['Ann', 'Bob', 'Cy'], false);
  assert.equal(w.room.sim!.players.size, 3);
});

test('match: a late stranger is turned away, a known player can reconnect and gets the full state', () => {
  const { w, clients } = startMatch(['Ann', 'Bob'], true);
  const stranger = w.client('Eve');
  stranger.hello(false);
  assert.deepEqual(errorsOf(stranger), ['matchInProgress']);

  const ann = clients[0];
  w.room.onClose(ann.connId);
  w.advance(20_000);
  const again = w.client('Ann', ann.clientId);
  again.hello(false);
  assert.equal(again.of('matchStart').length, 1);
  const full = again.of('state').find((s) => s.full);
  assert.ok(full?.view, 'reconnecting player gets a full snapshot');
  assert.equal(full!.view!.hqs.some((h) => h.owner === 'Ann'), true);
  assert.ok(again.view!.squads.every((s) => typeof s.id === 'string'));
});

// ------------------------------------------------------------------ commands

test('commands: a human order goes through the sim and is acknowledged', () => {
  const { w, clients } = startMatch(['Ann'], false);
  const ann = clients[0];
  const squad = ann.view!.squads[0];
  const node = ann.view!.nodes.find((n) => n.owner === null)!;
  const id = ann.cmd({ type: 'march', squadId: squad.id, target: { kind: 'node', nodeId: node.id } });
  const res = ann.of('cmdResult').find((r) => r.id === id)!;
  assert.equal(res.ok, true);
  assert.equal(w.room.sim!.squads.get(squad.id)!.state.kind, 'march');
  const st = ann.view!.squads.find((s) => s.id === squad.id)!;
  assert.equal(st.state, 'march', 'the client view shows it marching');
  assert.ok(ann.last('state')!.events.some((e) => e.type === 'marchStarted'));
});

test('commands: rejected orders say why, and orders before the match are refused', () => {
  const w = makeWorld();
  const c = w.client('Ann');
  c.hello(true);
  const early = c.cmd({ type: 'cancel', squadId: 's0' });
  assert.deepEqual(c.of('cmdResult').find((r) => r.id === early), { t: 'cmdResult', id: early, ok: false, error: 'notPlaying' });

  c.send({ t: 'start', fillBots: false });
  w.advance(3100);
  const bad = c.cmd({ type: 'march', squadId: 'nope', target: { kind: 'node', nodeId: 'n0' } });
  assert.deepEqual(c.of('cmdResult').find((r) => r.id === bad), { t: 'cmdResult', id: bad, ok: false, error: 'unknownSquad' });
});

test('commands: you cannot command someone elses squads', () => {
  const { w, clients } = startMatch(['Ann', 'Bob'], false);
  const [ann, bob] = clients;
  const bobSquad = bob.view!.squads[0];
  const id = ann.cmd({ type: 'march', squadId: bobSquad.id, target: { kind: 'node', nodeId: 'n0' } });
  assert.equal(ann.of('cmdResult').find((r) => r.id === id)!.ok, false);
  assert.equal(w.room.sim!.squads.get(bobSquad.id)!.state.kind, 'hq');
});

test('commands: a flood is rate limited, not processed', () => {
  const { w, clients } = startMatch(['Ann'], false);
  const ann = clients[0];
  for (let i = 0; i < 500; i++) ann.send({ t: 'ping', c: i });
  const pongs = ann.of('pong').length;
  assert.ok(pongs < 80, `only ${pongs} of 500 got through`);
  assert.ok(errorsOf(ann).includes('rateLimited'));
  w.advance(5000);
  ann.send({ t: 'ping', c: 1 });
  assert.ok(ann.of('pong').length > pongs, 'works again after the budget refills');
});

test('commands: ping returns the server clock', () => {
  const w = makeWorld();
  const c = w.client('Ann');
  c.hello(true);
  c.send({ t: 'ping', c: 42 });
  assert.deepEqual(c.last('pong'), { t: 'pong', c: 42, s: w.env.wall });
});

test('time: the alarm loop always makes progress, at awkward time scales too', () => {
  for (const timeScale of [1, 7.3, 60, 0.37]) {
    const w = makeWorld({ timeScale });
    const host = w.client('Hana');
    host.hello(true);
    host.send({ t: 'start', fillBots: true });
    w.advance(3100);
    const room = w.room;
    let alarms = 0;
    const real = room.onAlarm.bind(room);
    room.onAlarm = () => {
      if (++alarms > 20_000) throw new Error(`stuck alarm loop at time scale ${timeScale}`);
      real();
    };
    w.advance(120_000 / timeScale);
    assert.ok(room.sim!.now >= 100_000, `scale ${timeScale}: sim only reached ${room.sim!.now}`);
    assert.ok(alarms < 20_000);
  }
});
