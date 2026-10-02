// One match room: lobby, start countdown, the running match, bots, and the
// fog-filtered stream sent to each team. It knows nothing about Cloudflare:
// the host talks to it through RoomEnv and a handful of methods, so the same
// code runs in a Durable Object and in plain Node tests.
//
// Persistence is a replay log. A match is fully determined by its seed, its
// roster and the accepted commands with their sim times, so the Durable Object
// stores just those (drainPersist) and ArenaRoom.restore() rebuilds the game
// exactly after the object was evicted.

import { ArenaGame, Rng, generateMap, rollPlayers, viewFor } from 'arena-sim';
import type { Command, GameEvent, PlayerSpec, TeamId, TeamView, Tune } from 'arena-sim';
import { BotBrain } from './bot';
import { projectEvents } from './events';
import type { ClientEvent } from './events';
import { PROTOCOL_VERSION, cleanName, parseClientMsg, toSimCommand } from './protocol';
import type { CommandBody, ErrorCode, LobbyPlayer, MatchStartInfo, RoomPhase, ServerMsg } from './protocol';
import { applyPatch, diffViews, toWire } from './wire';
import type { WireView } from './wire';

export interface RoomEnv {
  send(connId: string, data: string): void;
  close(connId: string, code: number, reason: string): void;
  /** Wall clock in ms. */
  now(): number;
  /** Uniform [0, 1). */
  random(): number;
  /** Called once a socket has said who it is, so the host can remember it across hibernation. */
  identified?(connId: string, clientId: string): void;
}

export interface RoomOptions {
  code: string;
  tune: Tune;
  /** Sim seconds per real second. 1 in production; larger only for tests. */
  timeScale?: number;
  maxHumans?: number;
  /** How long a lobby waits for a disconnected host before closing. */
  hostGraceMs?: number;
  /** A running match with no human connected for this long is abandoned. */
  abandonMs?: number;
  /** How long the room lingers after a match ends. */
  closeAfterEndMs?: number;
  /** Minimum wall ms between state broadcasts while playing (view refresh). */
  pulseMs?: number;
  /** Sim ms between bot decisions. */
  botThinkSimMs?: number;
  /** Per-connection message budget. */
  burst?: number;
  perSecond?: number;
}

export interface PersistOp {
  key: string;
  /** null deletes the key. */
  value: unknown | null;
}

interface MatchPlayer {
  id: string;
  name: string;
  bot: boolean;
  team: TeamId;
  clientId?: string;
}

interface MatchMeta {
  seed: number;
  startedAtMs: number;
  timeScale: number;
  tune: Tune;
  /** In the order passed to the roster roll, which the sim depends on. */
  players: MatchPlayer[];
  endedAtMs?: number;
}

export interface RoomMeta {
  code: string;
  phase: RoomPhase | 'closed';
  hostId: string | null;
  humans: { clientId: string; name: string }[];
  fillBots: boolean;
  countdownEndsAtMs?: number;
  hostGoneAtMs?: number;
  match?: MatchMeta;
}

export interface LoggedCommand {
  t: number;
  c: Command;
}

interface Conn {
  clientId: string | null;
  tokens: number;
  refilledAt: number;
}

interface Human {
  clientId: string;
  name: string;
  connected: boolean;
}

const CLOSE_NORMAL = 1000;
const CLOSE_POLICY = 1008;
const CLOSE_REPLACED = 4001;

const BOT_NAMES = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet',
  'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango',
  'Uniform', 'Victor', 'Whiskey', 'Xray', 'Yankee', 'Zulu',
];

export const cmdKey = (n: number) => `c:${String(n).padStart(6, '0')}`;

export class ArenaRoom {
  readonly code: string;
  private readonly tune: Tune;
  private readonly env: RoomEnv;
  private readonly opt: Required<Omit<RoomOptions, 'code' | 'tune'>>;

  private phase: RoomPhase | 'closed' = 'empty';
  private hostId: string | null = null;
  private fillBots = false;
  private countdownEndsAtMs: number | undefined;
  private hostGoneAtMs: number | undefined;
  private noHumansSinceMs: number | undefined;

  private readonly conns = new Map<string, Conn>();
  private readonly clientConn = new Map<string, string>();
  private readonly humans = new Map<string, Human>();

