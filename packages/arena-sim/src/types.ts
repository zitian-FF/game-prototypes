// Shared types for the firestorm-arena sim. Pure data, no behaviour.

export type TeamId = 0 | 1;
export type SquadType = 'missile' | 'aircraft' | 'tank';

/** Last War counter triangle: key beats value. */
export const COUNTERS: Record<SquadType, SquadType> = {
  aircraft: 'tank',
  tank: 'missile',
  missile: 'aircraft',
};

export const SQUAD_TYPES: readonly SquadType[] = ['missile', 'aircraft', 'tank'];

/**
 * 'points' is a pure score node. The rest carry a power. Every node has a
 * tier 1-4 (shown as stacked cubes): its tier sets its score per second, and
 * a power node's effect is its base value times its tier.
 */
export type NodeKind =
  | 'points'
  | 'attackBoost'
  | 'defenseBoost'
  | 'speedBoost'
  | 'teleportCooldown'
  | 'largeVision'
  | 'turret'
  | 'hospital'
  /** Neutral and never capturable: any HQ may teleport onto it, and both teams see the 8 cells around it. */
  | 'portal';

export const NODE_KINDS: readonly NodeKind[] = [
  'points',
  'attackBoost',
  'defenseBoost',
  'speedBoost',
  'teleportCooldown',
  'largeVision',
  'turret',
  'hospital',
  'portal',
];

export interface Vec {
  x: number;
  y: number;
}

// ---------------------------------------------------------------- tuning

export interface RingTune {
  tier: number;
  /** One node on the exact centre cell instead of mirrored pairs. */
  center?: boolean;
  minR: number;
  maxR: number;
  /** Node counts by kind. Must be even unless `center` is set. */
  nodes: Partial<Record<NodeKind, number>>;
  /** Kinds in this ring that sit at a different tier than the ring's own. */
  kindTiers?: Partial<Record<NodeKind, number>>;
  /**
   * Kinds placed last, at the spot that sees the most tier 3 and 4 nodes (vision towers), then the most other
   * nodes. Placing them last means the high tier nodes already exist when they pick.
   */
  strategic?: NodeKind[];
  /**
   * Keep this ring's nodes toward the team's own spawn: the column of a node in its team's half, as a fraction
   * of the way from the map edge (0) to the centre column (1). Both teams mirror it, so it stays fair.
   */
  spawnBand?: [number, number];
}

export interface NodeKindTune {
  visionRadiusCells: number;
  /** Effect values are per tier: the node applies value * tier. */
  attackPct?: number;
  defensePct?: number;
  /** Accelerator: seconds cut off the edge-to-edge march time of squads, times tier. */
  marchEdgeSecondsCut?: number;
  /** Tech Centre: extra teleport-cooldown seconds drained per second, times tier (1 = twice as fast). */
  teleportCooldownRate?: number;
  /** Hospital: troops per second added to each ally's reserve pool, times tier. */
  poolRegenPerSecond?: number;
}

