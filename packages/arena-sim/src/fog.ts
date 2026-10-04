import { dist } from './map';
import type { ArenaGame } from './game';
import type {
  Cache,
  CombatLog,
  HqId,
  HqLocation,
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
  /** 1-4: number of stacked cubes to draw. */
  tier: number;
  pos: Vec;
  /** Which team holds the node. Public to everyone, with or without vision. */
  owner: TeamId | null;
  /** Always true: node ownership is global. Kept for wire compatibility. */
  explored: boolean;
  visible: boolean;
  /**
   * Defenders garrisoned here. Exact for your own team's nodes. For anyone
   * else's it is only present while a scout report on the node is live, and
   * is the count at the time of the scout.
   */
  garrisonCount?: number;
  garrisonCountAsOfMs?: number;
  /** Present while the node is still locked: the sim time it opens for capture. Public. */
  unlocksAtMs?: number;
  /**
   * Score pool state, only while the node is inside your vision. Before the pool opens, settlesAtMs says when;
   * once it is open, pool is its temporary score.
   */
  settlesAtMs?: number;
  pool?: number;
  poolOpen?: boolean;
}

/** A score cache inside your vision. Anyone's scout can collect it. */
export interface CacheView {
  id: string;
  nodeId: NodeId;
  pos: Vec;
  /** What touching it banks for a scout's team. Fixed for ever. */
  value: number;
  /** The team whose pool it was dropped from. */
  from: TeamId;
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
  state: 'hq' | 'garrison' | 'hqGarrison' | 'march';
  nodeId?: NodeId;
  /** The friendly HQ this squad is garrisoned at. */
  hqId?: HqId;
  march?: March;
  /** Defeated and walking home: draw it on fire. */
  burning: boolean;
}

export interface EnemyMarchView {
  /** Opaque id: carries no owner or power. */
  id: SquadId;
  /**
   * Every enemy march is public, with its type. The client decides what to show: the type
   * sprite while the march is inside your vision, a question mark while it is in fog.
   */
  type: SquadType;
  /** Commander name: public, like the type. Power still needs a scout. */
  owner: string;
  pos: Vec;
  march: Pick<March, 'from' | 'to' | 'startMs' | 'arriveMs' | 'speed'>;
  /** Present only while a scout reveal on this squad is unexpired. */
  revealed?: RevealedSquad & { expiresAtMs: number };
  /** Defeated and walking home. The fire is visible to anyone who can see it. */
  burning: boolean;
}

export interface EnemyHqView {
  id: HqId;
  /** Commander name: public. */
  owner: string;
  pos: Vec;
  /** True while the HQ is below full HP. Exact HP is not revealed. */
  burning: boolean;
}

/** An HQ on the viewer's team (including allies). */
export interface OwnHqView {
  id: HqId;
  owner: string;
  pos: Vec;
  hp: number;
  maxHp: number;
  /** Reserve troops left, and what hospitals can refill it to. */
  pool: number;
  poolMax: number;
  /** Below full HP: draw it on fire until it is defeated and resets. */
  burning: boolean;
  location: HqLocation;
  nextTeleportAtMs: number;
  /** Allied squads garrisoned here. */
  garrisonCount: number;
}

export interface OwnScoutView {
  owner: string;
  index: number;
  state: 'home' | 'out' | 'back';
  from?: Vec;
  to?: Vec;
  startMs?: number;
  arriveMs?: number;
}

/** A scout of the other team, only listed while it is inside your vision. Position is derived from the flight. */
export interface EnemyScoutView {
  /** Commander name: public inside vision. */
  owner: string;
  index: number;
  state: 'out' | 'back';
  from: Vec;
  to: Vec;
  startMs: number;
  arriveMs: number;
}

export interface TeamView {
  timeMs: number;
  points: [number, number];
  nodes: NodeView[];
  /** Every squad on the viewer's team, with full detail. */
  squads: OwnSquadView[];
  hqs: OwnHqView[];
  scouts: OwnScoutView[];
  /** Enemy scouts inside vision. */
  enemyScouts: EnemyScoutView[];
  /** Every enemy march (positions and types are public; power needs a scout). */
  enemyMarches: EnemyMarchView[];
  /** Enemy HQs inside vision (including stranded ones), masked. */
  enemyHqs: EnemyHqView[];
  scoutReports: ScoutReport[];
  /** Score caches inside your vision. */
  caches: CacheView[];
  /** Most recent first. */
  combatLogs: CombatLog[];
}

/**
 * What one team is allowed to know right now. This is the only thing the
 * server sends to that team's players, so hidden state never leaves it.
 */
