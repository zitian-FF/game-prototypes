import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArenaGame } from '../src/game';
import type { Command, CommandResult, GameEvent, MapDef, NodeKind, PlayerSpec, SquadSpec, SquadType, TeamId, Tune } from '../src/types';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The prototype's real tune.json: the single source of truth for numbers. */
export function loadTune(): Tune {
  const file = path.resolve(here, '../../../prototypes/firestorm-arena/tune.json');
  return JSON.parse(readFileSync(file, 'utf8')) as Tune;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function withTune(overrides: DeepPartial<Tune> = {}): Tune {
  const merge = (base: any, over: any): any => {
    const out = Array.isArray(base) ? base.slice() : { ...base };
    for (const k of Object.keys(over)) {
      const v = over[k];
      out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base[k] ?? {}, v) : v;
    }
    return out;
  };
  return merge(loadTune(), overrides) as Tune;
}

/** Deterministic tune for scenarios: no combat variance. */
export function scenarioTune(overrides: DeepPartial<Tune> = {}): Tune {
  // Scenarios start with every tier open; escalation has its own tests.
  return withTune({ combat: { variance: 0 }, phases: { tier3UnlockRemaining: 1, tier4UnlockRemaining: 1 }, ...overrides });
}

export interface NodeDef {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  /** 1-4, default 1. */
  tier?: number;
}

/** Small hand-built map (25 x 15 cells): team 0 safe zone on the left, team 1 on the right. */
export function testMap(nodes: NodeDef[]): MapDef {
  const cell = 40;
  const zone = (cx: number, cy: number): MapDef['safeZones'][0] => ({
    origin: { cx, cy },
    cols: 5,
    rows: 4,
    center: { x: (cx + 2 + 0.5) * cell, y: (cy + 1.5 + 0.5) * cell },
  });
  return {
    width: 1000,
    height: 600,
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      tier: n.tier ?? 1,
      cell: { cx: Math.floor(n.x / cell), cy: Math.floor(n.y / cell) },
      pos: { x: n.x, y: n.y },
    })),
    safeZones: [zone(1, 5), zone(19, 6)],
  };
}

export interface SquadDef {
  type?: SquadType;
  power: number;
  troops?: number;
}

export function player(id: string, team: TeamId, squads: SquadDef[], pool = 45000): PlayerSpec {
  const specs: SquadSpec[] = squads.map((s) => ({
    type: s.type ?? 'tank',
    rank: 10,
    power: s.power,
    maxTroops: s.troops ?? 3000,
  }));
  return { id, team, pool, squads: specs };
}

export function makeGame(opts: { nodes: NodeDef[]; players: PlayerSpec[]; tune?: Tune; seed?: number }): ArenaGame {
  return new ArenaGame({
    seed: opts.seed ?? 1,
    tune: opts.tune ?? scenarioTune(),
    map: testMap(opts.nodes),
    players: opts.players,
  });
}

/** Issue a command, failing loudly if it is rejected. */
export function must(g: ArenaGame, cmd: Command): GameEvent[] {
  const r: CommandResult = g.command(cmd);
  if (!r.ok) throw new Error(`command ${cmd.type} rejected: ${r.error}`);
  return r.events;
}

export function err(g: ArenaGame, cmd: Command): string {
  const r = g.command(cmd);
  if (r.ok) throw new Error(`command ${cmd.type} unexpectedly accepted`);
  return r.error;
}

/** Arrival time (ms) of a squad's current march. */
export function arrival(g: ArenaGame, squadId: string): number {
  const sq = g.squads.get(squadId)!;
  if (sq.state.kind !== 'march') throw new Error(`${squadId} is not marching`);
  return sq.state.march.arriveMs;
}

/** March a squad to a node and advance until it arrives. */
export function marchAndArrive(g: ArenaGame, playerId: string, squadId: string, nodeId: string): GameEvent[] {
  must(g, { type: 'march', playerId, squadId, target: { kind: 'node', nodeId } });
  return g.advanceTo(arrival(g, squadId));
}

export const SQUAD_ID = (n: number) => `s${n}`;

/** Send a squad home (from the field or a garrison) and advance until it is back at the HQ. */
export function recallHome(g: ArenaGame, playerId: string, squadId: string): GameEvent[] {
  must(g, { type: 'cancel', playerId, squadId });
  return g.advanceTo(arrival(g, squadId));
}
