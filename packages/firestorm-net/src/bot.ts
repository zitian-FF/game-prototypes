// Bots play through exactly the same commands as a person, and only ever see
// their team's fog-filtered view: they cannot peek at hidden state.
//
// What a bot tries to do:
//  - grab free points, spreading out (a node holds one squad per commander, and
//    a teammate already heading for a node makes it worth only the garrison bonus);
//  - keep its strongest squad back as a striker that scouts first and only
//    attacks what a live scout report says it can beat with room to spare;
//  - cover its own nodes when an enemy march is heading for them;
//  - teleport forward out of the safe zone, to refill wounded squads, or to
//    dodge an attack inbound on its HQ.

import { Rng, dist, resolveFight } from 'arena-sim';
import type { Combatant, NodeView, OwnSquadView, ScoutReport, SquadType, TeamId, TeamView, Tune, Vec } from 'arena-sim';
import type { CommandBody } from './protocol';

export interface BotInput {
  playerId: string;
  team: TeamId;
  view: TeamView;
  tune: Tune;
  /** Squad march speed in map units per second. */
  speed: number;
  nowMs: number;
  /**
   * Shared by every bot of a team within one decision round, so bots that decide
   * from the same view do not all pick the same node. Maps node id to how many
   * squads were just sent there.
   */
  claims?: Map<string, number>;
}

type ScoutTarget = Extract<CommandBody, { type: 'scout' }>['target'];

interface Foe {
  type: SquadType;
  effectivePower: number;
}

/** A squad is ready to be sent out above this fraction of its troops. */
const READY_TROOPS = 0.35;
/** Win chance below which a bot will not start an attack. */
const MIN_WIN = 0.6;
/**
 * A scout report is trusted only if it will still be this fresh when the attacker
 * arrives: squads that garrison after the scout are fought first and are not in it.
 */
const REPORT_TRUST_MS = 45_000;
/** Sim ms between a bot's scouting trips, normally and while a striker is hunting. */
const SCOUT_EVERY_MS = 30_000;
const SCOUT_EVERY_HUNTING_MS = 12_000;
/** A striker with nothing to hit for this long settles for a garrison. */
const STRIKER_BLIND_AFTER_MS = 20_000;
const BLIND_MAX_ATTACKERS = 2;
const BLIND_DENIAL = 20;
const STRIKER_PATIENCE_MS = 240_000;

export class BotBrain {
  private noFightTune: Tune | undefined;
  private lastScoutMs = -Infinity;
  private strikerIdleSince: number | undefined;

  constructor(
    readonly playerId: string,
    private readonly rng: Rng,
  ) {}