/** Mirrors prototypes/firestorm-arena/tune.json. */
export interface Tune {
  match: { durationSeconds: number; playersPerTeam: number; startCancelSeconds: number };
  roster: {
    ranks: number;
    /** Share of commanders per team dealt 4 squads and 3 squads; the rest get 2. */
    fourSquadShare: number;
    threeSquadShare: number;
    /** Rank band per squad slot (1 = strongest). The first two slots are the strong ones, the 3rd and 4th are utility. */
    bands: [number, number][];
    /** Reveal cards: a squad in the best this share of its own slot's power range glows gold, silver or bronze. */
    cardTiers: { gold: number; silver: number; bronze: number };
  };
  power: { min: number; max: number };
  squad: {
    maxTroops: number;
    maxTroopsVariance: number;
    reservePoolMin: number;
    reservePoolMax: number;
  };
  combat: {
    powerExponent: number;
    counterMultiplier: number;
    variance: number;
    powerRef: number;
    roundDamageFraction: number;
    maxDefendersPerAttack: number;
    maxRounds: number;
  };
  march: {
    /** Base time for a squad to cross the map from one edge to the opposite one. */
    edgeToEdgeSeconds: number;
    /** The edge-to-edge time never drops below this, however many Accelerators are held. */
    minEdgeToEdgeSeconds: number;
    defeatedSpeedFactor: number;
  };
  hq: {
    hp: number;
    teleportCooldownSeconds: number;
    refillSeconds: number;
    /** Slots are the 8 cells around a node, taken in a fixed order. */
    slotsPerNode: number;
  };
  scout: { perHq: number; speedFactor: number; revealSeconds: number };
  /** How many squads one node can hold, and how many of those may be one commander's. */
  garrison: { maxSquads: number; maxPerCommander: number };
  /** Score per second by node tier (index 0 = tier 1), plus the garrison bonus. */
  scoring: { tierPointsPerSecond: number[]; garrisonPointsPerSecond: number };
  /**
   * Escalation: tier 3 nodes are locked until the clock has this fraction of the match left, tier 4 likewise.
   * 0.75 means they open after a quarter of the match.
   */
  phases: { tier3UnlockRemaining: number; tier4UnlockRemaining: number };
  /**
   * Score pools. After a node has been held for settleSeconds, the points its tier generates (not the commander bonus)
   * also go into a temporary pool that counts for the holder. When control of the node swaps, the pool is emptied (the
   * old holder's score drops by it) and dropped as score caches around the node, split equally with a fixed value each.
   * A scout of either team that touches a cache banks its value for its team for good.
   */
  pool: {
    settleSeconds: number;
    minCaches: number;
    maxCaches: number;
    /** When a pool is dropped as caches there is one more cache for every this many points in it (up to maxCaches). */
    cachePointsStep: number;
    scatterMinCells: number;
    scatterMaxCells: number;
  };
  /** Individual (vanity) score values. */
  personalScoring: { perTroopDefeated: number; perNodeCaptured: number; perGarrisonSecond: number; perHqDowned: number; perCachePoint: number };
  /**
   * Every pulse each held turret fires a missile at every enemy-held node of
   * minTargetTier or higher. A hit takes damageFraction of max troops from every
   * garrisoned squad (never below minTroops).
   */
  turret: { pulseSeconds: number; damageFraction: number; missileSpeedFactor: number; minTroops: number; minTargetTier: number };
  map: {
    cellSize: number;
    widthCells: number;
    heightCells: number;
    safeZone: { cols: number; rows: number; insetCells: number };
    nodeMinSpacingCells: number;
    nodeMinDistFromSafeZoneCells: number;
    edgeMarginCells: number;
    /** Concentric zones, outside in. r is 0 at the map centre and 1 at the edge. */
    rings: RingTune[];
  };
  nodes: Record<NodeKind, NodeKindTune>;
}

// ------------------------------------------------------------- roster/map

export interface SquadSpec {
  type: SquadType;
  rank: number;
  power: number;
  maxTroops: number;
}

export interface PlayerSpec {
  id: string;
  team: TeamId;
  pool: number;
  squads: SquadSpec[];
}

export interface Cell {
  cx: number;
  cy: number;
}

/** A block of cells where a team's HQs start and return when defeated. */
export interface SafeZone {
  origin: Cell;
  cols: number;
  rows: number;
  center: Vec;
}

export interface MapNode {
  id: string;
  kind: NodeKind;
  /** 1-4. Sets score per second, and a power node's strength. */
  tier: number;
  cell: Cell;
  pos: Vec;
}

export interface MapDef {
  width: number;
  height: number;
  nodes: MapNode[];
  safeZones: [SafeZone, SafeZone];
}

// ----------------------------------------------------------------- state

export type SquadId = string;
export type NodeId = string;
export type HqId = string;

export type MarchPurpose = 'node' | 'hq' | 'home';

export interface March {
  from: Vec;
  to: Vec;
  startMs: number;
  arriveMs: number;
  speed: number;
  purpose: MarchPurpose;
  nodeId?: NodeId;
  hqId?: HqId;
  hqEpoch?: number;
  /** Bumped whenever the march is replaced, so stale arrival events are ignored. */
  version: number;
}