export function viewFor(game: ArenaGame, team: TeamId): TeamView {
  const now = game.now;
  const reports = game.scoutReports.filter((r) => r.team === team && r.expiresAtMs > now);

  const nodes: NodeView[] = [];
  for (const n of game.nodes.values()) {
    const visible = n.owner === team || game.isVisibleTo(team, n.pos);
    const view: NodeView = {
      id: n.id,
      kind: n.kind,
      tier: n.tier,
      pos: n.pos,
      owner: n.owner,
      explored: true,
      visible,
    };
    if (visible && n.owner !== null) {
      if (n.poolOpen) {
        view.poolOpen = true;
        view.pool = Math.round(n.pool);
      } else if (n.settlesAtMs !== null) {
        view.settlesAtMs = n.settlesAtMs;
      }
    }
    const opensAt = game.unlockAtMsForTier(n.tier);
    if (now < opensAt) view.unlocksAtMs = opensAt;
    if (n.owner === team) {
      view.garrisonCount = n.garrison.length;
      view.garrisonCountAsOfMs = now;
    } else {
      // Newest live scout report on this node, if any.
      const scouted = reports
        .filter((r) => r.target.kind === 'node' && r.target.nodeId === n.id)
        .sort((a, b) => b.takenAtMs - a.takenAtMs)[0];
      if (scouted) {
        view.garrisonCount = scouted.defenders.length;
        view.garrisonCountAsOfMs = scouted.takenAtMs;
      }
    }
    nodes.push(view);
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
        burning: sq.troops <= 0 && sq.state.kind === 'march',
      };
      if (sq.state.kind === 'garrison') v.nodeId = sq.state.nodeId;
      if (sq.state.kind === 'hqGarrison') v.hqId = sq.state.hqId;
      if (sq.state.kind === 'march') v.march = sq.state.march;
      squads.push(v);
    } else if (sq.state.kind === 'march') {
      const pos = game.squadPos(sq);
      const m = sq.state.march;
      const view: EnemyMarchView = {
        id: sq.id,
        type: sq.type,
        owner: sq.owner,
        pos,
        march: { from: m.from, to: m.to, startMs: m.startMs, arriveMs: m.arriveMs, speed: m.speed },
        burning: sq.troops <= 0,
      };
      const rev = game.revealed[team].get(sq.id);
      if (rev && rev.expiresAtMs > now) view.revealed = { ...rev.info, expiresAtMs: rev.expiresAtMs };
      enemyMarches.push(view);
    }
  }

  const enemyHqs: EnemyHqView[] = [];
  const hqs: OwnHqView[] = [];
  const scouts: OwnScoutView[] = [];
  const enemyScouts: EnemyScoutView[] = [];
  const maxHp = game.tune.hq.hp;
  for (const p of game.players.values()) {
    if (p.team === team) {
      hqs.push({
        id: p.hq.id,
        owner: p.id,
        pos: p.hq.pos,
        hp: p.hq.hp,
        maxHp,
        pool: p.pool,
        poolMax: p.poolMax,
        burning: p.hq.hp < maxHp,
        location: p.hq.location,
        nextTeleportAtMs: p.nextTeleportAtMs,
        garrisonCount: p.hq.garrison.length,
      });
      p.scouts.forEach((sc, index) => {
        const v: OwnScoutView = { owner: p.id, index, state: sc.kind };
        if (sc.kind !== 'home') {
          v.from = sc.from;
          v.to = sc.to;
          v.startMs = sc.startMs;
          v.arriveMs = sc.arriveMs;
        }
        scouts.push(v);
      });
      continue;
    }
    p.scouts.forEach((sc, index) => {
      if (sc.kind === 'home') return;
      const k = sc.arriveMs <= sc.startMs ? 1 : Math.min(1, Math.max(0, (now - sc.startMs) / (sc.arriveMs - sc.startMs)));
      const pos = { x: sc.from.x + (sc.to.x - sc.from.x) * k, y: sc.from.y + (sc.to.y - sc.from.y) * k };
      if (game.isVisibleTo(team, pos)) {
        enemyScouts.push({ owner: p.id, index, state: sc.kind, from: sc.from, to: sc.to, startMs: sc.startMs, arriveMs: sc.arriveMs });
      }
    });
    if (p.hq.location.kind === 'safe') continue;
    if (game.isVisibleTo(team, p.hq.pos)) {
      enemyHqs.push({ id: p.hq.id, owner: p.id, pos: p.hq.pos, burning: p.hq.hp < maxHp });
    }
  }

  const logs = game.combatLogs
    .filter((l) => l.attacker.team === team || l.fights.some((f) => f.defender.team === team))
    .reverse();

  const caches: CacheView[] = [];
  for (const n of game.nodes.values()) {
    for (const c of n.caches) {
      if (game.isVisibleTo(team, c.pos)) caches.push({ id: c.id, nodeId: c.nodeId, pos: c.pos, value: Math.round(c.value), from: c.from });
    }
  }

  return {
    timeMs: now,
    points: game.points(),
    nodes,
    squads,
    hqs,
    scouts,
    enemyScouts,
    enemyMarches,
    enemyHqs,
    scoutReports: reports,
    caches,
    combatLogs: logs,
  };
}

/** Nodes within a turret's reach, handy for UI overlays and bot logic. */
export function nodesWithin(game: ArenaGame, center: Vec, radius: number): NodeId[] {
  const out: NodeId[] = [];
  for (const n of game.nodes.values()) if (dist(n.pos, center) <= radius) out.push(n.id);
  return out;
}