  think(input: BotInput): CommandBody[] {
    const { view, playerId, team, tune, speed, nowMs } = input;
    const out: CommandBody[] = [];
    const mine = view.squads.filter((s) => s.owner === playerId);
    const hq = view.hqs.find((h) => h.owner === playerId);
    if (!hq || mine.length === 0) return out;

    const cell = tune.map.cellSize;
    const rate = (n: NodeView) => tune.scoring.tierPointsPerSecond[n.tier - 1] ?? 0;
    const garr = tune.scoring.garrisonPointsPerSecond;
    const claims = input.claims ?? new Map<string, number>();

    // How many of our squads are on or heading to each node, and what this commander has.
    const teamAt = new Map<string, number>();
    const mineAt = new Set<string>();
    for (const s of view.squads) {
      const id = s.state === 'garrison' ? s.nodeId : s.state === 'march' && s.march?.purpose === 'node' ? s.march.nodeId : undefined;
      if (!id) continue;
      teamAt.set(id, (teamAt.get(id) ?? 0) + 1);
      if (s.owner === playerId) mineAt.add(id);
    }

    const reportFor = new Map<string, ScoutReport>();
    for (const r of view.scoutReports) {
      const key = r.target.kind === 'node' ? r.target.nodeId : r.target.hqId;
      const have = reportFor.get(key);
      if (!have || have.takenAtMs < r.takenAtMs) reportFor.set(key, r);
    }

    const incoming = (pos: Vec, withinMs: number) =>
      view.enemyMarches.some((m) => dist(m.march.to, pos) <= cell * 1.5 && m.march.arriveMs - nowMs <= withinMs);

    // ---- teleport: dodge, heal, or move forward ----------------------------------------------
    if (hq.nextTeleportAtMs <= nowMs) {
      const dest = this.teleportPlan(input, hq, mine, incoming(hq.pos, 30_000), claims);
      if (dest) {
        claims.set(`tp:${dest}`, (claims.get(`tp:${dest}`) ?? 0) + 1);
        return [{ type: 'teleport', nodeId: dest }]; // everything comes home: plan again next round
      }
    }

    // ---- who is idle, and who is the striker --------------------------------------------------
    const idle = mine.filter((s) => s.state === 'hq' && s.troops >= s.maxTroops * READY_TROOPS);
    const strongest = mine.length >= 2 ? mine.reduce((a, b) => (b.power > a.power ? b : a)) : null;
    let strikerFree = false;
    if (strongest && idle.some((s) => s.id === strongest.id)) {
      this.strikerIdleSince ??= nowMs;
      strikerFree = nowMs - this.strikerIdleSince < STRIKER_PATIENCE_MS;
    } else {
      this.strikerIdleSince = undefined;
    }

    // ---- scouting: look before attacking ------------------------------------------------------
    const freeScout = view.scouts.find((s) => s.owner === playerId && s.state === 'home');
    const haveStrikeForce = mine.some((s) => s.state === 'hq' && s.troops >= s.maxTroops * 0.6);
    const scoutGap = strikerFree ? SCOUT_EVERY_HUNTING_MS : SCOUT_EVERY_MS;
    if (freeScout && haveStrikeForce && nowMs - this.lastScoutMs >= scoutGap) {
      const target = this.pickScoutTarget(input, hq.pos, reportFor);
      if (target) {
        out.push({ type: 'scout', scoutIndex: freeScout.index, target });
        this.lastScoutMs = nowMs;
      }
    }

    // ---- orders for idle squads ----------------------------------------------------------------
    const spent = new Set<string>(mineAt);
    for (const squad of idle) {
      const striker = strikerFree && strongest?.id === squad.id;
      let best: { score: number; cmd: CommandBody } | null = null;
      const consider = (score: number, cmd: CommandBody) => {
        const jitter = 1 + (this.rng.next() - 0.5) * 0.1;
        if (!best || score * jitter > best.score) best = { score: score * jitter, cmd };
      };

      for (const n of view.nodes) {
        if (spent.has(n.id)) continue;
        const seconds = dist(squad.pos ?? hq.pos, n.pos) / speed;
        const near = 1 / (1 + seconds / 45);
        const backed = (teamAt.get(n.id) ?? 0) + (claims.get(n.id) ?? 0);
        const report = reportFor.get(n.id);
        const ours = n.owner === team && n.visible;
        if (ours && (n.garrisonCount ?? 0) >= tune.garrison.maxSquads) continue;
        if (backed >= tune.garrison.maxSquads) continue;

        // Score for taking the node itself is only earned once: if we already hold it, or a
        // teammate is on the way, the node is worth just the garrison bonus to this commander.
        const holdable = ours || backed > 0;
        const tier = (mult: number) => (holdable ? 0 : rate(n) * mult);
        const threatened = ours && incoming(n.pos, seconds * 1000 + 8_000);
        const go = (value: number) =>
          consider(value * near, { type: 'march', squadId: squad.id, target: { kind: 'node', nodeId: n.id } });

        if (ours) {
          if (striker && !threatened) continue; // the striker is saved for a real target
          go(garr + (n.garrisonCount === 0 ? rate(n) * 0.5 : 0) + (threatened ? 40 : 0));
        } else if (report && !report.empty) {
          // A live, fresh scout report beats any guess, whoever owns it.
          const staleBy = nowMs - report.takenAtMs + seconds * 1000;
          const p = staleBy > REPORT_TRUST_MS ? 0 : report.defenders.length === 0 ? 1 : this.winChance(squad, report.defenders, tune);
          if (p >= MIN_WIN) go((tier(n.owner === null ? 1 : 1.5) + garr) * p);
        } else if (n.visible && n.owner === null) {
          if (striker) continue; // free points are for the others
          go(tier(1) + garr); // plainly neutral: free points
        } else if (this.isContested(n, team, tune)) {
          // Enemy-held, or unseen on the enemy's half: fog does not stop us. Contest it blind,
          // betting on our squad power. The striker waits a little in case a report arrives.
          if (striker && nowMs - (this.strikerIdleSince ?? nowMs) < STRIKER_BLIND_AFTER_MS) continue;
          if ((claims.get(n.id) ?? 0) >= BLIND_MAX_ATTACKERS) continue;
          const powerFrac = Math.min(1, Math.max(0, (squad.power - tune.power.min) / (tune.power.max - tune.power.min)));
          const odds = (0.35 + 0.45 * powerFrac) * (striker ? 1.3 : 1) * Math.min(1, squad.troops / squad.maxTroops + 0.2);
          const denial = n.owner === (team === 0 ? 1 : 0) ? BLIND_DENIAL : 0;
          go((rate(n) * 1.5 + garr + denial) * Math.min(1, odds));
        } else if (!n.visible && n.owner !== (team === 0 ? 1 : 0)) {
          if (striker) continue;
          go((tier(1) + garr) * 0.7); // out of sight on our half: probably still free
        }
        // Everything else is not attacked blind: a scout goes first.
      }

      // Enemy HQs we can see: hit one we have scouted and can beat.
      for (const eh of view.enemyHqs) {
        const report = reportFor.get(eh.id);
        if (!report || report.empty) continue;
        const seconds = dist(squad.pos ?? hq.pos, eh.pos) / speed;
        if (nowMs - report.takenAtMs + seconds * 1000 > REPORT_TRUST_MS) continue;
        const p = this.winChance(squad, report.defenders, tune);
        if (p < MIN_WIN) continue;
        consider(((25 + (eh.burning ? 15 : 0)) * p) / (1 + seconds / 45), {
          type: 'march',
          squadId: squad.id,
          target: { kind: 'hq', hqId: eh.id },
        });
      }

      const chosen = best as { score: number; cmd: CommandBody } | null;
      if (chosen) {
        out.push(chosen.cmd);
        if (chosen.cmd.type === 'march' && chosen.cmd.target.kind === 'node') {
          const id = chosen.cmd.target.nodeId;
          spent.add(id);
          claims.set(id, (claims.get(id) ?? 0) + 1);
          if (striker) this.strikerIdleSince = undefined;
        }
      }
    }
    return out;
  }

