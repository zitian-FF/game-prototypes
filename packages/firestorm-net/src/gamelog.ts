// The per-match behaviour log of each human player: what they targeted and in what order, how often they attacked,
// scouted, teleported and so on. It is deliberately small (a few KB per player), built from counters the room keeps
// while the match runs and written once when the match ends. Nothing here reaches clients. See RoomEnv.gameLog.

import type { TeamId } from 'arena-sim';

export const GAME_LOG_VERSION = 2;

/** What one accepted order was aimed at, in words that are easy to filter on. */
export type ActionKind =
  | 'capture' // march on a neutral node
  | 'attack' // march on an enemy-held node
  | 'garrison' // march on a node the team holds
  | 'hqAttack' // march on an enemy HQ
  | 'hqGarrison' // march to garrison an allied HQ
  | 'scoutNode'
  | 'scoutHq'
  | 'scoutCache'
  | 'teleport';

export interface TargetEntry {
  /** Sim seconds into the match. */
  t: number;
  a: ActionKind;
  /** Node id, HQ id or cache id. */
  id: string;
  /** Node kind, for node targets. */
  k?: string;
  tier?: number;
}

export interface Counts {
  marches: number;
  captureNeutral: number;
  attackNode: number;
  garrisonOwn: number;
  hqAttack: number;
  hqGarrison: number;
  scoutNode: number;
  scoutHq: number;
  scoutCache: number;
  teleports: number;
  defendToggles: number;
  returns: number;
  /** Orders the sim refused (too early, no free slot, locked node...). */
  rejected: number;
}

/** One change of the player's connection while the match ran: `c` connected (or came back), `d` dropped. */
export interface ConnEvent {
  /** Sim seconds into the match (0 for a player who was already there at the start). */
  t: number;
  e: 'c' | 'd';
}

/** One squad as rolled at the start of the match, before any fighting. */
export interface RolledSquad {
  slot: number;
  type: string;
  rank: number;
  power: number;
  /** 0-100: where the power sits in its own slot's range (100 is the best it could roll). */
  pct: number;
  /** The reveal-card grade the player saw, or null. */
  tier: 'gold' | 'silver' | 'bronze' | null;
}

/** What the room keeps for one human while the match runs. */
export interface LiveLog {
  counts: Counts;
  /** Connection changes since the match began (older stored logs have none). */
  conn?: ConnEvent[];
  targets: TargetEntry[];
  /** Sim second of every accepted order (for pace and idle gaps). */
  times: number[];
}

export type HlogStore = Record<string, LiveLog>;

const MAX_TARGETS = 400;
const MAX_TIMES = 3000;
const MAX_CONN = 60;

export function newLive(): LiveLog {
  return {
    counts: { marches: 0, captureNeutral: 0, attackNode: 0, garrisonOwn: 0, hqAttack: 0, hqGarrison: 0, scoutNode: 0, scoutHq: 0, scoutCache: 0, teleports: 0, defendToggles: 0, returns: 0, rejected: 0 },
    targets: [],
    times: [],
  };
}

/** Note a connect or drop. The first event of a kind that repeats right away is kept, the list is capped. */
export function recordConn(live: LiveLog, tSec: number, e: ConnEvent['e']): void {
  const list = (live.conn ??= []);
  if (list.length > 0 && list[list.length - 1].e === e) return;
  if (list.length < MAX_CONN) list.push({ t: tSec, e });
}

/** Total seconds connected, and how many times the player dropped, from the connection events. */
export function connSummary(conn: ConnEvent[] | undefined, simSeconds: number): { connectedSeconds: number; drops: number } {
  let connected = 0;
  let since: number | null = null;
  let drops = 0;
  for (const ev of conn ?? []) {
    if (ev.e === 'c') since ??= ev.t;
    else {
      drops++;
      if (since !== null) connected += Math.max(0, ev.t - since);
      since = null;
    }
  }
  if (since !== null) connected += Math.max(0, simSeconds - since);
  return { connectedSeconds: Math.round(connected), drops };
}

/** Count one accepted order. `entry` is set for orders that have a target worth keeping in the ordered list. */
export function recordOrder(live: LiveLog, tSec: number, entry: Omit<TargetEntry, 't'> | null, other?: 'defend' | 'return'): void {
  const c = live.counts;
  if (live.times.length < MAX_TIMES) live.times.push(tSec);
  if (other === 'defend') c.defendToggles++;
  else if (other === 'return') c.returns++;
  if (!entry) return;
  switch (entry.a) {
    case 'capture': c.captureNeutral++; c.marches++; break;
    case 'attack': c.attackNode++; c.marches++; break;
    case 'garrison': c.garrisonOwn++; c.marches++; break;
    case 'hqAttack': c.hqAttack++; c.marches++; break;
    case 'hqGarrison': c.hqGarrison++; c.marches++; break;
    case 'scoutNode': c.scoutNode++; break;
    case 'scoutHq': c.scoutHq++; break;
    case 'scoutCache': c.scoutCache++; break;
    case 'teleport': c.teleports++; break;
  }
  if (live.targets.length < MAX_TARGETS) live.targets.push({ t: tSec, ...entry });
}

export interface GameLogRecord {
  v: typeof GAME_LOG_VERSION;
  /** `<room>-<start time in base 36>`: the same for every player of one match. */
  match: string;
  room: string;
  /** ISO time the match started. */
  at: string;
  minutes: number;
  /** How far the sim got, in seconds. */
  simSeconds: number;
  result: 'win' | 'loss' | 'draw' | 'abandoned';
  /** Final team points: the player's team first. */
  points: [number, number];
  humans: number;
  bots: number;
  /** Hash of the browser's random client id: stable for one browser, not reversible to anything. */
  pid: string;
  /** The display name as the player typed it. */
  name: string;
  team: TeamId;
  device: 'touch' | 'desktop' | 'unknown';
  /** Times this player connected: more than 1 means they dropped and came back. */
  joins: number;
  /** Connect and drop events during the match, with the totals worked out from them. */
  connections: ConnEvent[];
  connectedSeconds: number;
  drops: number;
  /** The squads this player was dealt at the start, in slot order. */
  squads: RolledSquad[];
  /** Commander score and the stats behind it, with the leaderboard rank (1 = best) when the match finished. */
  score: { score: number; rank: number | null; nodesCaptured: number; hqsDowned: number; troopsDefeated: number; garrisonSeconds: number; cachePoints: number };
  counts: Counts;
  /** Seconds to the first accepted order, or null if there was none. */
  firstOrderS: number | null;
  /** The longest gap between two accepted orders (or to the end), in seconds. */
  longestIdleS: number;
  /** Accepted orders in each tenth of the match: where the player was active. */
  ordersByTenth: number[];
  /** Ordered list of what the player went for. */
  targets: TargetEntry[];
}

export function paceOf(times: number[], simSeconds: number): { firstOrderS: number | null; longestIdleS: number; ordersByTenth: number[] } {
  const tenth = new Array<number>(10).fill(0);
  let longest = 0;
  let prev = 0;
  const span = Math.max(1, simSeconds);
  for (const t of times) {
    longest = Math.max(longest, t - prev);
    prev = t;
    tenth[Math.min(9, Math.floor((t / span) * 10))]++;
  }
  longest = Math.max(longest, simSeconds - prev);
  return { firstOrderS: times.length ? times[0] : null, longestIdleS: Math.round(longest), ordersByTenth: tenth };
}

/** A fast non-cryptographic 53-bit hash (cyrb53), as 14 hex digits. Pseudonymises the client id. */
export function pseudonym(id: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < id.length; i++) {
    const ch = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, '0');
}
