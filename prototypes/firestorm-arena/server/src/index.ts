import { ArenaRoom, cmdKey } from 'firestorm-net';
import type { LoggedCommand, PersistOp, RoomEnv, RoomMeta, RoomOptions } from 'firestorm-net';
import type { Tune } from 'arena-sim';
import tuneJson from '../../tune.json';

interface Env {
  MATCH_ROOMS: DurableObjectNamespace;
  /** Sim speed-up, for testing only (a `--var` on `wrangler dev`). Unset in production. */
  TIME_SCALE?: string;
  /** Minimum ms between state broadcasts while playing. */
  PULSE_MS?: string;
}

const ROOM_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}$/;
const TUNE = tuneJson as unknown as Tune;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'firestorm-arena-server' }), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    const room = url.pathname.match(/^\/ws\/([ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3})$/)?.[1];
    if (!room || !ROOM_CODE.test(room)) {
      return new Response('Not found', { status: 404 });
    }

    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
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
    identified: (connId, clientId) => {
      // Survives hibernation, so a rebuilt room knows whose socket this is.
      this.sockets.get(connId)?.serializeAttachment({ connId, clientId } satisfies Attachment);
    },
  };

  /** Rebuild the room from storage after a restart or eviction, and re-bind surviving sockets. */
  private async load(): Promise<void> {
    const meta = await this.state.storage.get<RoomMeta>('meta');
    if (!meta) return;
    const stored = await this.state.storage.list<LoggedCommand>({ prefix: 'c:' });
    // Keys sort in order because cmdKey pads the sequence number.
    const log = [...stored.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
    this.room = ArenaRoom.restore(this.options(meta.code), this.roomEnv, meta, log);
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
    this.room.onConnect(connId);
    await this.settle();
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ready;
    const att = (ws as CfWebSocket).deserializeAttachment() as Attachment | null;
    if (!att || !this.room || typeof message !== 'string') return;
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
    this.room?.onAlarm();
    await this.settle();
  }

  /** After every call into the room: flush its log to storage, then keep one alarm set for its next wake. */
  private async settle(): Promise<void> {
    const room = this.room;
    if (!room) return;
    await this.flush(room.drainPersist());

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
    for (let i = 0; i < keys.length; i += 128) {
      const chunk: Record<string, unknown> = {};
      for (const k of keys.slice(i, i + 128)) chunk[k] = puts[k];
      await this.state.storage.put(chunk);
    }
    if (deletes.length) await this.state.storage.delete(deletes);
  }
}

export { cmdKey };