  // ----------------------------------------------------------------------------------------

  /** Where to teleport, or null to stay. */
  private teleportPlan(
    input: BotInput,
    hq: TeamView['hqs'][number],
    mine: OwnSquadView[],
    underThreat: boolean,
    claims: Map<string, number>,
  ): string | null {
    const { view, team, tune } = input;
    // Only nodes we can see are ours: a remembered owner may be out of date.
    const ownNodes = view.nodes.filter((n) => n.owner === team && n.visible);
    if (ownNodes.length === 0) return null;
    const here = hq.location.kind === 'node' ? hq.location.nodeId : null;
    const cell = tune.map.cellSize;

    const taken = (n: NodeView) => {
      let c = 0;
      for (const h of view.hqs) if (h.location.kind === 'node' && h.location.nodeId === n.id) c++;
      for (const h of view.enemyHqs) if (dist(h.pos, n.pos) <= cell * 1.5) c++;
      return c + (claims.get(`tp:${n.id}`) ?? 0); // teammates deciding this same round
    };
    const open = ownNodes.filter((n) => n.id !== here && taken(n) < tune.hq.slotsPerNode);
    if (open.length === 0) return null;

    const centre = { x: (tune.map.widthCells * cell) / 2, y: (tune.map.heightCells * cell) / 2 };
    const wounded = mine.filter((s) => s.troops < s.maxTroops * 0.35 && s.state !== 'march').length;
    const idleAtHq = mine.filter((s) => s.state === 'hq' && s.troops >= s.maxTroops * READY_TROOPS).length;
    const garrisoned = mine.filter((s) => s.state === 'garrison').length;

    const forward = (list: NodeView[]) => list.slice().sort((a, b) => dist(a.pos, centre) - dist(b.pos, centre))[0];
    const safest = (list: NodeView[]) => {
      const score = (n: NodeView) => Math.min(...view.enemyMarches.map((m) => dist(m.march.to, n.pos)), 1e9);
      return list.slice().sort((a, b) => score(b) - score(a))[0];
    };

    if (underThreat && hq.location.kind === 'node') return safest(open).id; // dodge
    if (wounded >= 2 || (wounded >= 1 && garrisoned <= 1 && idleAtHq === 0)) return forward(open).id; // refill by teleport
    // Leave the safe zone for a forward node, but never throw away much garrison income to do it.
    if (hq.location.kind === 'safe' && garrisoned <= 1) {
      const f = forward(open);
      if (dist(hq.pos, centre) - dist(f.pos, centre) > cell * 6) return f.id;
    }
    return null;
  }

