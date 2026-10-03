// Wire protocol between a firestorm client and its match room. JSON text frames.
// Everything from a client is untrusted: parseClientMsg checks shape and size
// before anything else sees it.

import type { Command, MapDef, MarchTarget, TeamId, Tune } from 'arena-sim';
import type { ClientEvent } from './events';
import type { ViewPatch, WireView } from './wire';

export const PROTOCOL_VERSION = 4;

/** Match lengths a host can choose in the lobby. */
export const MATCH_MINUTES = [10, 15, 20, 30] as const;

export type RoomPhase = 'empty' | 'lobby' | 'countdown' | 'playing' | 'ended';

/** A player command as sent by a client: the server fills in who sent it. */
export type CommandBody =
  | { type: 'march'; squadId: string; target: MarchTarget }
  | { type: 'cancel'; squadId: string }
  | { type: 'teleport'; nodeId: string }
  | { type: 'scout'; scoutIndex: number; target: MarchTarget }
  | { type: 'setDefend'; squadId: string; defend: boolean };

// ------------------------------------------------------------- client -> server

export type ClientMsg =
  | { t: 'hello'; v: number; clientId: string; name: string; create?: boolean }
  | { t: 'start'; fillBots: boolean; minutes: number }
  | { t: 'cancelStart' }
  | { t: 'endRoom' }
  | { t: 'setTeam'; team: TeamId }
  | { t: 'cmd'; id: number; cmd: CommandBody }
  | { t: 'ping'; c: number };

// ------------------------------------------------------------- server -> client

export type ErrorCode =
  | 'badMessage'
  | 'noHello'
  | 'badVersion'
  | 'roomNotFound'
  | 'roomExists'
  | 'roomFull'
  | 'matchInProgress'
  | 'notHost'
  | 'badPhase'
  | 'rateLimited'
  | 'replaced'
  | 'hostLeft'
  | 'roomClosed'
  | 'teamFull';

export interface LobbyPlayer {
  clientId: string;
  name: string;
  connected: boolean;
  /** The team this player will be on. Changeable in the lobby while the other team has room. */
  team: TeamId;
}

export interface MatchStartInfo {
  playerId: string;
  team: TeamId;
  hqId: string;
  tune: Tune;
  map: MapDef;
  /** Names of your own team only; the other team is not disclosed. */
  teammates: string[];
  /** Server wall clock (ms) when sim time was 0, and the sim speed-up. */
  startedAtServerMs: number;
  timeScale: number;
}

export type ServerMsg =
  | { t: 'welcome'; v: number; room: string; clientId: string; isHost: boolean; serverNow: number }
  | {
      t: 'lobby';
      phase: RoomPhase;
      hostId: string | null;
      players: LobbyPlayer[];
      maxPlayers: number;
      /** Server wall ms when the start countdown ends, while phase is countdown. */
      countdownEndsAtMs?: number;
      fillBots: boolean;
      /** Chosen match length. */
      minutes: number;
    }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'matchStart'; info: MatchStartInfo }
  | {
      t: 'state';
      full: boolean;
      /** Sim time (ms) this view is for, and the server wall clock when sent. */
      simMs: number;
      serverNow: number;
      view?: WireView;
      patch?: ViewPatch;
      events: ClientEvent[];
    }
  | { t: 'cmdResult'; id: number; ok: boolean; error?: string }
  | { t: 'pong'; c: number; s: number };

// ----------------------------------------------------------------- validation

export const MAX_MESSAGE_BYTES = 2048;
const MAX_NAME = 20;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const REF_RE = /^[A-Za-z0-9_:#-]{1,32}$/;

export type ParseResult = { ok: true; msg: ClientMsg } | { ok: false; message: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseTarget(v: unknown): MarchTarget | null {
  if (!isObj(v)) return null;
  if (v.kind === 'node' && typeof v.nodeId === 'string' && REF_RE.test(v.nodeId)) return { kind: 'node', nodeId: v.nodeId };
  if (v.kind === 'hq' && typeof v.hqId === 'string' && REF_RE.test(v.hqId)) return { kind: 'hq', hqId: v.hqId };
  return null;
}

function parseCommand(v: unknown): CommandBody | null {
  if (!isObj(v)) return null;
  const ref = (x: unknown): x is string => typeof x === 'string' && REF_RE.test(x);
  switch (v.type) {
    case 'march': {
      const target = parseTarget(v.target);
      return ref(v.squadId) && target ? { type: 'march', squadId: v.squadId, target } : null;
    }
    case 'cancel':
      return ref(v.squadId) ? { type: 'cancel', squadId: v.squadId } : null;
    case 'teleport':
      return ref(v.nodeId) ? { type: 'teleport', nodeId: v.nodeId } : null;
    case 'scout': {
      const target = parseTarget(v.target);
      const i = v.scoutIndex;
      return typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < 16 && target
        ? { type: 'scout', scoutIndex: i, target }
        : null;
    }
    case 'setDefend':
      return ref(v.squadId) && typeof v.defend === 'boolean' ? { type: 'setDefend', squadId: v.squadId, defend: v.defend } : null;
    default:
      return null;
  }
}

/** Trim, collapse whitespace and strip control characters from a display name. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

export function parseClientMsg(raw: string): ParseResult {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return { ok: false, message: 'message too large' };
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'not json' };
  }
  if (!isObj(v) || typeof v.t !== 'string') return { ok: false, message: 'missing type' };
  switch (v.t) {
    case 'hello': {
      if (typeof v.v !== 'number' || typeof v.clientId !== 'string' || !ID_RE.test(v.clientId) || typeof v.name !== 'string') {
        return { ok: false, message: 'bad hello' };
      }
      const name = cleanName(v.name);
      if (!name) return { ok: false, message: 'empty name' };
      return { ok: true, msg: { t: 'hello', v: v.v, clientId: v.clientId, name, create: v.create === true } };
    }
    case 'start': {
      const minutes = v.minutes;
      if (typeof v.fillBots !== 'boolean' || typeof minutes !== 'number' || !(MATCH_MINUTES as readonly number[]).includes(minutes)) {
        return { ok: false, message: 'bad start' };
      }
      return { ok: true, msg: { t: 'start', fillBots: v.fillBots, minutes } };
    }
    case 'cancelStart':
      return { ok: true, msg: { t: 'cancelStart' } };
    case 'endRoom':
      return { ok: true, msg: { t: 'endRoom' } };
    case 'setTeam':
      return v.team === 0 || v.team === 1 ? { ok: true, msg: { t: 'setTeam', team: v.team } } : { ok: false, message: 'bad team' };
    case 'cmd': {
      const cmd = parseCommand(v.cmd);
      if (!cmd || typeof v.id !== 'number' || !Number.isInteger(v.id)) return { ok: false, message: 'bad command' };
      return { ok: true, msg: { t: 'cmd', id: v.id, cmd } };
    }
    case 'ping':
      return typeof v.c === 'number' && Number.isFinite(v.c) ? { ok: true, msg: { t: 'ping', c: v.c } } : { ok: false, message: 'bad ping' };
    default:
      return { ok: false, message: 'unknown type' };
  }
}

/** Attach the sender's player id to a client command. */
export function toSimCommand(body: CommandBody, playerId: string): Command {
  return { ...body, playerId } as Command;
}
