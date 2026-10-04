// End-to-end check against Cloudflare's local runtime (workerd) with real
// WebSocket clients. Not part of `npm test`: it starts `wrangler dev` itself.
//
//   node packages/firestorm-net/scripts/e2e.mjs
//
// It plays a whole match at 60x speed through real sockets, with two humans and
// 38 bots, and in the middle kills the runtime and starts it again with the same
// storage, to prove the room rebuilds exactly from its replay log.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '../..');
const PORT = 8799;
const SCALE = 60;
const WRANGLER = 'wrangler@4.143.0';

const vite = await createServer({
  root,
  configFile: false,
  logLevel: 'warn',
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
const { applyPatch } = await vite.ssrLoadModule('/src/wire.ts');

const persist = mkdtempSync(path.join(tmpdir(), 'firestorm-e2e-'));
let worker = null;
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startWorker() {
  try {
    await fetch(`http://127.0.0.1:${PORT}/health`);
    throw new Error(`port ${PORT} is already serving something: stop it first`);
  } catch (e) {
    if (String(e.message).includes('already serving')) throw e;
  }
  worker = spawn(
    'npx',
    [
      '--yes',
      WRANGLER,
      'dev',
      '--config',
      'prototypes/firestorm-arena/server/wrangler.jsonc',
      '--port',
      String(PORT),
      '--persist-to',
      persist,
      '--var',
      `TIME_SCALE:${SCALE}`,
      '--var',
      'PULSE_MS:250',
    ],
    // Own process group, so stopping it really stops wrangler and workerd, not just npx.
    { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } },
  );
  let log = '';
  worker.stdout.on('data', (d) => (log += d));
  worker.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`worker never became healthy:\n${log.slice(-2000)}`);
}

async function stopWorker() {
  if (!worker) return;
  try {
    process.kill(-worker.pid, 'SIGKILL');
  } catch {
    worker.kill('SIGKILL');
  }
  await sleep(2500);
  worker = null;
}

class Client {
  constructor(name, code, clientId) {
    this.name = name;
    this.code = code;
    this.clientId = clientId;
    this.msgs = [];
    this.view = null;
    this.bytes = 0;
    this.ws = null;
    this.closed = null;
    this.seq = 0;
  }