  private match: MatchMeta | undefined;
  private game: ArenaGame | undefined;
  private playerOfClient = new Map<string, string>();
  private teamOfPlayer = new Map<string, TeamId>();
  private bots = new Map<string, BotBrain>();
  private nextBotSimMs = 0;
  private lastBroadcastWall = 0;
  private prevWire: [WireView | null, WireView | null] = [null, null];
  private cmdCount = 0;
  private persist: PersistOp[] = [];
  /** Commands from the log that the restored sim rejected, so diverged replays are visible. */
  replayMismatches = 0;

  constructor(opts: RoomOptions, env: RoomEnv) {
    this.code = opts.code;
    this.tune = opts.tune;
    this.env = env;
    this.opt = {
      timeScale: opts.timeScale ?? 1,
      maxHumans: opts.maxHumans ?? opts.tune.match.playersPerTeam * 2,
      hostGraceMs: opts.hostGraceMs ?? 60_000,
      abandonMs: opts.abandonMs ?? 10 * 60_000,
      closeAfterEndMs: opts.closeAfterEndMs ?? 15 * 60_000,
      pulseMs: opts.pulseMs ?? 1000,
      botThinkSimMs: opts.botThinkSimMs ?? 4000,
      burst: opts.burst ?? 40,
      perSecond: opts.perSecond ?? 20,
    };
  }

  // ------------------------------------------------------------ persistence

  /** Rebuild a room from what a previous incarnation persisted. */
  static restore(opts: RoomOptions, env: RoomEnv, meta: RoomMeta, log: LoggedCommand[]): ArenaRoom {
    const room = new ArenaRoom(opts, env);
    room.phase = meta.phase;
    room.hostId = meta.hostId;
    room.fillBots = meta.fillBots;
    room.countdownEndsAtMs = meta.countdownEndsAtMs;
    room.hostGoneAtMs = meta.hostGoneAtMs;
    room.cmdCount = log.length;
    for (const h of meta.humans) room.humans.set(h.clientId, { clientId: h.clientId, name: h.name, connected: false });
    if (meta.match) {
      room.match = meta.match;
      room.indexPlayers(meta.match);
      room.game = ArenaRoom.buildGame(meta.match);
      for (const entry of log) {
        room.game.advanceTo(entry.t);
        const r = room.game.command(entry.c);
        if (!r.ok) room.replayMismatches++;
      }
      if (meta.phase === 'playing') {
        room.initBots(meta.match);
        room.nextBotSimMs = room.game.now + room.opt.botThinkSimMs;
      }
    }
    room.noHumansSinceMs = env.now();
    return room;
  }

  /** Writes the host should flush to storage. Clears the queue. */
  drainPersist(): PersistOp[] {
    const ops = this.persist;
    this.persist = [];
    return ops;
  }

  private saveMeta(): void {
    this.persist.push({ key: 'meta', value: this.meta() });
  }

