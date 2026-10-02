import { dist } from './map';
import type { ArenaGame } from './game';
import type {
  CombatLog,
  HqId,
  March,
  NodeId,
  NodeKind,
  RevealedSquad,
  ScoutReport,
  SquadId,
  SquadType,
  TeamId,
  Vec,
} from './types';

export interface NodeView {
  id: NodeId;
  kind: NodeKind;
  pos: Vec;
  /** Owner as the team knows it. Stale when the node is outside vision. */
  owner: TeamId | null;
  /** False if the team has never seen this node, so owner is unknown. */
  explored: boolean;
  visible: boolean;
}

export interface OwnSquadView {
  id: SquadId;
  owner: string;
  type: SquadType;
  rank: number;
  power: number;
  troops: number;
  maxTroops: number;
  defend: boolean;
  pos: Vec;
  state: 'hq' | 'garrison' | 'march';
  nodeId?: NodeId;
  march?: March;
}

export interface EnemyMarchView {
  /** Opaque id: carries no owner, type or power. */
  id: SquadId;
  pos: Vec;
  march: Pick<March, 'from' | 'to' | 'startMs' | 'arriveMs' | 'speed'>;
  /** Present only while a scout reveal on this squad is unexpired. */
  revealed?: RevealedSquad & { expiresAtMs: number };
}

export interface EnemyHqView {
  id: HqId;
  pos: Vec;
}

export interface TeamView {
  timeMs: number;
  points: [number, number];
  nodes: NodeView[];
  /** Every squad on the viewer's team, with full detail. */
  squads: OwnSquadView[];
  /** Enemy marches inside vision, masked unless revealed. */
  enemyMarches: EnemyMarchView[];
  /** Enemy HQs inside vision (including stranded ones), masked. */
  enemyHqs: EnemyHqView[];
  scoutReports: ScoutReport[];
  /** Most recent first. */
  combatLogs: CombatLog[];
}

/**
 * What one team is allowed to know right now. This is the only thing the
 * server sends to that team's players, so hidden state never leaves it.
 */
export function viewFor(game: ArenaGame, team: TeamId): TeamView {
  const now = game.now;

  const nodes: NodeView[] = [];
  for (const n of game.nodes.values()) {
    const visible = n.owner === team || game.isVisibleTo(team, n.pos);
    const known = game.lastKnownOwner[team];
    nodes.push({
      id: n.id,
      kind: n.kind,
      pos: n.pos,
      owner: visible ? n.owner : (known.get(n.id) ?? null),
      explored: visible || known.has(n.id),
      visible,
    });
  }

  const squads: OwnSquadView[] = [];
  const enemyMarches: EnemyMarchView[] = [];
  for (const sq of game.squads.values()) {
    if (sq.team === team) {
      const v: OwnSquadView = {
        id: sq.id,
        owner: sq.owner,
        type: sq.type,
        rank: sq.rank,
        power: sq.power,
        troops: sq.troops,
        maxTroops: sq.maxTroops,
        defend: sq.defend,
        pos: game.squadPos(sq),
        state: sq.state.kind,
      };
      if (sq.state.kind === 'garrison') v.nodeId = sq.state.nodeId;
      if (sq.state.kind === 'march') v.march = sq.state.march;
      squads.push(v);
    } else if (sq.state.kind === 'march') {
      const pos = game.squadPos(sq);
      if (!game.isVisibleTo(team, pos)) continue;
      const m = sq.state.march;
      const view: EnemyMarchView = {
        id: sq.id,
        pos,
        march: { from: m.from, to: m.to, startMs: m.startMs, arriveMs: m.arriveMs, speed: m.speed },
      };
      const rev = game.revealed[team].get(sq.id);
      if (rev && rev.expiresAtMs > now) view.revealed = { ...rev.info, expiresAtMs: rev.expiresAtMs };
      enemyMarches.push(view);
    }
  }

  const enemyHqs: EnemyHqView[] = [];
  for (const p of game.players.values()) {
    if (p.team === team || p.hq.location.kind === 'safe') continue;
    if (game.isVisibleTo(team, p.hq.pos)) enemyHqs.push({ id: p.hq.id, pos: p.hq.pos });
  }

  const reports = game.scoutReports.filter((r) => r.team === team && r.expiresAtMs > now);
  const logs = game.combatLogs
    .filter((l) => l.attacker.team === team || l.fights.some((f) => f.defender.team === team))
    .reverse();

  return {
    timeMs: now,
    points: game.points(),
    nodes,
    squads,
    enemyMarches,
    enemyHqs,
    scoutReports: reports,
    combatLogs: logs,
  };
}

/** Nodes within a turret's reach, handy for UI overlays and bot logic. */
export function nodesWithin(game: ArenaGame, center: Vec, radius: number): NodeId[] {
  const out: NodeId[] = [];
  for (const n of game.nodes.values()) if (dist(n.pos, center) <= radius) out.push(n.id);
  return out;
}