  connect(create) {
    return new Promise((resolve, reject) => {
      this.closed = null;
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/${this.code}`);
      this.ws = ws;
      ws.onopen = () => {
        this.send({ t: 'hello', v: 7, clientId: this.clientId, name: this.name, create });
        resolve();
      };
      ws.onerror = () => reject(new Error(`${this.name}: socket error`));
      ws.onclose = (e) => (this.closed = { code: e.code, reason: e.reason });
      ws.onmessage = (e) => {
        const text = String(e.data);
        this.bytes += text.length;
        const m = JSON.parse(text);
        this.msgs.push(m);
        if (m.t === 'state') {
          if (m.full && m.view) this.view = m.view;
          else if (m.patch && this.view) this.view = applyPatch(this.view, m.patch);
        }
      };
    });
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  async waitFor(pred, ms, what) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const hit = this.msgs.find(pred);
      if (hit) return hit;
      await sleep(50);
    }
    throw new Error(`${this.name}: timed out waiting for ${what}`);
  }

  last(t) {
    return [...this.msgs].reverse().find((m) => m.t === t);
  }

  of(t) {
    return this.msgs.filter((m) => m.t === t);
  }
}

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = Array.from({ length: 3 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

try {
  console.log(`room ${code}; starting the local Cloudflare runtime...`);
  await startWorker();
  check(true, 'worker is up and /health answers');

  // --- routing and refusals ------------------------------------------------------------------
  const wrongRoom = new Client('Nobody', 'ZZ9', 'client-nobody-0001');
  await wrongRoom.connect(false);
  await wrongRoom.waitFor((m) => m.t === 'error', 5000, 'an error');
  check(wrongRoom.last('error').code === 'roomNotFound', 'joining a room that does not exist is refused');

  const bad = await fetch(`http://127.0.0.1:${PORT}/ws/lower`);
  check(bad.status === 404, 'a malformed room code is a 404');
  const noUpgrade = await fetch(`http://127.0.0.1:${PORT}/ws/${code}`);
  check(noUpgrade.status === 426, 'a plain GET without an upgrade is refused');

  // --- lobby ------------------------------------------------------------------------------------
  const hana = new Client('Hana', code, 'client-hana-e2e-0001');
  const ivo = new Client('Ivo', code, 'client-ivo--e2e-0002');
  await hana.connect(true);
  await hana.waitFor((m) => m.t === 'welcome', 5000, 'welcome');
  await ivo.connect(false);
  await ivo.waitFor((m) => m.t === 'welcome', 5000, 'welcome');
  await hana.waitFor((m) => m.t === 'lobby' && m.players.length === 2, 5000, 'two players in the lobby');
  check(hana.last('welcome').isHost && !ivo.last('welcome').isHost, 'first in is host, second is not');

  const stranger = new Client('Copycat', code, 'client-copy--e2e-0003');
  await stranger.connect(true);
  await stranger.waitFor((m) => m.t === 'error', 5000, 'an error');
  check(stranger.last('error').code === 'roomExists', 'creating a taken code is refused');

  // --- start with a countdown, cancel once, then really start -------------------------------
  hana.send({ t: 'start', fillBots: true, minutes: 30 });
  await hana.waitFor((m) => m.t === 'lobby' && m.phase === 'countdown', 5000, 'countdown');
  hana.send({ t: 'cancelStart' });
  await hana.waitFor((m) => m.t === 'lobby' && m.phase === 'lobby', 5000, 'back to the lobby');
  check(true, 'the host can cancel the countdown');
  hana.msgs.length = 0;
  ivo.msgs.length = 0;
  const t0 = Date.now();
  hana.send({ t: 'start', fillBots: true, minutes: 30 });
  await hana.waitFor((m) => m.t === 'matchStart', 8000, 'matchStart');
  await ivo.waitFor((m) => m.t === 'matchStart', 8000, 'matchStart');
  check(Date.now() - t0 >= 2800, `the match waited out the 3 second countdown (${Date.now() - t0}ms)`);
  await hana.waitFor((m) => m.t === 'state' && m.full, 5000, 'first full state');
  await ivo.waitFor((m) => m.t === 'state' && m.full, 5000, 'first full state');
  const hInfo = hana.last('matchStart').info;
  const iInfo = ivo.last('matchStart').info;
  check(hInfo.map.nodes.length === 23, 'matchStart carries the 23 node map');
  check(hInfo.team !== iInfo.team, 'the two humans are on opposite teams');
  check(hana.view.hqs.length === 20, 'the host sees all 20 HQs of their team');

  // --- play: send a real order -----------------------------------------------------------------
  await hana.waitFor((m) => m.t === 'state', 5000, 'a state');
  const squad = hana.view.squads.find((s) => s.owner === 'Hana');
  const node = hana.view.nodes.find((n) => n.owner === null && n.unlocksAtMs === undefined && n.kind !== 'portal');
  hana.send({ t: 'cmd', id: 1, cmd: { type: 'march', squadId: squad.id, target: { kind: 'node', nodeId: node.id } } });
  const res = await hana.waitFor((m) => m.t === 'cmdResult' && m.id === 1, 5000, 'cmdResult');
  check(res.ok === true, `a human march order is accepted${res.ok ? '' : ` (${res.error})`}`);
  await sleep(600);
  check(hana.view.squads.find((s) => s.id === squad.id).state === 'march', 'the client view shows the squad marching');
  hana.send({ t: 'cmd', id: 2, cmd: { type: 'march', squadId: 'nope', target: { kind: 'node', nodeId: node.id } } });
  const bad2 = await hana.waitFor((m) => m.t === 'cmdResult' && m.id === 2, 5000, 'cmdResult');
  check(bad2.ok === false, 'an invalid order is rejected with a reason');
  hana.send({ t: 'ping', c: 7 });
  const pong = await hana.waitFor((m) => m.t === 'pong' && m.c === 7, 5000, 'pong');
  check(Math.abs(pong.s - Date.now()) < 5000, 'ping returns the server clock');

  // --- let it run, then kill the runtime in the middle ---------------------------------------------
  await sleep(8000); // ~8 real seconds = ~8 sim minutes at 60x
  const simBefore = hana.last('state').simMs;
  check(simBefore > 240_000, `the match is running at speed (sim ${Math.round(simBefore / 1000)}s)`);
  console.log('killing the runtime mid-match...');
  await stopWorker();
  check(hana.closed !== null, 'clients see the sockets drop');
  await startWorker();
  console.log('runtime restarted with the same storage; reconnecting...');
  hana.msgs.length = 0;
  ivo.msgs.length = 0;
  await hana.connect(false);
  await ivo.connect(false);
  await hana.waitFor((m) => m.t === 'matchStart', 15_000, 'matchStart after restart');
  await ivo.waitFor((m) => m.t === 'matchStart', 15_000, 'matchStart after restart');
  const back = await hana.waitFor((m) => m.t === 'state' && m.full, 15_000, 'full state after restart');
  check(hana.last('welcome').isHost, 'the host is still the host after the room was rebuilt');
  check(back.simMs >= simBefore, `the match carried on from storage (sim ${Math.round(back.simMs / 1000)}s, was ${Math.round(simBefore / 1000)}s)`);
  const mine = back.view.squads.find((s) => s.id === squad.id);
  check(!!mine && mine.owner === 'Hana', 'the rebuilt match still has the same squads and owners');
  check(back.view.nodes.some((n) => n.owner !== null), 'captures made before the restart are still there');

  // --- play to the end ---------------------------------------------------------------------------
  console.log('playing to the end...');
  const end = await hana.waitFor((m) => m.t === 'state' && m.events.some((e) => e.type === 'matchEnded'), 90_000, 'matchEnded');
  const result = end.events.find((e) => e.type === 'matchEnded').result;
  check(result.winner === 0 || result.winner === 1 || result.winner === 'draw', `the match ended with a result (${JSON.stringify(result.winner)}, ${result.points.map(Math.round)})`);
  await ivo.waitFor((m) => m.t === 'state' && m.events.some((e) => e.type === 'matchEnded'), 10_000, 'matchEnded for Ivo');
  check(hana.last('lobby').phase === 'ended', 'the lobby phase is ended');
  const errs = [...hana.of('error'), ...ivo.of('error')].map((e) => e.code);
  check(errs.length === 0, `no errors reached either player${errs.length ? ` (${errs.join(',')})` : ''}`);

  const states = hana.of('state').length;
  console.log(`  info Hana got ${states} state messages, ${(hana.bytes / 1024).toFixed(0)} KiB after the restart`);
} catch (err) {
  failures.push(String(err.stack ?? err));
  console.log('  FAIL', err.message);
} finally {
  await stopWorker();
  rmSync(persist, { recursive: true, force: true });
  await vite.close();
}

console.log(failures.length ? `\n${failures.length} FAILED` : '\nall end-to-end checks passed');
process.exit(failures.length ? 1 : 0);
