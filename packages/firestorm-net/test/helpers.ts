import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArenaRoom, applyPatch } from '../src/index';
import type { ClientMsg, PersistOp, RoomMeta, RoomOptions, ServerMsg, WireView, LoggedCommand } from '../src/index';
import type { Tune } from 'arena-sim';

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadTune(): Tune {
  return JSON.parse(readFileSync(path.resolve(here, '../../../prototypes/firestorm-arena/tune.json'), 'utf8')) as Tune;
}

export function withTune(over: (t: Tune) => void): Tune {
  const t = loadTune();
  over(t);
  return t;
}

/** A pretend network and clock. Time only moves when a test moves it. */
export class FakeEnv {
  wall = 1_000_000;
  seedValue = 0.123456;
  readonly outbox = new Map<string, string[]>();
  readonly closed = new Map<string, { code: number; reason: string }>();

  send = (connId: string, data: string) => {
    if (this.closed.has(connId)) return;
    const box = this.outbox.get(connId) ?? [];
    box.push(data);
    this.outbox.set(connId, box);
  };
  close = (connId: string, code: number, reason: string) => {
    this.closed.set(connId, { code, reason });
  };
  now = () => this.wall;
  random = () => this.seedValue;
}

/** One client connection to a room, recording everything it receives. */
export class TestClient {
  readonly msgs: ServerMsg[] = [];
  view: WireView | null = null;
  seq = 0;
  private read = 0;

  constructor(
    readonly room: ArenaRoom,
    readonly env: FakeEnv,
    readonly connId: string,
    readonly clientId: string,
    readonly name: string,
  ) {
    room.onConnect(connId);
  }

  send(msg: ClientMsg | Record<string, unknown>): void {
    this.room.onMessage(this.connId, JSON.stringify(msg));
    this.pull();
  }

  hello(create = false): void {
    this.send({ t: 'hello', v: 5, clientId: this.clientId, name: this.name, create });
  }

  cmd(cmd: Record<string, unknown>): number {
    const id = ++this.seq;
    this.send({ t: 'cmd', id, cmd });
    return id;
  }

  /** Collect new messages (and keep a patched copy of the view, like a real client). */
  pull(): ServerMsg[] {
    const box = this.env.outbox.get(this.connId) ?? [];
    const fresh = box.slice(this.read).map((s) => JSON.parse(s) as ServerMsg);
    this.read = box.length;
    for (const m of fresh) {
      this.msgs.push(m);
      if (m.t === 'state') {
        if (m.full && m.view) this.view = m.view;
        else if (m.patch && this.view) this.view = applyPatch(this.view, m.patch);
      }
    }
    return fresh;
  }

  of<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }>[] {
    this.pull();
    return this.msgs.filter((m): m is Extract<ServerMsg, { t: T }> => m.t === t);
  }

  last<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }> | undefined {
    const all = this.of(t);
    return all[all.length - 1];
  }

  get closedInfo() {
    return this.env.closed.get(this.connId);
  }
}

export interface World {
  env: FakeEnv;
  room: ArenaRoom;
  store: Map<string, unknown>;
  client(name: string, id?: string): TestClient;
  /** Move the wall clock to `wall`, running every wake the room asks for on the way. */
  runTo(wall: number): void;
  advance(ms: number): void;
}

export function makeWorld(opts: Partial<RoomOptions> = {}, tune: Tune = loadTune()): World {
  const env = new FakeEnv();
  const store = new Map<string, unknown>();
  const room = new ArenaRoom({ code: 'ABCDE', tune, ...opts }, env);
  let n = 0;
  const w: World = {
    env,
    room,
    store,
    client: (name, id) => new TestClient(room, env, `conn${++n}`, id ?? `client-${name.padEnd(8, '_')}`, name),
    runTo(wall: number) {
      for (let guard = 0; guard < 2_000_000; guard++) {
        const wake = room.nextWakeAt();
        flush(room, store);
        if (wake === null || wake > wall) break;
        env.wall = Math.max(env.wall, wake);
        room.onAlarm();
      }
      env.wall = wall;
      flush(room, store);
    },
    advance(ms: number) {
      w.runTo(env.wall + ms);
    },
  };
  return w;
}

export function flush(room: ArenaRoom, store: Map<string, unknown>): void {
  for (const op of room.drainPersist() as PersistOp[]) {
    if (op.value === null) store.delete(op.key);
    else store.set(op.key, JSON.parse(JSON.stringify(op.value)));
  }
}

/** Rebuild a room from a store, as a Durable Object would after eviction. */
export function restoreFrom(store: Map<string, unknown>, env: FakeEnv, opts: Partial<RoomOptions> = {}, tune: Tune = loadTune()): ArenaRoom {
  const meta = store.get('meta') as RoomMeta;
  const log = [...store.keys()]
    .filter((k) => k.startsWith('c:'))
    .sort()
    .map((k) => store.get(k) as LoggedCommand);
  return ArenaRoom.restore({ code: meta.code, tune, ...opts }, env, meta, log);
}