  /** Enemy-held, or out of sight on the enemy's half of the map. */
  private isContested(n: NodeView, team: TeamId, tune: Tune): boolean {
    const enemy: TeamId = team === 0 ? 1 : 0;
    return n.owner === enemy || (!n.visible && n.owner === null && !this.onOurSide(n, team, tune));
  }

  /** The half of the map nearer this team's safe zone. */
  private onOurSide(n: NodeView, team: TeamId, tune: Tune): boolean {
    const mid = (tune.map.widthCells * tune.map.cellSize) / 2;
    return team === 0 ? n.pos.x < mid : n.pos.x > mid;
  }

  /**
   * Scouting is for finding something to attack, so it heads for enemy-held nodes
   * and for unseen nodes on the enemy's half of the map. Free nodes on our own
   * half are simply taken, not scouted. Nearer and higher-tier is better.
   */
  private pickScoutTarget(input: BotInput, from: Vec, reports: Map<string, ScoutReport>): ScoutTarget | null {
    const { view, team, tune } = input;
    const enemy: TeamId = team === 0 ? 1 : 0;
    let best: { d: number; target: ScoutTarget } | null = null;
    for (const n of view.nodes) {
      if (reports.has(n.id) || (n.owner === team && n.visible)) continue;
      if (n.visible && n.owner === null) continue; // seen to be free: no need
      const likelyEnemy = n.owner === enemy || (!n.visible && !this.onOurSide(n, team, tune));
      if (!likelyEnemy) continue;
      const d = dist(from, n.pos) / (1 + n.tier * 0.15);
      if (!best || d < best.d) best = { d, target: { kind: 'node', nodeId: n.id } };
    }
    for (const h of view.enemyHqs) {
      if (reports.has(h.id)) continue;
      const d = dist(from, h.pos) * 0.8;
      if (!best || d < best.d) best = { d, target: { kind: 'hq', hqId: h.id } };
    }
    return best ? best.target : null;
  }

  /**
   * 1 if the squad clears the (scouted) defenders with room to spare, 0 if it
   * loses, 0.5 when it is close. The report can be up to a minute old, so a
   * thin win is not trusted.
   */
  private winChance(squad: OwnSquadView, defenders: Foe[], tune: Tune): number {
    const t = (this.noFightTune ??= { ...tune, combat: { ...tune.combat, variance: 0 } });
    const rng = new Rng(1);
    let troops = squad.troops;
    let closest = 1;
    for (const d of defenders.slice(0, tune.combat.maxDefendersPerAttack)) {
      const a: Combatant = { type: squad.type, power: squad.power, troops, maxTroops: squad.maxTroops, attackBonus: 0, defenseBonus: 0 };
      const b: Combatant = {
        type: d.type,
        power: d.effectivePower * 1.04, // a little pessimism: variance and the node's own boosts
        troops: tune.squad.maxTroops,
        maxTroops: tune.squad.maxTroops,
        attackBonus: 0,
        defenseBonus: 0,
      };
      const r = resolveFight(a, b, t, rng);
      if (r.aTroops <= 0) return 0;
      troops = r.aTroops;
      closest = Math.min(closest, troops / squad.maxTroops);
    }
    return closest < 0.3 ? 0.5 : 1;
  }
}