export type SquadState =
  | { kind: 'hq' }
  | { kind: 'garrison'; nodeId: NodeId }
  /** Garrisoned at a friendly HQ, defending it like a node garrison. */
  | { kind: 'hqGarrison'; hqId: HqId }
  | { kind: 'march'; march: March };

export interface Squad {
  id: SquadId;
  owner: string;
  team: TeamId;
  type: SquadType;
  rank: number;
  power: number;
  maxTroops: number;
  troops: number;
  /** HQ defender check box. Only checked squads at the HQ defend it. */
  defend: boolean;
  state: SquadState;
  /** Order of entering the current station, used for last-in-first-fought. */
  seq: number;
  refillVersion: number;
}

export type HqLocation =
  | { kind: 'safe'; index: number }
  | { kind: 'node'; nodeId: NodeId; slot: number };

export interface Hq {
  id: HqId;
  owner: string;
  hp: number;
  location: HqLocation;
  pos: Vec;
  /** Bumped on every move so marches that targeted the old spot whiff. */
  epoch: number;
  /** Allied squads garrisoned here (arrival order, last fought first). Own squads at home are not listed. */
  garrison: SquadId[];
}

export interface Cache {
  id: string;
  nodeId: NodeId;
  pos: Vec;
  /** Fixed for ever: what a scout banks for its team by touching it. */
  value: number;
  /** The team whose pool it was dropped from (the team that lost the node). */
  from: TeamId;
}

export type ScoutTarget = MarchTarget | { kind: 'cache'; cacheId: string };

export type ScoutState =
  | { kind: 'home' }
  | {
      kind: 'out';
      target: { kind: 'node'; nodeId: NodeId } | { kind: 'hq'; hqId: HqId; hqEpoch: number } | { kind: 'cache'; cacheId: string };
      from: Vec;
      to: Vec;
      startMs: number;
      arriveMs: number;
      version: number;
    }
  | { kind: 'back'; from: Vec; to: Vec; startMs: number; arriveMs: number; version: number };

export interface Player {
  id: string;
  index: number;
  team: TeamId;
  pool: number;
  /** The pool at the start: hospitals refill it up to this. */
  poolMax: number;
  hq: Hq;
  squadIds: SquadId[];
  scouts: ScoutState[];
  nextTeleportAtMs: number;
  /** Vanity score ingredients. They never touch the team score or the outcome. */
  stats: PlayerStats;
}

export interface PlayerStats {
  troopsDefeated: number;
  nodesCaptured: number;
  /** Seconds spent garrisoning a node, summed over squads. */
  garrisonSeconds: number;
  hqsDowned: number;
  /** Team points banked by touching caches with this commander's scouts. */
  cachePoints: number;
}

export interface PlayerScore extends PlayerStats {
  id: string;
  team: TeamId;
  score: number;
}

export interface NodeState {
  id: NodeId;
  kind: NodeKind;
  tier: number;
  pos: Vec;
  owner: TeamId | null;
  /** Garrisoned squad ids in arrival order (last entry fought first). */
  garrison: SquadId[];
  /** HQ occupying each base slot around the node. */
  slots: (HqId | null)[];
  /** Bumped on every change of owner, so a pending pool opening for an old owner is ignored. */
  captureSeq: number;
  /** When the held-for-a-while timer ends and the pool opens (null while nobody holds it). */
  settlesAtMs: number | null;
  poolOpen: boolean;
  /** Temporary score: counted for the holder, lost with the node. */
  pool: number;
  /** Caches ever dropped here, for ids and positions that do not depend on when time advanced. */
  cacheSpawned: number;
  /** Caches that were dropped here by swaps of control and not collected yet. They stay until a scout takes them. */
  caches: Cache[];
}

// ----------------------------------------------------------- scout/combat

export interface RevealedSquad {
  squadId: SquadId;
  type: SquadType;
  /** power * troops / maxTroops at the time of the scout. */
  effectivePower: number;
  commander: string;
}

export interface ScoutReport {
  id: number;
  team: TeamId;
  target: { kind: 'node'; nodeId: NodeId } | { kind: 'hq'; hqId: HqId };
  /** True when an HQ target had already teleported away. */
  empty: boolean;
  takenAtMs: number;
  expiresAtMs: number;
  defenders: RevealedSquad[];
}

