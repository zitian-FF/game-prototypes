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

export type NodeKind =
  | 'attackBoost'
  | 'defenseBoost'
  | 'speedBoost'
  | 'teleportCooldown'
  | 'largeVision'
  | 'pointMedium'
  | 'pointLarge'
  | 'turret';

export const NODE_KINDS: readonly NodeKind[] = [
  'pointMedium',
  'pointLarge',
  'attackBoost',
  'defenseBoost',
  'speedBoost',
  'teleportCooldown',
  'largeVision',
  'turret',
];

export interface Vec {
  x: number;
  y: number;
}

// ---------------------------------------------------------------- tuning

export interface NodeKindTune {
  visionRadius: number;
  pointsPerSecond: number;
  attackPct?: number;
  defensePct?: number;
  speedPct?: number;
  teleportCooldownReductionSeconds?: number;
}

/** Mirrors prototypes/firestorm-arena/tune.json. */
export interface Tune {
  match: { durationSeconds: number; playersPerTeam: number; startCancelSeconds: number };
  roster: {
    ranks: number;
    squad1RankMin: number;
    squad1RankMax: number;
    squad2Chance: number;
    squad2RankMin: number;
    squad2RankMax: number;
    squad3Chance: number;
    squad3RankMin: number;
    squad3RankMax: number;
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
  march: { crossMapSeconds: number; defeatedSpeedFactor: number };
  hq: {
    hp: number;
    teleportCooldownSeconds: number;
    teleportCooldownMinSeconds: number;
    refillSeconds: number;
    slotsPerNode: number;
    slotRingRadius: number;
  };
  scout: { perHq: number; speedFactor: number; revealSeconds: number };
  turret: { pulseSeconds: number; damageFraction: number; radius: number };
  map: {
    width: number;
    height: number;
    safeZoneInset: number;
    safeZoneRadius: number;
    safeZoneSlotSpacing: number;
    nodeMinSpacing: number;
    nodeMinDistFromSafeZone: number;
    edgeMargin: number;
    nodeCounts: Record<NodeKind, number>;
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

export interface SafeZone {
  center: Vec;
  radius: number;
}

export interface MapNode {
  id: string;
  kind: NodeKind;
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
}

export type ScoutState =
  | { kind: 'home' }
  | {
      kind: 'out';
      target: { kind: 'node'; nodeId: NodeId } | { kind: 'hq'; hqId: HqId; hqEpoch: number };
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
  hq: Hq;
  squadIds: SquadId[];
  scouts: ScoutState[];
  nextTeleportAtMs: number;
}

export interface NodeState {
  id: NodeId;
  kind: NodeKind;
  pos: Vec;
  owner: TeamId | null;
  /** Garrisoned squad ids in arrival order (last entry fought first). */
  garrison: SquadId[];
  /** HQ occupying each base slot around the node. */
  slots: (HqId | null)[];
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
  | { type: 'scout'; playerId: string; scoutIndex: number; target: MarchTarget }
  | { type: 'setDefend'; playerId: string; squadId: SquadId; defend: boolean };

export type CommandResult = { ok: true; events: GameEvent[] } | { ok: false; error: string };

export type GameEvent =
  | { type: 'marchStarted'; timeMs: number; squadId: SquadId; march: March }
  | { type: 'marchCancelled'; timeMs: number; squadId: SquadId }
  | { type: 'nodeCaptured'; timeMs: number; nodeId: NodeId; team: TeamId; previous: TeamId | null }
  | { type: 'garrisoned'; timeMs: number; nodeId: NodeId; squadId: SquadId }
  | { type: 'combat'; timeMs: number; log: CombatLog }
  | { type: 'hqDamaged'; timeMs: number; hqId: HqId; hp: number }
  | { type: 'hqDefeated'; timeMs: number; hqId: HqId }
  | { type: 'teleported'; timeMs: number; hqId: HqId; location: HqLocation; forced: boolean }
  | { type: 'scoutLaunched'; timeMs: number; owner: string; scoutIndex: number }
  | { type: 'scoutReport'; timeMs: number; report: ScoutReport }
  | { type: 'turretPulse'; timeMs: number; nodeId: NodeId; hits: { squadId: SquadId; damage: number }[] }
  | { type: 'refilled'; timeMs: number; squadId: SquadId; added: number }
  | { type: 'matchEnded'; timeMs: number; result: MatchResult };

export interface MatchResult {
  winner: TeamId | 'draw';
  points: [number, number];
  reason: 'points' | 'tieBreak' | 'draw';
}
