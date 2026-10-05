import { ArenaRoom, DEFAULT_QUOTA, addUsage, cmdKey, quotaStatus, utcDay } from 'firestorm-net';
import type { GameLogRecord, HlogStore, LoggedCommand, PersistOp, QuotaConfig, QuotaUsage, RoomEnv, RoomMeta, RoomOptions } from 'firestorm-net';
import type { Tune } from 'arena-sim';
import tuneJson from '../../tune.json';

interface Env {
  MATCH_ROOMS: DurableObjectNamespace;
  /** One shared meter that estimates this game's daily use of the plan limits. */
  QUOTA: DurableObjectNamespace;
  /** Per-match player behaviour records (see GameLogs). */
  GAME_LOGS: DurableObjectNamespace;
  /** Secret that unlocks /admin/logs. Set it with `wrangler secret put LOG_TOKEN`; without it the endpoint does not exist. */
  LOG_TOKEN?: string;
  /** Override the plan limits the meter assumes (testing). */
  QUOTA_WRITES_LIMIT?: string;
  QUOTA_REQUESTS_LIMIT?: string;
  /** Sim speed-up, for testing only (a `--var` on `wrangler dev`). Unset in production. */
  TIME_SCALE?: string;
  /** Minimum ms between state broadcasts while playing. */
  PULSE_MS?: string;
}

const ROOM_CODE = /^[ACDEFHJKMNPRTWXY]{3}$/;
const TUNE = tuneJson as unknown as Tune;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'cache-control': 'no-store',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });
}

function meter(env: Env) {
  return env.QUOTA.get(env.QUOTA.idFromName('meter'));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'firestorm-arena-server' }), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    if (url.pathname === '/api/quota') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      return json(await (await meter(env).fetch(new Request('https://meter/status'))).json());
    }

    if (url.pathname === '/admin/logs') {
      // Only the owner, with the secret token in a header. Anything else gets the same 404 as an unknown path.
      const token = env.LOG_TOKEN;
      const given = request.headers.get('authorization') ?? '';
      if (request.method !== 'GET' || !token || given !== `Bearer ${token}`) return new Response('Not found', { status: 404 });
      const logs = env.GAME_LOGS.get(env.GAME_LOGS.idFromName('logs'));
      return logs.fetch(new Request(`https://logs/list${url.search}`));
    }

    const room = url.pathname.match(/^\/ws\/([ACDEFHJKMNPRTWXY]{3})$/)?.[1];
    if (!room || !ROOM_CODE.test(room)) {
      return new Response('Not found', { status: 404 });
    }

    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }

    // Creating a room costs a whole match of the daily limits: refuse it when there is not enough left.
    // Joining or reconnecting to an existing room is always allowed.
    if (url.searchParams.get('create') === '1') {
      const status = (await (await meter(env).fetch(new Request('https://meter/status'))).json()) as { canStart: boolean };
      if (!status.canStart) return json({ error: 'quotaLow', ...status }, 503);
    }

    const id = env.MATCH_ROOMS.idFromName(room);
    return env.MATCH_ROOMS.get(id).fetch(request);
  },
};

interface Attachment {
  connId: string;
  clientId?: string;
}

/**
 * One Durable Object per room code. All game logic lives in ArenaRoom
 * (packages/firestorm-net); this class only connects it to Cloudflare:
 * accepting hibernatable WebSockets, flushing the room's replay log to
 * storage, keeping a single alarm set for the room's next wake, and rebuilding
 * the room from storage if the object was evicted.
 */
