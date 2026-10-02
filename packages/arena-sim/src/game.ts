import { resolveFight } from './combat';
import { baseSpeed, dist, lerp, ringSlotPos, safeZoneSlotPos } from './map';
import { Rng } from './rng';
import type {
  CombatLog,
  CombatantInfo,
  Command,
  CommandResult,
  GameEvent,
  Hq,
  HqId,
  HqLocation,
  MapDef,
  March,
  MarchPurpose,
  MarchTarget,
  MatchResult,
  NodeId,
  NodeState,
  Player,
  PlayerSpec,
  RevealedSquad,
  ScoutReport,
  Squad,
  SquadId,
  TeamId,
  Tune,
  Vec,
} from './types';

export interface GameOptions {
  seed: number;
  tune: Tune;
  map: MapDef;
  players: PlayerSpec[];
}

type QueueKind = 'squadArrive' | 'refill' | 'scoutArrive' | 'scoutHome' | 'turretPulse' | 'missileHit' | 'end';

interface Queued {
  t: number;
  seq: number;
  kind: QueueKind;
  ref: string;
  version: number;
}

interface TeamBonus {
  attack: number;
  defense: number;
  speed: number;
  teleportReductionSeconds: number;
}

interface PointSample {
  t: number;
  p: [number, number];
}

interface StackOutcome {
  fights: CombatLog['fights'];
  cleared: boolean;
  defeatedDefenders: Squad[];
}

/**
 * Authoritative, deterministic game state for one match.
 *
 * Time only moves through advanceTo(). Commands are applied at the current
 * sim time, so a caller advances to "now" and then issues the command. All
 * randomness comes from the seeded Rng, so a match is reproducible from its
 * seed and command log.
 */
export class ArenaGame {
  readonly tune: Tune;
  readonly map: MapDef;
  readonly nodes = new Map<NodeId, NodeState>();
  readonly players = new Map<string, Player>();
  readonly squads = new Map<SquadId, Squad>();
  readonly combatLogs: CombatLog[] = [];
  readonly scoutReports: ScoutReport[] = [];
  /** Per team: squads whose info was revealed by a scout, until expiry. */
  readonly revealed: [Map<SquadId, { info: RevealedSquad; expiresAtMs: number }>, Map<SquadId, { info: RevealedSquad; expiresAtMs: number }>] = [new Map(), new Map()];
  /** Per team: last owner seen for each node (absent = never seen). */
  readonly lastKnownOwner: [Map<NodeId, TeamId | null>, Map<NodeId, TeamId | null>] = [new Map(), new Map()];

  private readonly rng: Rng;
  private readonly speed: number;
  private readonly hqOwner = new Map<HqId, string>();
  private readonly safeIndex = new Map<string, number>();
  private queue: Queued[] = [];
  private queueSeq = 0;
  private stationSeq = 0;
  private versionSeq = 0;
  private logSeq = 0;
  private reportSeq = 0;
  private buf: GameEvent[] = [];
  private nowMs = 0;
  private lastAccrueMs = 0;
  private pointTotals: [number, number] = [0, 0];
  private history: PointSample[] = [{ t: 0, p: [0, 0] }];
  private matchResult: MatchResult | null = null;

  constructor(opts: GameOptions) {
    this.tune = opts.tune;
    this.map = opts.map;
    this.rng = new Rng(opts.seed);
    this.speed = baseSpeed(opts.map, opts.tune);

    for (const n of opts.map.nodes) {
      this.nodes.set(n.id, {
        id: n.id,
        kind: n.kind,
        tier: n.tier,
        pos: { ...n.pos },
        owner: null,
        garrison: [],
        slots: new Array<HqId | null>(opts.tune.hq.slotsPerNode).fill(null),
      });
    }

    const perTeam: [number, number] = [0, 0];
    let squadCount = 0;
    opts.players.forEach((spec, index) => {
      const sIndex = perTeam[spec.team]++;
      this.safeIndex.set(spec.id, sIndex);
      const hq: Hq = {
        id: `h${index}`,
        owner: spec.id,
        hp: opts.tune.hq.hp,
        location: { kind: 'safe', index: sIndex },
        pos: safeZoneSlotPos(opts.map, spec.team, sIndex, opts.tune),
        epoch: 0,
      };
      const player: Player = {
        id: spec.id,
        index,
        team: spec.team,
        pool: spec.pool,
        poolMax: spec.pool,
        hq,
        squadIds: [],
        scouts: Array.from({ length: opts.tune.scout.perHq }, () => ({ kind: 'home' as const })),
        nextTeleportAtMs: 0,
      };
      this.players.set(spec.id, player);
      this.hqOwner.set(hq.id, spec.id);
      for (const s of spec.squads) {
        const id = `s${squadCount++}`;
        this.squads.set(id, {
          id,
          owner: spec.id,
          team: spec.team,
          type: s.type,
          rank: s.rank,
          power: s.power,
          maxTroops: s.maxTroops,
          troops: s.maxTroops,
          defend: true,
          state: { kind: 'hq' },
          seq: ++this.stationSeq,
          refillVersion: 0,
        });
        player.squadIds.push(id);
      }
    });

    this.schedule(opts.tune.match.durationSeconds * 1000, 'end', '', 0);
    this.schedule(opts.tune.turret.pulseSeconds * 1000, 'turretPulse', '', 0);
  }