  meta(): RoomMeta {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      humans: [...this.humans.values()].map((h) => ({ clientId: h.clientId, name: h.name })),
      fillBots: this.fillBots,
      countdownEndsAtMs: this.countdownEndsAtMs,
      hostGoneAtMs: this.hostGoneAtMs,
      match: this.match,
    };
  }

  // ------------------------------------------------------------ reading

  get currentPhase(): RoomPhase | 'closed' {
    return this.phase;
  }

  /** The live sim, for tests and tooling. */
  get sim(): ArenaGame | undefined {
    return this.game;
  }

  shouldDestroy(): boolean {
    return this.phase === 'closed';
  }

  /** Wall ms at which the host should wake the room next, or null if nothing is pending. */
  nextWakeAt(): number | null {
    const wakes: number[] = [];
    const m = this.match;
    if (this.phase === 'countdown' && this.countdownEndsAtMs !== undefined) wakes.push(this.countdownEndsAtMs);
    if (this.phase === 'lobby' && this.hostGoneAtMs !== undefined) wakes.push(this.hostGoneAtMs + this.opt.hostGraceMs);
    if (this.phase === 'playing' && m && this.game) {
      if (this.connectedHumans() > 0) {
        // One wake per broadcast pulse. The sim stamps every event with its own time, so
        // processing a batch late gives exactly the same match; it only delays when players
        // hear about it, by at most one pulse. Far fewer alarms than one per game event.
        // Bots decide on these wakes too (their 4 sim second cadence is coarser than a pulse).
        wakes.push(Math.ceil(this.lastBroadcastWall + this.opt.pulseMs));
      } else if (this.noHumansSinceMs !== undefined) {
        // Nobody is watching: stop waking for the sim (it catches up when someone returns).
        wakes.push(this.noHumansSinceMs + this.opt.abandonMs);
      }
    }
    if (this.phase === 'ended' && m?.endedAtMs !== undefined) wakes.push(m.endedAtMs + this.opt.closeAfterEndMs);
    return wakes.length ? Math.min(...wakes) : null;
  }

  // ------------------------------------------------------------ connections

  onConnect(connId: string): void {
    this.conns.set(connId, { clientId: null, tokens: this.opt.burst, refilledAt: this.env.now() });
  }

  /** After a restore: bind a socket that survived to the client it belongs to. */
  attachRestored(connId: string, clientId: string): void {
    this.conns.set(connId, { clientId, tokens: this.opt.burst, refilledAt: this.env.now() });
    this.clientConn.set(clientId, connId);
    const h = this.humans.get(clientId);
    if (h) h.connected = true;
    this.noHumansSinceMs = undefined;
    if (clientId === this.hostId) this.hostGoneAtMs = undefined;
  }

  onClose(connId: string): void {
    const conn = this.conns.get(connId);
    this.conns.delete(connId);
    if (!conn?.clientId) return;
    const clientId = conn.clientId;
    if (this.clientConn.get(clientId) !== connId) return; // already replaced by a newer socket
    this.clientConn.delete(clientId);
    const h = this.humans.get(clientId);
    if (!h) return;
    h.connected = false;
    const now = this.env.now();
    if (this.phase === 'lobby') {
      if (clientId === this.hostId) this.hostGoneAtMs = now;
      else this.humans.delete(clientId);
      this.saveMeta();
      this.sendLobby();
    } else if (this.phase === 'countdown') {
      this.saveMeta();
      this.sendLobby();
    }
    if (this.connectedHumans() === 0) this.noHumansSinceMs = now;
  }

  private connectedHumans(): number {
    let n = 0;
    for (const h of this.humans.values()) if (h.connected) n++;
    return n;
  }

  // ------------------------------------------------------------ messages

  onMessage(connId: string, raw: string): void {
    const conn = this.conns.get(connId);
    if (!conn || this.phase === 'closed') return;

    const now = this.env.now();
    conn.tokens = Math.min(this.opt.burst, conn.tokens + ((now - conn.refilledAt) / 1000) * this.opt.perSecond);
    conn.refilledAt = now;
    if (conn.tokens < 1) return this.error(connId, 'rateLimited', 'too many messages');
    conn.tokens -= 1;

    const parsed = parseClientMsg(raw);
    if (!parsed.ok) return this.error(connId, 'badMessage', parsed.message);
    const msg = parsed.msg;

    if (msg.t === 'hello') return this.onHello(connId, conn, msg);
    if (!conn.clientId) return this.error(connId, 'noHello', 'send hello first');
    const clientId = conn.clientId;

    switch (msg.t) {
      case 'ping':
        return this.send(connId, { t: 'pong', c: msg.c, s: now });
      case 'start':
        return this.onStart(connId, clientId, msg.fillBots);
      case 'cancelStart':
        return this.onCancelStart(connId, clientId);
      case 'cmd':
        return this.onCommand(connId, clientId, msg.id, msg.cmd);
    }
  }

  private onHello(connId: string, conn: Conn, msg: { v: number; clientId: string; name: string; create?: boolean }): void {
    if (msg.v !== PROTOCOL_VERSION) return this.fail(connId, 'badVersion', `protocol ${PROTOCOL_VERSION} required`);
    const known = this.humans.get(msg.clientId);

    if (this.phase === 'empty') {
      if (!msg.create) return this.fail(connId, 'roomNotFound', 'no such room');
      this.phase = 'lobby';
      this.hostId = msg.clientId;
    } else if (this.phase === 'lobby' || this.phase === 'countdown') {
      if (msg.create && !known && this.hostId !== msg.clientId) return this.fail(connId, 'roomExists', 'room code already in use');
      if (!known && this.humans.size >= this.opt.maxHumans) return this.fail(connId, 'roomFull', 'room is full');
    } else if (!known) {
      return this.fail(connId, 'matchInProgress', 'match already started');
    }

    // One live socket per client: a newer one replaces the older.
    const old = this.clientConn.get(msg.clientId);
    if (old && old !== connId) {
      this.error(old, 'replaced', 'signed in elsewhere');
      this.env.close(old, CLOSE_REPLACED, 'replaced');
      this.conns.delete(old);
    }

    const name = known?.name ?? msg.name;
    this.humans.set(msg.clientId, { clientId: msg.clientId, name, connected: true });
    conn.clientId = msg.clientId;
    this.clientConn.set(msg.clientId, connId);
    this.env.identified?.(connId, msg.clientId);
    this.noHumansSinceMs = undefined;
    if (msg.clientId === this.hostId) this.hostGoneAtMs = undefined;

    this.send(connId, {
      t: 'welcome',
      v: PROTOCOL_VERSION,
      room: this.code,
      clientId: msg.clientId,
      isHost: msg.clientId === this.hostId,
      serverNow: this.env.now(),
    });
    this.saveMeta();
    this.sendLobby();
    if ((this.phase === 'playing' || this.phase === 'ended') && this.match && this.game) {
      if (this.phase === 'playing') {
        this.advance();
        this.pending = []; // nobody was listening, or they already saw these
        if (this.game.result) {
          this.phase = 'ended';
          this.match.endedAtMs = this.env.now();
          this.saveMeta();
          this.sendLobby();
        }
      }
      this.sendMatchStart(connId, msg.clientId);
      this.sendFullState(connId, msg.clientId);
    }
  }

  private onStart(connId: string, clientId: string, fillBots: boolean): void {
    if (clientId !== this.hostId) return this.error(connId, 'notHost', 'only the host can start');
    if (this.phase !== 'lobby') return this.error(connId, 'badPhase', 'not in the lobby');
    this.phase = 'countdown';
    this.fillBots = fillBots;
    this.countdownEndsAtMs = this.env.now() + this.tune.match.startCancelSeconds * 1000;
    this.saveMeta();
    this.sendLobby();
  }

  private onCancelStart(connId: string, clientId: string): void {
    if (clientId !== this.hostId) return this.error(connId, 'notHost', 'only the host can cancel');
    if (this.phase !== 'countdown') return this.error(connId, 'badPhase', 'no countdown to cancel');
    this.phase = 'lobby';
    this.countdownEndsAtMs = undefined;
    this.saveMeta();
    this.sendLobby();
  }

  private onCommand(connId: string, clientId: string, id: number, body: CommandBody): void {
    const playerId = this.playerOfClient.get(clientId);
    if (this.phase !== 'playing' || !this.game || !playerId) {
      this.send(connId, { t: 'cmdResult', id, ok: false, error: 'notPlaying' });
      return;
    }
    this.advance();
    const result = this.applyCommand(toSimCommand(body, playerId));
    this.send(connId, { t: 'cmdResult', id, ok: result.ok, error: result.ok ? undefined : result.error });
    this.afterChange(result.ok ? result.events : []);
  }

  // ------------------------------------------------------------ time

  /** Run whatever is due: countdown end, host grace, abandonment, sim events, bots. */
  onAlarm(): void {
    const now = this.env.now();
    if (this.phase === 'countdown' && this.countdownEndsAtMs !== undefined && now >= this.countdownEndsAtMs) {
      this.beginMatch();
      return;
    }
    if (this.phase === 'lobby' && this.hostGoneAtMs !== undefined && now >= this.hostGoneAtMs + this.opt.hostGraceMs) {
      this.close('hostLeft', 'host left the lobby');
      return;
    }
    if (this.phase === 'playing') {
      if (this.connectedHumans() === 0 && this.noHumansSinceMs !== undefined && now >= this.noHumansSinceMs + this.opt.abandonMs) {
        this.close('roomClosed', 'everyone left');
        return;
      }
      this.advance();
      this.afterChange([]);
      return;
    }
    if (this.phase === 'ended' && this.match?.endedAtMs !== undefined && now >= this.match.endedAtMs + this.opt.closeAfterEndMs) {
      this.close('roomClosed', 'room expired');
    }
  }

  /** Bring the sim up to the wall clock and run any bots that are due. */
  private advance(): void {
    const g = this.game;
    const m = this.match;
    if (!g || !m || this.phase !== 'playing') return;
    // A sliver of slack stops floating point from leaving an event due at exactly this instant unprocessed.
    const wallSim = (this.env.now() - m.startedAtMs) * m.timeScale + 1e-6;
    const simNow = Math.min(this.tune.match.durationSeconds * 1000, Math.max(g.now, wallSim));
    this.pending.push(...g.advanceTo(simNow));
    if (!g.result && simNow >= this.nextBotSimMs) {
      this.nextBotSimMs = simNow + this.opt.botThinkSimMs;
      this.runBots();
    }
  }

  private pending: GameEvent[] = [];

  // ------------------------------------------------------------ match

  private static buildGame(m: MatchMeta): ArenaGame {
    const tune = m.tune;
    const map = generateMap(new Rng(m.seed), tune);
    const rolled = rollPlayers(new Rng(m.seed + 1), tune, m.players.map((p) => p.id));
    const teamOf = new Map(m.players.map((p) => [p.id, p.team] as const));
    const players: PlayerSpec[] = rolled.map((p) => ({ ...p, team: teamOf.get(p.id)! }));
    return new ArenaGame({ seed: m.seed, tune, map, players });
  }

  private indexPlayers(m: MatchMeta): void {
    this.playerOfClient = new Map();
    this.teamOfPlayer = new Map();
    for (const p of m.players) {
      this.teamOfPlayer.set(p.id, p.team);
      if (p.clientId) this.playerOfClient.set(p.clientId, p.id);
    }
  }

  private initBots(m: MatchMeta): void {
    this.bots = new Map();
    for (const p of m.players) if (p.bot) this.bots.set(p.id, new BotBrain(p.id, new Rng(m.seed ^ hash(p.id))));
  }

  private beginMatch(): void {
    const humans = [...this.humans.values()].filter((h) => h.connected);
    if (humans.length === 0) {
      this.phase = 'lobby';
      this.countdownEndsAtMs = undefined;
      this.saveMeta();
      return;
    }
    const seed = Math.floor(this.env.random() * 0x7fffffff);
    const rng = new Rng(seed ^ 0x9e3779b9);
    const used = new Set<string>();
    const unique = (base: string) => {
      let name = base;
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 16)} (${n})`;
      used.add(name.toLowerCase());
      return name;
    };

    const roster: MatchPlayer[] = [];
    for (const h of rng.shuffle(humans)) {
      const id = unique(h.name);
      roster.push({ id, name: id, bot: false, team: 0, clientId: h.clientId });
    }
    if (this.fillBots) {
      const total = this.tune.match.playersPerTeam * 2;
      for (let i = 0; roster.length < total; i++) {
        const id = unique(`Bot ${BOT_NAMES[i % BOT_NAMES.length]}${i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : ''}`);
        roster.push({ id, name: id, bot: true, team: 0 });
      }
    }
    // Alternate teams down the list: humans first, so they are split evenly, then bots fill.
    roster.forEach((p, i) => (p.team = (i % 2) as TeamId));

    this.match = { seed, startedAtMs: this.env.now(), timeScale: this.opt.timeScale, tune: this.tune, players: roster };
    this.indexPlayers(this.match);
    this.game = ArenaRoom.buildGame(this.match);
    this.initBots(this.match);
    this.nextBotSimMs = this.opt.botThinkSimMs;
    this.phase = 'playing';
    this.countdownEndsAtMs = undefined;
    this.cmdCount = 0;
    this.prevWire = [null, null];
    this.pending = [];
    this.saveMeta();
    this.sendLobby();
    for (const h of humans) {
      const connId = this.clientConn.get(h.clientId);
      if (connId) this.sendMatchStart(connId, h.clientId);
    }
    for (const h of humans) {
      const connId = this.clientConn.get(h.clientId);
      if (connId) this.sendFullState(connId, h.clientId);
    }
    this.lastBroadcastWall = this.env.now();
  }

  private runBots(): void {
    const g = this.game;
    const m = this.match;
    if (!g || !m) return;
    const views: [TeamView | null, TeamView | null] = [null, null];
    // Bots decide one after another from the same view, so a team shares one set of claims.
    const claims: [Map<string, number>, Map<string, number>] = [new Map(), new Map()];
    for (const [playerId, brain] of this.bots) {
      const team = this.teamOfPlayer.get(playerId)!;
      const view = (views[team] ??= viewFor(g, team));
      const commands = brain.think({ playerId, team, view, tune: this.tune, speed: g.marchSpeed, nowMs: g.now, claims: claims[team] });
      for (const body of commands) {
        const r = this.applyCommand(toSimCommand(body, playerId));
        if (r.ok) this.pending.push(...r.events);
      }
    }
  }

  /** Apply a command at the current sim time and log it for replay if it was accepted. */
  private applyCommand(cmd: Command) {
    const g = this.game!;
    const r = g.command(cmd);
    if (r.ok) {
      this.persist.push({ key: cmdKey(this.cmdCount++), value: { t: g.now, c: cmd } satisfies LoggedCommand });
    }
    return r;
  }

  private afterChange(extra: GameEvent[]): void {
    const g = this.game;
    if (!g) return;
    const events = [...this.pending, ...extra];
    this.pending = [];
    this.broadcastState(events);
    if (g.result && this.phase === 'playing') {
      this.phase = 'ended';
      if (this.match) this.match.endedAtMs = this.env.now();
      this.saveMeta();
      this.sendLobby();
    }
  }

  // ------------------------------------------------------------ sending

  private send(connId: string, msg: ServerMsg): void {
    this.env.send(connId, JSON.stringify(msg));
  }

  private error(connId: string, code: ErrorCode, message: string): void {
    this.send(connId, { t: 'error', code, message });
  }

  /** A fatal error: tell the client, then drop it. */
  private fail(connId: string, code: ErrorCode, message: string): void {
    this.error(connId, code, message);
    this.env.close(connId, CLOSE_POLICY, code);
    this.conns.delete(connId);
  }

  private lobbyMsg(): ServerMsg {
    const players: LobbyPlayer[] = [...this.humans.values()].map((h) => ({ clientId: h.clientId, name: h.name, connected: h.connected }));
    return {
      t: 'lobby',
      phase: this.phase === 'closed' ? 'ended' : this.phase,
      hostId: this.hostId,
      players,
      maxPlayers: this.opt.maxHumans,
      countdownEndsAtMs: this.phase === 'countdown' ? this.countdownEndsAtMs : undefined,
      fillBots: this.fillBots,
    };
  }

  private sendLobby(): void {
    const data = JSON.stringify(this.lobbyMsg());
    for (const [connId, conn] of this.conns) if (conn.clientId) this.env.send(connId, data);
  }

  private sendMatchStart(connId: string, clientId: string): void {
    const m = this.match;
    const g = this.game;
    const playerId = this.playerOfClient.get(clientId);
    if (!m || !g || !playerId) return;
    const player = g.players.get(playerId)!;
    const info: MatchStartInfo = {
      playerId,
      team: player.team,
      hqId: player.hq.id,
      tune: m.tune,
      map: g.map,
      teammates: m.players.filter((p) => p.team === player.team && p.id !== playerId).map((p) => p.name),
      startedAtServerMs: m.startedAtMs,
      timeScale: m.timeScale,
    };
    this.send(connId, { t: 'matchStart', info });
  }

  /** A full snapshot for one connection, after bringing every teammate to the same base. */
  private sendFullState(connId: string, clientId: string): void {
    const g = this.game;
    const playerId = this.playerOfClient.get(clientId);
    if (!g || !playerId) return;
    const team = this.teamOfPlayer.get(playerId)!;
    // Existing teammates get a normal patch so everyone shares one base, then the newcomer gets that base whole.
    this.broadcastTeam(team, [], connId);
    const view = this.prevWire[team];
    if (!view) return;
    this.send(connId, { t: 'state', full: true, simMs: g.now, serverNow: this.env.now(), view, events: [] });
  }

  private broadcastState(events: GameEvent[]): void {
    this.lastBroadcastWall = this.env.now();
    for (const team of [0, 1] as const) this.broadcastTeam(team, events);
  }

  /** Send a team its patch and filtered events, skipping `exclude` (a socket about to get a full snapshot). */
  private broadcastTeam(team: TeamId, events: GameEvent[], exclude?: string): void {
    const g = this.game;
    if (!g) return;
    const conns: string[] = [];
    for (const h of this.humans.values()) {
      if (!h.connected) continue;
      const playerId = this.playerOfClient.get(h.clientId);
      const connId = this.clientConn.get(h.clientId);
      if (playerId && connId && this.teamOfPlayer.get(playerId) === team) conns.push(connId);
    }
    const audience = conns.filter((c) => c !== exclude);
    if (conns.length === 0) {
      this.prevWire[team] = null;
      return;
    }
    const wire = toWire(viewFor(g, team));
    const prev = this.prevWire[team];
    this.prevWire[team] = wire;
    if (audience.length === 0) return;
    const projected: ClientEvent[] = projectEvents(g, team, events);
    const base = { t: 'state' as const, simMs: g.now, serverNow: this.env.now(), events: projected };
    const msg: ServerMsg = prev
      ? { ...base, full: false, patch: diffViews(prev, wire) }
      : { ...base, full: true, view: wire };
    const data = JSON.stringify(msg);
    for (const c of audience) this.env.send(c, data);
  }

  private close(code: ErrorCode, message: string): void {
    for (const [connId] of this.conns) {
      this.error(connId, code, message);
      this.env.close(connId, CLOSE_NORMAL, code);
    }
    this.conns.clear();
    this.clientConn.clear();
    this.phase = 'closed';
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export { cleanName, applyPatch };