export class ArenaMatch {
  private room: ArenaRoom | null = null;
  private readonly sockets = new Map<string, CfWebSocket>();
  private alarmAt: number | null = null;
  private readonly ready: Promise<void>;
  /** Usage not yet reported to the meter. WebSocket messages count 1 in 20 as requests. */
  private pendingWrites = 0;
  private pendingRequests = 0;
  private lastReportAt = Date.now();
  /** Behaviour records waiting to be handed to the GameLogs object. */
  private unsentLogs: GameLogRecord[] = [];

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.ready = state.blockConcurrencyWhile(() => this.load());
  }

  private options(code: string): RoomOptions {
    const timeScale = Number(this.env.TIME_SCALE);
    const pulseMs = Number(this.env.PULSE_MS);
    return {
      code,
      tune: TUNE,
      ...(Number.isFinite(timeScale) && timeScale > 0 ? { timeScale } : {}),
      ...(Number.isFinite(pulseMs) && pulseMs > 0 ? { pulseMs } : {}),
    };
  }

  private readonly roomEnv: RoomEnv = {
    send: (connId, data) => {
      try {
        this.sockets.get(connId)?.send(data);
      } catch {
        // The socket is already gone; its close event will clean up.
      }
    },
    close: (connId, code, reason) => {
      try {
        this.sockets.get(connId)?.close(code, reason);
      } catch {
        // Already closed.
      }
      this.sockets.delete(connId);
    },
    now: () => Date.now(),
    random: () => Math.random(),
    gameLog: (records) => {
      this.unsentLogs.push(...records);
    },
    identified: (connId, clientId) => {
      // Survives hibernation, so a rebuilt room knows whose socket this is.
      this.sockets.get(connId)?.serializeAttachment({ connId, clientId } satisfies Attachment);
    },
  };

  /** Rebuild the room from storage after a restart or eviction, and re-bind surviving sockets. */
  private async load(): Promise<void> {
    const leftover = await this.state.storage.get<GameLogRecord[]>('unsentLogs');
    if (leftover?.length) this.unsentLogs.push(...leftover);
    const meta = await this.state.storage.get<RoomMeta>('meta');
    if (!meta) return;
    const hlog = await this.state.storage.get<HlogStore>('hlog');
    const stored = await this.state.storage.list<LoggedCommand>({ prefix: 'c:' });
    // Keys sort in order because cmdKey pads the sequence number.
    const log = [...stored.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
    this.room = ArenaRoom.restore(this.options(meta.code), this.roomEnv, meta, log, { hlog });
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att) continue;
      this.sockets.set(att.connId, ws);
      if (att.clientId) this.room.attachRestored(att.connId, att.clientId);
      else this.room.onConnect(att.connId);
    }
    await this.settle();
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    const code = new URL(request.url).pathname.split('/').pop() ?? '';
    this.room ??= new ArenaRoom(this.options(code), this.roomEnv);

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]] as [WebSocket, CfWebSocket];
    this.state.acceptWebSocket(server);
    const connId = crypto.randomUUID();
    server.serializeAttachment({ connId } satisfies Attachment);
    this.sockets.set(connId, server);
    this.pendingRequests += 1;
    this.room.onConnect(connId);
    await this.settle();
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ready;
    const att = (ws as CfWebSocket).deserializeAttachment() as Attachment | null;
    if (!att || !this.room || typeof message !== 'string') return;
    this.pendingRequests += 0.05;
    this.room.onMessage(att.connId, message);
    await this.settle();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.dropped(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.dropped(ws);
  }

  private async dropped(ws: WebSocket): Promise<void> {
    await this.ready;
    const att = (ws as CfWebSocket).deserializeAttachment() as Attachment | null;
    if (!att) return;
    this.sockets.delete(att.connId);
    this.room?.onClose(att.connId);
    await this.settle();
  }

  async alarm(): Promise<void> {
    await this.ready;
    this.alarmAt = null;
    this.pendingRequests += 1;
    this.room?.onAlarm();
    await this.settle();
  }

  /** After every call into the room: flush its log to storage, then keep one alarm set for its next wake. */
  private async settle(): Promise<void> {
    const room = this.room;
    if (!room) return;
    await this.flush(room.drainPersist());
    await this.sendLogs();
    await this.reportUsage(room.shouldDestroy());

    if (room.shouldDestroy()) {
      this.room = null;
      this.alarmAt = null;
      await this.state.storage.deleteAlarm();
      await this.state.storage.deleteAll();
      return;
    }

    const next = room.nextWakeAt();
    if (next === null) {
      if (this.alarmAt !== null) await this.state.storage.deleteAlarm();
      this.alarmAt = null;
    } else if (this.alarmAt === null || Math.abs(next - this.alarmAt) > 1) {
      const at = Math.max(next, Date.now() + 1);
      await this.state.storage.setAlarm(at);
      this.alarmAt = at;
    }
  }

  /** Tell the shared meter what this room used, at most every 20 seconds (and once when the room ends). */
  private async reportUsage(force: boolean): Promise<void> {
    const now = Date.now();
    if (this.pendingWrites === 0 && this.pendingRequests === 0) return;
    if (!force && now - this.lastReportAt < 20_000) return;
    const body = JSON.stringify({ writes: this.pendingWrites, requests: this.pendingRequests });
    this.pendingWrites = 0;
    this.pendingRequests = 0;
    this.lastReportAt = now;
    // Awaited, because a request nobody waits for can be cancelled when the handler returns. A failed report
    // only makes the estimate a little low.
    try {
      await this.env.QUOTA.get(this.env.QUOTA.idFromName('meter')).fetch(new Request('https://meter/add', { method: 'POST', body }));
    } catch {
      // ignore
    }
  }

  /** Hand finished behaviour records to the GameLogs object. If that fails, keep them and try again on the next call. */
  private async sendLogs(): Promise<void> {
    if (this.unsentLogs.length === 0) return;
    const batch = this.unsentLogs;
    this.unsentLogs = [];
    this.pendingWrites += batch.length;
    try {
      const logs = this.env.GAME_LOGS.get(this.env.GAME_LOGS.idFromName('logs'));
      const res = await logs.fetch(new Request('https://logs/add', { method: 'POST', body: JSON.stringify({ records: batch }) }));
      if (!res.ok) throw new Error(`logs ${res.status}`);
      await this.state.storage.delete('unsentLogs');
    } catch {
      this.unsentLogs = batch;
      await this.state.storage.put('unsentLogs', batch);
    }
  }

  private async flush(ops: PersistOp[]): Promise<void> {
    if (ops.length === 0) return;
    // Later writes to a key win, so collapse first (the lobby rewrites 'meta' often).
    const last = new Map<string, unknown>();
    for (const op of ops) last.set(op.key, op.value);
    const puts: Record<string, unknown> = {};
    const deletes: string[] = [];
    for (const [key, value] of last) {
      if (value === null) deletes.push(key);
      else puts[key] = value;
    }
    const keys = Object.keys(puts);
    this.pendingWrites += keys.length + deletes.length;
    for (let i = 0; i < keys.length; i += 128) {
      const chunk: Record<string, unknown> = {};
      for (const k of keys.slice(i, i + 128)) chunk[k] = puts[k];
      await this.state.storage.put(chunk);
    }
    if (deletes.length) await this.state.storage.delete(deletes);
  }
}