  // ------------------------------------------------------------- reading

  get now(): number {
    return this.nowMs;
  }

  get result(): MatchResult | null {
    return this.matchResult;
  }

  get marchSpeed(): number {
    return this.speed;
  }

  nextEventAt(): number | null {
    return this.queue.length ? this.queue[0].t : null;
  }

  /** Points including what has accrued since the last event. */
  points(): [number, number] {
    const dt = Math.max(0, this.nowMs - this.lastAccrueMs) / 1000;
    const r = this.pointRates();
    return [this.pointTotals[0] + r[0] * dt, this.pointTotals[1] + r[1] * dt];
  }

  hqById(id: HqId): Hq | undefined {
    const owner = this.hqOwner.get(id);
    return owner ? this.players.get(owner)?.hq : undefined;
  }

  playerByHq(id: HqId): Player | undefined {
    const owner = this.hqOwner.get(id);
    return owner ? this.players.get(owner) : undefined;
  }

  squadPos(sq: Squad): Vec {
    switch (sq.state.kind) {
      case 'hq':
        return this.players.get(sq.owner)!.hq.pos;
      case 'garrison':
        return this.nodes.get(sq.state.nodeId)!.pos;
      case 'march': {
        const m = sq.state.march;
        const span = m.arriveMs - m.startMs;
        const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (this.nowMs - m.startMs) / span));
        return lerp(m.from, m.to, t);
      }
    }
  }

  teamBonus(team: TeamId): TeamBonus {
    const out: TeamBonus = { attack: 0, defense: 0, speed: 0, teleportReductionSeconds: 0 };
    for (const n of this.nodes.values()) {
      if (n.owner !== team) continue;
      // A power node's strength is its base value times its tier.
      const k = this.tune.nodes[n.kind];
      out.attack += (k.attackPct ?? 0) * n.tier;
      out.defense += (k.defensePct ?? 0) * n.tier;
      out.speed += (k.speedPct ?? 0) * n.tier;
      out.teleportReductionSeconds += (k.teleportCooldownReductionSeconds ?? 0) * n.tier;
    }
    return out;
  }

  /** True if the point is inside the shared vision of the team's controlled nodes. */
  isVisibleTo(team: TeamId, pos: Vec): boolean {
    for (const n of this.nodes.values()) {
      if (n.owner !== team) continue;
      if (dist(n.pos, pos) <= this.visionRadius(n)) return true;
    }
    return false;
  }

  /** Vision radius of a node in map units. */
  visionRadius(n: NodeState): number {
    return this.tune.nodes[n.kind].visionRadiusCells * this.tune.map.cellSize;
  }

  /** Score per second a controlled node earns for its team right now. */
  nodeRate(n: NodeState): number {
    if (n.owner === null) return 0;
    const sc = this.tune.scoring;
    const commanders = new Set<string>();
    for (const id of n.garrison) commanders.add(this.squads.get(id)!.owner);
    // Tier score, plus a bonus once per commander with a squad garrisoned here.
    return sc.tierPointsPerSecond[n.tier - 1] + commanders.size * sc.garrisonPointsPerSecond;
  }

  // ---------------------------------------------------------------- time

  advanceTo(ms: number): GameEvent[] {
    this.buf = [];
    if (ms > this.nowMs) this.run(ms);
    return this.buf;
  }

  private run(untilMs: number): void {
    while (this.queue.length && this.queue[0].t <= untilMs && !this.matchResult) {
      const ev = this.queue.shift()!;
      this.setTime(Math.max(ev.t, this.nowMs));
      this.handle(ev);
      this.refreshMemory();
    }
    if (!this.matchResult) this.setTime(Math.max(untilMs, this.nowMs));
  }

  private setTime(t: number): void {
    this.accrue(t);
    this.nowMs = t;
  }

  private schedule(t: number, kind: QueueKind, ref: string, version: number): void {
    const ev: Queued = { t, seq: this.queueSeq++, kind, ref, version };
    let lo = 0;
    let hi = this.queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const q = this.queue[mid];
      if (q.t < ev.t || (q.t === ev.t && q.seq < ev.seq)) lo = mid + 1;
      else hi = mid;
    }
    this.queue.splice(lo, 0, ev);
  }

  private emit(e: GameEvent): void {
    this.buf.push(e);
  }

  // -------------------------------------------------------------- points

  private pointRates(): [number, number] {
    const r: [number, number] = [0, 0];
    for (const n of this.nodes.values()) {
      if (n.owner !== null) r[n.owner] += this.nodeRate(n);
    }
    return r;
  }

  private accrue(toMs: number): void {
    const dt = (toMs - this.lastAccrueMs) / 1000;
    if (dt <= 0) return;
    const r = this.pointRates();
    this.pointTotals[0] += r[0] * dt;
    this.pointTotals[1] += r[1] * dt;
    this.regenPools(dt);
    this.lastAccrueMs = toMs;
    this.history.push({ t: toMs, p: [this.pointTotals[0], this.pointTotals[1]] });
  }

  /** Hospitals refill every ally's reserve pool, up to what it started at. */
  private regenPools(dt: number): void {
    const rate: [number, number] = [0, 0];
    for (const n of this.nodes.values()) {
      if (n.owner === null) continue;
      const per = this.tune.nodes[n.kind].poolRegenPerSecond;
      if (per) rate[n.owner] += per * n.tier;
    }
    if (rate[0] === 0 && rate[1] === 0) return;
    for (const p of this.players.values()) {
      const r = rate[p.team];
      if (r > 0 && p.pool < p.poolMax) p.pool = Math.min(p.poolMax, p.pool + r * dt);
    }
  }

  /** First time a team's running total reached `value`, by linear interpolation. */
  private reachTime(team: TeamId, value: number): number {
    for (let i = 1; i < this.history.length; i++) {
      const a = this.history[i - 1];
      const b = this.history[i];
      if (b.p[team] >= value - 1e-9) {
        const dp = b.p[team] - a.p[team];
        if (dp <= 0) return b.t;
        return a.t + ((value - a.p[team]) / dp) * (b.t - a.t);
      }
    }
    return 0;
  }

  private finish(): void {
    this.accrue(this.tune.match.durationSeconds * 1000);
    const p = this.pointTotals;
    const eps = 1e-6;
    let result: MatchResult;
    if (Math.abs(p[0] - p[1]) > eps) {
      result = { winner: p[0] > p[1] ? 0 : 1, points: [p[0], p[1]], reason: 'points' };
    } else {
      const t0 = this.reachTime(0, p[0]);
      const t1 = this.reachTime(1, p[1]);
      if (Math.abs(t0 - t1) < eps) result = { winner: 'draw', points: [p[0], p[1]], reason: 'draw' };
      else result = { winner: t0 < t1 ? 0 : 1, points: [p[0], p[1]], reason: 'tieBreak' };
    }
    this.matchResult = result;
    this.queue = [];
    this.emit({ type: 'matchEnded', timeMs: this.nowMs, result });
  }

  // --------------------------------------------------------- fog memory

  private refreshMemory(): void {
    for (const team of [0, 1] as const) {
      for (const n of this.nodes.values()) {
        if (n.owner === team || this.isVisibleTo(team, n.pos)) {
          this.lastKnownOwner[team].set(n.id, n.owner);
        }
      }
    }
  }

  // ------------------------------------------------------------ commands

  command(cmd: Command): CommandResult {
    if (this.matchResult) return { ok: false, error: 'matchEnded' };
    const player = this.players.get(cmd.playerId);
    if (!player) return { ok: false, error: 'unknownPlayer' };
    this.buf = [];
    let error: string | null;
    switch (cmd.type) {
      case 'march':
        error = this.cmdMarch(player, cmd.squadId, cmd.target);
        break;
      case 'cancel':
        error = this.cmdCancel(player, cmd.squadId);
        break;
      case 'teleport':
        error = this.cmdTeleport(player, cmd.nodeId);
        break;
      case 'scout':
        error = this.cmdScout(player, cmd.scoutIndex, cmd.target);
        break;
      case 'setDefend':
        error = this.cmdSetDefend(player, cmd.squadId, cmd.defend);
        break;
    }
    if (error) return { ok: false, error };
    this.run(this.nowMs);
    this.refreshMemory();
    return { ok: true, events: this.buf };
  }

  private ownSquad(player: Player, id: SquadId): Squad | null {
    const sq = this.squads.get(id);
    return sq && sq.owner === player.id ? sq : null;
  }

  private cmdSetDefend(player: Player, squadId: SquadId, defend: boolean): string | null {
    const sq = this.ownSquad(player, squadId);
    if (!sq) return 'unknownSquad';
    sq.defend = defend;
    return null;
  }

  private cmdMarch(player: Player, squadId: SquadId, target: MarchTarget): string | null {
    const sq = this.ownSquad(player, squadId);
    if (!sq) return 'unknownSquad';
    // Orders only go out from the HQ. A squad in the field can only be told to come home.
    if (sq.state.kind === 'march') return 'alreadyMarching';
    if (sq.state.kind !== 'hq') return 'notAtHq';
    if (sq.troops <= 0) return 'noTroops';
    let to: Vec;
    if (target.kind === 'node') {
      const node = this.nodes.get(target.nodeId);
      if (!node) return 'unknownNode';
      // Reinforcing a node your team already holds must fit in its garrison.
      if (node.owner === player.team) {
        const block = this.garrisonBlock(sq, node, true);
        if (block) return block;
      }
      to = node.pos;
    } else {
      const hq = this.hqById(target.hqId);
      if (!hq) return 'unknownHq';
      if (this.hqOwner.get(hq.id) === player.id) return 'ownHq';
      if (this.players.get(hq.owner)!.team === player.team) return 'allyHq';
      if (hq.location.kind === 'safe') return 'safeZone';
      to = hq.pos;
    }
    const from = this.squadPos(sq);
    this.leaveStation(sq);
    if (target.kind === 'node') {
      this.startMarch(sq, from, to, 'node', { nodeId: target.nodeId }, false);
    } else {
      const hq = this.hqById(target.hqId)!;
      this.startMarch(sq, from, to, 'hq', { hqId: hq.id, hqEpoch: hq.epoch }, false);
    }
    return null;
  }

  private cmdCancel(player: Player, squadId: SquadId): string | null {
    const sq = this.ownSquad(player, squadId);
    if (!sq) return 'unknownSquad';
    if (sq.state.kind === 'hq') return 'alreadyHome';
    if (sq.state.kind === 'march' && sq.state.march.purpose === 'home') return 'alreadyReturning';
    const from = this.squadPos(sq);
    this.emit({ type: 'marchCancelled', timeMs: this.nowMs, squadId: sq.id });
    this.sendHome(sq, from, false);
    return null;
  }

  private cmdTeleport(player: Player, nodeId: NodeId): string | null {
    const node = this.nodes.get(nodeId);
    if (!node) return 'unknownNode';
    if (node.owner !== player.team) return 'notControlled';
    if (this.nowMs < player.nextTeleportAtMs) return 'onCooldown';
    if (player.hq.location.kind === 'node' && player.hq.location.nodeId === nodeId) return 'alreadyThere';
    const slot = node.slots.findIndex((s) => s === null);
    if (slot < 0) return 'noFreeSlot';
    const reduction = this.teamBonus(player.team).teleportReductionSeconds;
    const cooldown = Math.max(this.tune.hq.teleportCooldownMinSeconds, this.tune.hq.teleportCooldownSeconds - reduction);
    player.nextTeleportAtMs = this.nowMs + cooldown * 1000;
    this.moveHq(player, { kind: 'node', nodeId, slot }, false);
    return null;
  }

  private cmdScout(player: Player, index: number, target: MarchTarget): string | null {
    const scout = player.scouts[index];
    if (!scout) return 'unknownScout';
    if (scout.kind !== 'home') return 'scoutBusy';
    let to: Vec;
    let dest: { kind: 'node'; nodeId: NodeId } | { kind: 'hq'; hqId: HqId; hqEpoch: number };
    if (target.kind === 'node') {
      const node = this.nodes.get(target.nodeId);
      if (!node) return 'unknownNode';
      to = node.pos;
      dest = { kind: 'node', nodeId: node.id };
    } else {
      const hq = this.hqById(target.hqId);
      if (!hq) return 'unknownHq';
      if (this.players.get(hq.owner)!.team === player.team) return 'allyHq';
      if (hq.location.kind === 'safe') return 'safeZone';
      to = hq.pos;
      dest = { kind: 'hq', hqId: hq.id, hqEpoch: hq.epoch };
    }
    const from = player.hq.pos;
    const speed = this.speed * this.tune.scout.speedFactor;
    const arriveMs = this.nowMs + (dist(from, to) / speed) * 1000;
    const version = ++this.versionSeq;
    player.scouts[index] = { kind: 'out', target: dest, from, to, startMs: this.nowMs, arriveMs, version };
    this.schedule(arriveMs, 'scoutArrive', `${player.id}#${index}`, version);
    this.emit({ type: 'scoutLaunched', timeMs: this.nowMs, owner: player.id, scoutIndex: index });
    return null;
  }

  // ------------------------------------------------------------- marches

  private leaveStation(sq: Squad): void {
    if (sq.state.kind === 'garrison') {
      const node = this.nodes.get(sq.state.nodeId)!;
      node.garrison = node.garrison.filter((id) => id !== sq.id);
    }
  }

  private startMarch(
    sq: Squad,
    from: Vec,
    to: Vec,
    purpose: MarchPurpose,
    extra: { nodeId?: NodeId; hqId?: HqId; hqEpoch?: number },
    defeated: boolean,
  ): void {
    const bonus = this.teamBonus(sq.team);
    const speed = this.speed * (1 + bonus.speed) * (defeated ? this.tune.march.defeatedSpeedFactor : 1);
    const arriveMs = this.nowMs + (dist(from, to) / speed) * 1000;
    const march: March = {
      from,
      to,
      startMs: this.nowMs,
      arriveMs,
      speed,
      purpose,
      version: ++this.versionSeq,
      ...extra,
    };
    sq.state = { kind: 'march', march };
    this.schedule(arriveMs, 'squadArrive', sq.id, march.version);
    this.emit({ type: 'marchStarted', timeMs: this.nowMs, squadId: sq.id, march });
  }

  private sendHome(sq: Squad, from: Vec, defeated: boolean): void {
    this.leaveStation(sq);
    const hq = this.players.get(sq.owner)!.hq;
    this.startMarch(sq, from, hq.pos, 'home', {}, defeated);
  }

  private enterHq(sq: Squad): void {
    sq.state = { kind: 'hq' };
    sq.seq = ++this.stationSeq;
    this.queueRefill(sq);
  }

  private queueRefill(sq: Squad): void {
    if (sq.troops >= sq.maxTroops) return;
    if (this.tune.hq.refillSeconds <= 0) {
      this.refill(sq);
      return;
    }
    sq.refillVersion++;
    this.schedule(this.nowMs + this.tune.hq.refillSeconds * 1000, 'refill', sq.id, sq.refillVersion);
  }

  private refill(sq: Squad): void {
    const player = this.players.get(sq.owner)!;
    const add = Math.min(sq.maxTroops - sq.troops, player.pool);
    if (add <= 0) return;
    sq.troops += add;
    player.pool -= add;
    this.emit({ type: 'refilled', timeMs: this.nowMs, squadId: sq.id, added: add });
  }

  /**
   * Why a squad cannot join a node's garrison, or null if it can. A node holds
   * `garrison.maxSquads` squads and at most `garrison.maxPerCommander` of them
   * from one commander. Squads of the same commander already marching to this
   * node count too, so a commander cannot queue a second one behind the first.
   */
  private garrisonBlock(sq: Squad, node: NodeState, countIncoming: boolean): 'nodeFull' | 'commanderAlreadyThere' | null {
    const g = this.tune.garrison;
    let total = node.garrison.length;
    let mine = 0;
    for (const id of node.garrison) if (this.squads.get(id)!.owner === sq.owner) mine++;
    if (countIncoming) {
      for (const other of this.squads.values()) {
        if (other === sq || other.owner !== sq.owner || other.state.kind !== 'march') continue;
        const m = other.state.march;
        if (m.purpose === 'node' && m.nodeId === node.id) mine++;
      }
    }
    if (total >= g.maxSquads) return 'nodeFull';
    if (mine >= g.maxPerCommander) return 'commanderAlreadyThere';
    return null;
  }

  private garrison(sq: Squad, node: NodeState): void {
    sq.state = { kind: 'garrison', nodeId: node.id };
    sq.seq = ++this.stationSeq;
    node.garrison.push(sq.id);
    this.emit({ type: 'garrisoned', timeMs: this.nowMs, nodeId: node.id, squadId: sq.id });
  }

  // ------------------------------------------------------ queue handlers

  private handle(ev: Queued): void {
    switch (ev.kind) {
      case 'squadArrive':
        return this.onSquadArrive(ev);
      case 'refill': {
        const sq = this.squads.get(ev.ref);
        if (sq && sq.state.kind === 'hq' && sq.refillVersion === ev.version) this.refill(sq);
        return;
      }
      case 'scoutArrive':
        return this.onScoutArrive(ev);
      case 'scoutHome':
        return this.onScoutHome(ev);
      case 'turretPulse':
        return this.onTurretPulse();
      case 'missileHit':
        return this.onMissileHit(ev.ref);
      case 'end':
        return this.finish();
    }
  }

  private onSquadArrive(ev: Queued): void {
    const sq = this.squads.get(ev.ref);
    if (!sq || sq.state.kind !== 'march' || sq.state.march.version !== ev.version) return;
    const m = sq.state.march;
    if (m.purpose === 'home') {
      this.enterHq(sq);
    } else if (m.purpose === 'node') {
      this.arriveAtNode(sq, this.nodes.get(m.nodeId!)!);
    } else {
      this.arriveAtHq(sq, m.hqId!, m.hqEpoch!);
    }
  }

  private info(sq: Squad, before: number, after: number): CombatantInfo {
    return {
      squadId: sq.id,
      commander: sq.owner,
      team: sq.team,
      type: sq.type,
      power: sq.power,
      troopsBefore: before,
      troopsAfter: after,
    };
  }

  /** Fight the attacker through the stack, last in first fought, up to the cap. */
  private runStack(attacker: Squad, defenders: Squad[]): StackOutcome {
    const cap = this.tune.combat.maxDefendersPerAttack;
    const aBonus = this.teamBonus(attacker.team);
    const fights: CombatLog['fights'] = [];
    const defeatedDefenders: Squad[] = [];
    let fought = 0;
    for (const d of defenders) {
      if (fought >= cap || attacker.troops <= 0) break;
      const dBonus = this.teamBonus(d.team);
      const dBefore = d.troops;
      const res = resolveFight(
        { ...attacker, attackBonus: aBonus.attack, defenseBonus: aBonus.defense },
        { ...d, attackBonus: dBonus.attack, defenseBonus: dBonus.defense },
        this.tune,
        this.rng,
      );
      attacker.troops = res.aTroops;
      d.troops = res.bTroops;
      fights.push({ defender: this.info(d, dBefore, d.troops), rounds: res.rounds });
      fought++;
      if (d.troops <= 0) defeatedDefenders.push(d);
    }
    return { fights, cleared: defeatedDefenders.length === defenders.length, defeatedDefenders };
  }

  private pushLog(
    subject: CombatLog['subject'],
    attacker: Squad,
    attackerBefore: number,
    out: StackOutcome,
    outcome: CombatLog['outcome'],
  ): void {
    if (out.fights.length === 0) return;
    const log: CombatLog = {
      id: ++this.logSeq,
      timeMs: this.nowMs,
      subject,
      attacker: this.info(attacker, attackerBefore, attacker.troops),
      fights: out.fights,
      outcome,
    };
    this.combatLogs.push(log);
    this.emit({ type: 'combat', timeMs: this.nowMs, log });
  }

  private arriveAtNode(sq: Squad, node: NodeState): void {
    if (node.owner === sq.team) {
      const block = this.garrisonBlock(sq, node, false);
      if (block) {
        // Full, or this commander is already here: turn back, not defeated.
        this.emit({ type: 'garrisonRejected', timeMs: this.nowMs, nodeId: node.id, squadId: sq.id, reason: block });
        this.sendHome(sq, node.pos, false);
        return;
      }
      this.garrison(sq, node);
      return;
    }
    const attackerBefore = sq.troops;
    const defenders = node.garrison
      .map((id) => this.squads.get(id)!)
      .sort((a, b) => b.seq - a.seq);
    const out = this.runStack(sq, defenders);

    for (const d of out.defeatedDefenders) this.sendHome(d, node.pos, true);

    let outcome: CombatLog['outcome'];
    if (sq.troops > 0 && out.cleared) {
      outcome = 'captured';
      const previous = node.owner;
      this.pushLog({ kind: 'node', nodeId: node.id }, sq, attackerBefore, out, outcome);
      node.owner = sq.team;
      this.emit({ type: 'nodeCaptured', timeMs: this.nowMs, nodeId: node.id, team: sq.team, previous });
      this.garrison(sq, node);
      return;
    }
    if (sq.troops <= 0) {
      outcome = 'attackerDefeated';
      this.pushLog({ kind: 'node', nodeId: node.id }, sq, attackerBefore, out, outcome);
      this.sendHome(sq, node.pos, true);
    } else {
      outcome = 'capReached';
      this.pushLog({ kind: 'node', nodeId: node.id }, sq, attackerBefore, out, outcome);
      this.sendHome(sq, node.pos, false);
    }
  }

  private arriveAtHq(sq: Squad, hqId: HqId, epoch: number): void {
    const target = this.playerByHq(hqId)!;
    const hq = target.hq;
    const from = this.squadPos(sq);
    if (hq.epoch !== epoch || hq.location.kind === 'safe') {
      // The HQ teleported away: the attacker finds an empty slot and goes home.
      this.sendHome(sq, from, false);
      return;
    }
    const attackerBefore = sq.troops;
    const defenders = target.squadIds
      .map((id) => this.squads.get(id)!)
      .filter((s) => s.state.kind === 'hq' && s.defend && s.troops > 0)
      .sort((a, b) => b.seq - a.seq);
    const out = this.runStack(sq, defenders);

    // Defeated HQ defenders are already home, so they just refill.
    for (const d of out.defeatedDefenders) this.queueRefill(d);

    // Clearing every defender (or finding none) costs the HQ 1 HP.
    let outcome: CombatLog['outcome'];
    if (out.cleared) {
      hq.hp -= 1;
      outcome = hq.hp <= 0 ? 'hqDefeated' : 'hqDamaged';
    } else {
      outcome = sq.troops <= 0 ? 'attackerDefeated' : 'capReached';
    }
    this.pushLog({ kind: 'hq', hqId }, sq, attackerBefore, out, outcome);
    this.sendHome(sq, from, sq.troops <= 0);

    if (out.cleared) {
      if (hq.hp <= 0) {
        this.emit({ type: 'hqDefeated', timeMs: this.nowMs, hqId });
        this.forceToSafeZone(target);
      } else {
        this.emit({ type: 'hqDamaged', timeMs: this.nowMs, hqId, hp: hq.hp });
      }
    }
  }

  // ------------------------------------------------------- HQ relocation

  private setHqLocation(player: Player, location: HqLocation): void {
    const hq = player.hq;
    if (hq.location.kind === 'node') {
      const old = this.nodes.get(hq.location.nodeId)!;
      old.slots[hq.location.slot] = null;
    }
    hq.location = location;
    if (location.kind === 'node') {
      const node = this.nodes.get(location.nodeId)!;
      node.slots[location.slot] = hq.id;
      hq.pos = ringSlotPos(node.pos, location.slot, this.tune);
    } else {
      hq.pos = safeZoneSlotPos(this.map, player.team, location.index, this.tune);
    }
    hq.epoch++;
  }

  private moveHq(player: Player, location: HqLocation, forced: boolean): void {
    const from = player.hq.pos;
    this.setHqLocation(player, location);
    this.emit({
      type: 'teleported',
      timeMs: this.nowMs,
      hqId: player.hq.id,
      location,
      from,
      to: player.hq.pos,
      forced,
    });
    this.bringAllHome(player);
  }

  private forceToSafeZone(player: Player): void {
    this.moveHq(player, { kind: 'safe', index: this.safeIndex.get(player.id)! }, true);
    player.hq.hp = this.tune.hq.hp;
  }

  /** On teleport every squad and scout of the player returns to the HQ at once. */
  private bringAllHome(player: Player): void {
    for (const id of player.squadIds) {
      const sq = this.squads.get(id)!;
      if (sq.state.kind === 'hq') continue;
      this.leaveStation(sq);
      this.enterHq(sq);
    }
    player.scouts = player.scouts.map(() => ({ kind: 'home' as const }));
  }

  // --------------------------------------------------------------- scouts

  private revealInfo(sq: Squad): RevealedSquad {
    return {
      squadId: sq.id,
      type: sq.type,
      effectivePower: (sq.power * sq.troops) / sq.maxTroops,
      commander: sq.owner,
    };
  }

  private onScoutArrive(ev: Queued): void {
    const i = ev.ref.lastIndexOf('#');
    const player = this.players.get(ev.ref.slice(0, i));
    const index = Number(ev.ref.slice(i + 1));
    const scout = player?.scouts[index];
    if (!player || !scout || scout.kind !== 'out' || scout.version !== ev.version) return;

    let defenders: Squad[] = [];
    let empty = false;
    let target: ScoutReport['target'];
    if (scout.target.kind === 'node') {
      target = { kind: 'node', nodeId: scout.target.nodeId };
      defenders = this.nodes
        .get(scout.target.nodeId)!
        .garrison.map((id) => this.squads.get(id)!)
        .sort((a, b) => b.seq - a.seq);
    } else {
      target = { kind: 'hq', hqId: scout.target.hqId };
      const owner = this.playerByHq(scout.target.hqId)!;
      if (owner.hq.epoch !== scout.target.hqEpoch || owner.hq.location.kind === 'safe') {
        empty = true;
      } else {
        defenders = owner.squadIds
          .map((id) => this.squads.get(id)!)
          .filter((s) => s.state.kind === 'hq' && s.defend && s.troops > 0)
          .sort((a, b) => b.seq - a.seq);
      }
    }

    const expiresAtMs = this.nowMs + this.tune.scout.revealSeconds * 1000;
    const revealed = defenders.map((d) => this.revealInfo(d));
    const report: ScoutReport = {
      id: ++this.reportSeq,
      team: player.team,
      target,
      empty,
      takenAtMs: this.nowMs,
      expiresAtMs,
      defenders: revealed,
    };
    this.scoutReports.push(report);
    for (const r of revealed) this.revealed[player.team].set(r.squadId, { info: r, expiresAtMs });
    this.emit({ type: 'scoutReport', timeMs: this.nowMs, report });

    // Fly home.
    const from = scout.to;
    const to = player.hq.pos;
    const speed = this.speed * this.tune.scout.speedFactor;
    const arriveMs = this.nowMs + (dist(from, to) / speed) * 1000;
    const version = ++this.versionSeq;
    player.scouts[index] = { kind: 'back', from, to, startMs: this.nowMs, arriveMs, version };
    this.schedule(arriveMs, 'scoutHome', ev.ref, version);
  }

  private onScoutHome(ev: Queued): void {
    const i = ev.ref.lastIndexOf('#');
    const player = this.players.get(ev.ref.slice(0, i));
    const index = Number(ev.ref.slice(i + 1));
    const scout = player?.scouts[index];
    if (!player || !scout || scout.kind !== 'back' || scout.version !== ev.version) return;
    player.scouts[index] = { kind: 'home' };
  }

  // -------------------------------------------------------------- turrets

  private missiles = new Map<string, { team: TeamId; nodeId: NodeId; turretId: NodeId }>();
  private missileSeq = 0;

  /** Every held turret fires at every enemy-held node of the target tiers. */
  private onTurretPulse(): void {
    const t = this.tune.turret;
    const speed = this.speed * t.missileSpeedFactor;
    for (const turret of this.nodes.values()) {
      if (turret.kind !== 'turret' || turret.owner === null) continue;
      for (const node of this.nodes.values()) {
        if (node.owner === null || node.owner === turret.owner || node.tier < t.minTargetTier) continue;
        const id = `m${this.missileSeq++}`;
        const arriveMs = this.nowMs + (dist(turret.pos, node.pos) / speed) * 1000;
        this.missiles.set(id, { team: turret.owner, nodeId: node.id, turretId: turret.id });
        this.schedule(arriveMs, 'missileHit', id, 0);
        this.emit({
          type: 'missileLaunched',
          timeMs: this.nowMs,
          id,
          team: turret.owner,
          turretId: turret.id,
          nodeId: node.id,
          from: turret.pos,
          to: node.pos,
          startMs: this.nowMs,
          arriveMs,
        });
      }
    }
    this.schedule(this.nowMs + t.pulseSeconds * 1000, 'turretPulse', '', 0);
  }

  private onMissileHit(id: string): void {
    const m = this.missiles.get(id);
    this.missiles.delete(id);
    if (!m) return;
    const node = this.nodes.get(m.nodeId)!;
    // The node may have changed hands while the missile flew: a friendly node is not hit.
    if (node.owner === null || node.owner === m.team) return;
    const t = this.tune.turret;
    const hits: { squadId: SquadId; damage: number }[] = [];
    for (const sid of node.garrison) {
      const sq = this.squads.get(sid)!;
      const damage = Math.max(0, Math.min(sq.troops - t.minTroops, sq.maxTroops * t.damageFraction));
      sq.troops -= damage;
      hits.push({ squadId: sq.id, damage });
    }
    this.emit({ type: 'turretPulse', timeMs: this.nowMs, nodeId: node.id, hits });
  }

  // ----------------------------------------------------------- invariants

  /** Debug/test helper. Returns a list of violated invariants, empty if sound. */
  checkInvariants(): string[] {
    const errs: string[] = [];
    for (const sq of this.squads.values()) {
      if (sq.troops < 0 || sq.troops > sq.maxTroops) errs.push(`${sq.id} troops ${sq.troops} out of range`);
      if (!Number.isFinite(sq.troops)) errs.push(`${sq.id} troops not finite`);
      if (sq.state.kind === 'garrison') {
        const node = this.nodes.get(sq.state.nodeId);
        if (!node || !node.garrison.includes(sq.id)) errs.push(`${sq.id} garrison link broken`);
        if (node && node.owner !== sq.team) errs.push(`${sq.id} garrisons a node its team does not own`);
      }
    }
    for (const node of this.nodes.values()) {
      if (node.garrison.length > this.tune.garrison.maxSquads) errs.push(`${node.id} garrison over capacity`);
      const perCommander = new Map<string, number>();
      for (const id of node.garrison) {
        const o = this.squads.get(id)!.owner;
        perCommander.set(o, (perCommander.get(o) ?? 0) + 1);
      }
      for (const [o, n] of perCommander) {
        if (n > this.tune.garrison.maxPerCommander) errs.push(`${node.id} holds ${n} squads of ${o}`);
      }
      for (const id of node.garrison) {
        const sq = this.squads.get(id);
        if (!sq || sq.state.kind !== 'garrison' || sq.state.nodeId !== node.id) {
          errs.push(`${node.id} lists ${id} but it is not stationed there`);
        }
      }
      node.slots.forEach((h, slot) => {
        if (h === null) return;
        const hq = this.hqById(h);
        if (!hq || hq.location.kind !== 'node' || hq.location.nodeId !== node.id || hq.location.slot !== slot) {
          errs.push(`${node.id} slot ${slot} holds ${h} but the HQ disagrees`);
        }
      });
    }
    for (const p of this.players.values()) {
      if (p.pool < 0) errs.push(`${p.id} pool negative`);
      if (p.hq.hp < 1 || p.hq.hp > this.tune.hq.hp) errs.push(`${p.id} hp ${p.hq.hp} out of range`);
      if (p.hq.location.kind === 'node') {
        const node = this.nodes.get(p.hq.location.nodeId)!;
        if (node.slots[p.hq.location.slot] !== p.hq.id) errs.push(`${p.id} hq slot link broken`);
      }
    }
    return errs;
  }
}