export interface CombatantInfo {
  squadId: SquadId;
  commander: string;
  team: TeamId;
  type: SquadType;
  power: number;
  troopsBefore: number;
  troopsAfter: number;
}

export interface CombatLog {
  id: number;
  timeMs: number;
  subject: { kind: 'node'; nodeId: NodeId } | { kind: 'hq'; hqId: HqId };
  attacker: CombatantInfo;
  /** Fights in the order they happened (last in, first fought). */
  fights: { defender: CombatantInfo; rounds: number }[];
  outcome: 'captured' | 'attackerDefeated' | 'capReached' | 'hqDamaged' | 'hqDefeated' | 'noDefenders';
}

// -------------------------------------------------------------- commands

export type MarchTarget = { kind: 'node'; nodeId: NodeId } | { kind: 'hq'; hqId: HqId };

export type Command =
  | { type: 'march'; playerId: string; squadId: SquadId; target: MarchTarget }
  | { type: 'cancel'; playerId: string; squadId: SquadId }
  | { type: 'teleport'; playerId: string; nodeId: NodeId }
  | { type: 'scout'; playerId: string; scoutIndex: number; target: ScoutTarget }
  | { type: 'setDefend'; playerId: string; squadId: SquadId; defend: boolean };

export type CommandResult = { ok: true; events: GameEvent[] } | { ok: false; error: string };

export type GameEvent =
  | { type: 'marchStarted'; timeMs: number; squadId: SquadId; march: March }
  | { type: 'marchCancelled'; timeMs: number; squadId: SquadId }
  | { type: 'nodeCaptured'; timeMs: number; nodeId: NodeId; team: TeamId; previous: TeamId | null }
  | { type: 'garrisoned'; timeMs: number; nodeId: NodeId; squadId: SquadId }
  | {
      type: 'garrisonRejected';
      timeMs: number;
      nodeId: NodeId;
      squadId: SquadId;
      reason: 'nodeFull' | 'commanderAlreadyThere';
    }
  | { type: 'nodesUnlocked'; timeMs: number; tier: number }
  | { type: 'poolOpened'; timeMs: number; nodeId: NodeId }
  /** The holder lost a node and with it its temporary pool. */
  | { type: 'poolLost'; timeMs: number; nodeId: NodeId; team: TeamId; amount: number; caches: number }
  | { type: 'cacheCollected'; timeMs: number; nodeId: NodeId; cacheId: string; team: TeamId; commander: string; amount: number; at: Vec }
  | { type: 'hqGarrisoned'; timeMs: number; hqId: HqId; squadId: SquadId }
  | { type: 'hqGarrisonRejected'; timeMs: number; hqId: HqId; squadId: SquadId; reason: 'nodeFull' | 'commanderAlreadyThere' }
  | { type: 'combat'; timeMs: number; log: CombatLog }
  | { type: 'hqDamaged'; timeMs: number; hqId: HqId; hp: number }
  | { type: 'hqDefeated'; timeMs: number; hqId: HqId }
  | { type: 'teleported'; timeMs: number; hqId: HqId; location: HqLocation; from: Vec; to: Vec; forced: boolean }
  | { type: 'scoutLaunched'; timeMs: number; owner: string; scoutIndex: number }
  | { type: 'scoutReport'; timeMs: number; report: ScoutReport }
  | { type: 'turretPulse'; timeMs: number; nodeId: NodeId; hits: { squadId: SquadId; damage: number }[] }
  | { type: 'missileLaunched'; timeMs: number; id: string; team: TeamId; turretId: NodeId; nodeId: NodeId; from: Vec; to: Vec; startMs: number; arriveMs: number }
  | { type: 'refilled'; timeMs: number; squadId: SquadId; added: number }
  | { type: 'matchEnded'; timeMs: number; result: MatchResult };

export interface MatchResult {
  winner: TeamId | 'draw';
  points: [number, number];
  reason: 'points' | 'tieBreak' | 'draw';
  /** Individual vanity leaderboard, best first. */
  leaderboard: PlayerScore[];
}
