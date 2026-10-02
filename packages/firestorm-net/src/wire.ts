// What goes over the wire for a team's view: a full WireView on join, then
// ViewPatches. Marching units omit their current position (clients derive it
// from the march record and the synced clock), so a moving army does not make
// every patch differ.

import type {
  CombatLog,
  EnemyHqView,
  EnemyMarchView,
  NodeView,
  OwnHqView,
  OwnScoutView,
  OwnSquadView,
  ScoutReport,
  TeamView,
} from 'arena-sim';

export type WireSquad = Omit<OwnSquadView, 'pos'> & { pos?: OwnSquadView['pos'] };
export type WireEnemyMarch = Omit<EnemyMarchView, 'pos'>;

export interface WireView {
  timeMs: number;
  points: [number, number];
  nodes: NodeView[];
  squads: WireSquad[];
  hqs: OwnHqView[];
  scouts: OwnScoutView[];
  enemyMarches: WireEnemyMarch[];
  enemyHqs: EnemyHqView[];
  scoutReports: ScoutReport[];
  /** Most recent first, capped. */
  combatLogs: CombatLog[];
}

type Collections = {
  nodes: NodeView;
  squads: WireSquad;
  hqs: OwnHqView;
  scouts: OwnScoutView;
  enemyMarches: WireEnemyMarch;
  enemyHqs: EnemyHqView;
  scoutReports: ScoutReport;
  combatLogs: CombatLog;
};
type CollectionName = keyof Collections;

const KEYS: { [K in CollectionName]: (item: Collections[K]) => string } = {
  nodes: (n) => n.id,
  squads: (s) => s.id,
  hqs: (h) => h.id,
  scouts: (s) => `${s.owner}#${s.index}`,
  enemyMarches: (m) => m.id,
  enemyHqs: (h) => h.id,
  scoutReports: (r) => String(r.id),
  combatLogs: (l) => String(l.id),
};
const NAMES = Object.keys(KEYS) as CollectionName[];

export interface ViewPatch {
  timeMs: number;
  points: [number, number];
  upsert: { [K in CollectionName]?: Collections[K][] };
  remove: { [K in CollectionName]?: string[] };
}

export const MAX_WIRE_LOGS = 50;

export function toWire(view: TeamView): WireView {
  return {
    timeMs: view.timeMs,
    points: view.points,
    nodes: view.nodes,
    squads: view.squads.map((s) => {
      if (s.state !== 'march') return s;
      const { pos: _pos, ...rest } = s;
      return rest;
    }),
    hqs: view.hqs,
    scouts: view.scouts,
    enemyMarches: view.enemyMarches.map((m) => {
      const { pos: _pos, ...rest } = m;
      return rest;
    }),
    enemyHqs: view.enemyHqs,
    scoutReports: view.scoutReports,
    combatLogs: view.combatLogs.slice(0, MAX_WIRE_LOGS),
  };
}

function index<K extends CollectionName>(name: K, items: Collections[K][]): Map<string, Collections[K]> {
  const key = KEYS[name] as (i: Collections[K]) => string;
  const m = new Map<string, Collections[K]>();
  for (const it of items) m.set(key(it), it);
  return m;
}

/** What changed between two views. Entries are compared by their JSON. */
export function diffViews(prev: WireView, next: WireView): ViewPatch {
  const patch: ViewPatch = { timeMs: next.timeMs, points: next.points, upsert: {}, remove: {} };
  for (const name of NAMES) {
    const a = index(name, prev[name] as never) as Map<string, unknown>;
    const b = index(name, next[name] as never) as Map<string, unknown>;
    const up: unknown[] = [];
    for (const [k, v] of b) {
      const old = a.get(k);
      if (old === undefined || JSON.stringify(old) !== JSON.stringify(v)) up.push(v);
    }
    const gone: string[] = [];
    for (const k of a.keys()) if (!b.has(k)) gone.push(k);
    if (up.length) (patch.upsert as Record<string, unknown>)[name] = up;
    if (gone.length) (patch.remove as Record<string, unknown>)[name] = gone;
  }
  return patch;
}

/** Apply a patch to a view. Pure: returns a new view and leaves `base` alone. */
export function applyPatch(base: WireView, patch: ViewPatch): WireView {
  const out: WireView = { ...base, timeMs: patch.timeMs, points: patch.points };
  for (const name of NAMES) {
    const up = (patch.upsert as Record<string, unknown[] | undefined>)[name];
    const rm = (patch.remove as Record<string, string[] | undefined>)[name];
    if (!up && !rm) continue;
    const m = index(name, base[name] as never) as Map<string, unknown>;
    for (const k of rm ?? []) m.delete(k);
    const key = KEYS[name] as (i: unknown) => string;
    for (const it of up ?? []) m.set(key(it), it);
    (out as unknown as Record<string, unknown>)[name] = Array.from(m.values());
  }
  return out;
}

/** Order-insensitive equality of two views, for tests and sanity checks. */
export function sameView(a: WireView, b: WireView): boolean {
  if (a.timeMs !== b.timeMs || a.points[0] !== b.points[0] || a.points[1] !== b.points[1]) return false;
  for (const name of NAMES) {
    const x = index(name, a[name] as never) as Map<string, unknown>;
    const y = index(name, b[name] as never) as Map<string, unknown>;
    if (x.size !== y.size) return false;
    for (const [k, v] of x) if (JSON.stringify(y.get(k)) !== JSON.stringify(v)) return false;
  }
  return true;
}