/**
 * One shared counter for the whole game: rooms report what they used, the Worker asks for the status.
 * It persists at most once a minute (one row write), so a restart can lose up to a minute of counts.
 */
export class QuotaMeter {
  private usage: QuotaUsage = { day: '', writes: 0, requests: 0 };
  private lastPersistAt = 0;
  private readonly ready: Promise<void>;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.ready = state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get<QuotaUsage>('usage');
      if (saved) this.usage = saved;
    });
  }

  private config(): QuotaConfig {
    const w = Number(this.env.QUOTA_WRITES_LIMIT);
    const r = Number(this.env.QUOTA_REQUESTS_LIMIT);
    return {
      ...DEFAULT_QUOTA,
      ...(Number.isFinite(w) && w > 0 ? { writesLimit: w } : {}),
      ...(Number.isFinite(r) && r > 0 ? { requestsLimit: r } : {}),
    };
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const now = Date.now();
    const path = new URL(request.url).pathname;
    // The call itself is a request; persisting costs one row write.
    let writes = 0;
    let requests = 1;
    if (request.method === 'POST' && path === '/add') {
      try {
        const body = (await request.json()) as { writes?: number; requests?: number };
        writes += Number(body.writes) || 0;
        requests += Number(body.requests) || 0;
      } catch {
        // A malformed report only counts as the call itself.
      }
    }
    this.usage = addUsage(this.usage, now, writes, requests);
    if (now - this.lastPersistAt >= 60_000) {
      this.lastPersistAt = now;
      this.usage = addUsage(this.usage, now, 1, 0);
      await this.state.storage.put({ usage: this.usage });
    }
    return new Response(JSON.stringify(quotaStatus(this.usage, now, this.config())), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}

const LOG_RETENTION_DAYS = 90;
const LOG_MAX_ROWS = 20_000;
const LOG_MAX_LIST = 2_000;

/**
 * Keeps one small behaviour record per human player per match, for the game's owner to download from /admin/logs.
 * Rows are keyed `g:<date>:<match>:<player>` so they sort by date. Nothing here is ever sent to a player. Rows older
 * than 90 days are dropped, and the table is capped at 20,000 rows (about 2,000 matches of ten humans), oldest first.
 */
export class GameLogs {
  private count = 0;
  private readonly ready: Promise<void>;

  constructor(private readonly state: DurableObjectState) {
    this.ready = state.blockConcurrencyWhile(async () => {
      this.count = (await state.storage.get<number>('count')) ?? 0;
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/add') {
      let records: GameLogRecord[] = [];
      try {
        records = ((await request.json()) as { records?: GameLogRecord[] }).records ?? [];
      } catch {
        return new Response('bad body', { status: 400 });
      }
      await this.add(records.filter((r) => r && typeof r.at === 'string' && typeof r.match === 'string' && typeof r.pid === 'string'));
      return new Response('ok');
    }
    if (request.method === 'GET' && url.pathname === '/list') {
      const since = url.searchParams.get('since');
      const limit = Math.min(LOG_MAX_LIST, Math.max(1, Number(url.searchParams.get('limit')) || 500));
      const start = since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? `g:${since}` : 'g:';
      const rows = await this.state.storage.list<GameLogRecord>({ prefix: 'g:', start, limit });
      const records = [...rows.values()];
      if (url.searchParams.get('format') === 'ndjson') {
        return new Response(records.map((r) => JSON.stringify(r)).join('\n') + '\n', { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
      }
      return new Response(JSON.stringify({ total: this.count, returned: records.length, records }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
    return new Response('Not found', { status: 404 });
  }

  private async add(records: GameLogRecord[]): Promise<void> {
    if (records.length === 0) return;
    const puts: Record<string, GameLogRecord> = {};
    for (const r of records) puts[`g:${r.at.slice(0, 10)}:${r.match}:${r.pid}`] = r;
    const keys = Object.keys(puts);
    for (let i = 0; i < keys.length; i += 100) {
      const chunk: Record<string, GameLogRecord> = {};
      for (const k of keys.slice(i, i + 100)) chunk[k] = puts[k];
      await this.state.storage.put(chunk);
    }
    this.count += keys.length;
    await this.state.storage.put('count', this.count);
    await this.prune();
  }

  /** At most once a day: drop rows past the retention window, then trim to the row cap, oldest first. */
  private async prune(): Promise<void> {
    const today = utcDay(Date.now());
    if ((await this.state.storage.get<string>('prunedDay')) === today && this.count <= LOG_MAX_ROWS) return;
    const cutoff = utcDay(Date.now() - LOG_RETENTION_DAYS * 86_400_000);
    for (;;) {
      const old = await this.state.storage.list({ prefix: 'g:', end: `g:${cutoff}`, limit: 100 });
      if (old.size === 0) break;
      await this.state.storage.delete([...old.keys()]);
      this.count = Math.max(0, this.count - old.size);
    }
    while (this.count > LOG_MAX_ROWS) {
      const old = await this.state.storage.list({ prefix: 'g:', limit: Math.min(100, this.count - LOG_MAX_ROWS) });
      if (old.size === 0) break;
      await this.state.storage.delete([...old.keys()]);
      this.count -= old.size;
    }
    await this.state.storage.put({ count: this.count, prunedDay: today });
  }
}

export { cmdKey };
