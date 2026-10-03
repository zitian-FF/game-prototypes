// Bots play through exactly the same commands as a person, and only ever see
// their team's fog-filtered view: they cannot peek at hidden state.
//
// A bot is a tiny state machine. Every few seconds (a random wait in a window)
// it first looks for something urgent or too good to skip: defending an ally HQ under
// attack, moving its HQ onto a node its team holds, a visible enemy cache, an enemy HQ it
// is confident about. Otherwise it picks one of three actions (weighted: mostly attack,
// rarely scout), then a target for it, leaning toward nearby nodes and toward reinforcing
// its own. If the action is legal it runs it; if not it does nothing and waits for the next
// cycle. Each bot has its own appetite for caches, HQ assaults and helping allies.
// A bot with less than one full squad of troops left stops acting altogether.

import { Rng } from 'arena-sim';
import type { NodeView, OwnSquadView, TeamId, TeamView, Tune } from 'arena-sim';
import type { CommandBody } from './protocol';

export interface BotInput {
  playerId: string;
  team: TeamId;
  view: TeamView;
  tune: Tune;
  /** Squad march speed in map units per second (used to judge whether a squad can reach an ally in time). */
  speed: number;
  nowMs: number;
  /** Shared within a decision round (unused by this bot, kept for the room). */
  claims?: Map<string, number>;
}

/** Sim ms a bot waits between decisions: a random time in this window. */
export const BOT_WAIT_MIN_MS = 8_000;
export const BOT_WAIT_MAX_MS = 20_000;

type Action = 'attack' | 'teleport' | 'scout';
/** Attack most of the time; scouting is rare (bots do not use the reports), teleporting is gated below. */
const ACTION_WEIGHTS: readonly [Action, number][] = [
  ['attack', 75],
  ['teleport', 15],
  ['scout', 10],
];

type Target = Extract<CommandBody, { type: 'march' }>['target'];

/** A squad below this fraction of its troops counts as wounded. */
const WOUNDED = 0.35;
/** An enemy march this close (in sim ms) to our HQ counts as an attack on it. */
const THREAT_MS = 30_000;
/** With fewer own garrisons than this, a bot leans toward reinforcing its own nodes. */
const WANT_GARRISONS = 3;

/** Each bot draws its own appetites once, so a team is not a flock. */
const AGGRESSION_MIN = 0.25;
const AGGRESSION_MAX = 0.9;
const LOYALTY_MIN = 0.4;
const LOYALTY_MAX = 0.95;
/** A squad needs at least this fraction of its troops to go on an HQ assault or a rescue. */
const FIT = 0.7;
/** With no scout report, a squad this strong (effective power) is confident about an enemy HQ. */
const CONFIDENT_POWER = 66;
/** Each bot has its own appetite for stealing caches: from rarely to most of the time. */
const STEAL_MIN = 0.1;
const STEAL_MAX = 0.85;
/** At most this many scouts of one team head for the same cache. */
const MAX_PER_CACHE = 2;

export class BotBrain {
  private nextActMs: number | undefined;
  /** This bot's chance, each decision, of going for a visible enemy cache first. */
  private readonly stealChance: number;
  /** How readily this bot goes for an enemy HQ it feels confident about. */
  private readonly aggression: number;
  /** How readily this bot rushes to help an ally whose HQ is under attack. */
  private readonly loyalty: number;

  constructor(
    readonly playerId: string,
    private readonly rng: Rng,
  ) {
    this.stealChance = STEAL_MIN + rng.next() * (STEAL_MAX - STEAL_MIN);
    this.aggression = AGGRESSION_MIN + rng.next() * (AGGRESSION_MAX - AGGRESSION_MIN);
    this.loyalty = LOYALTY_MIN + rng.next() * (LOYALTY_MAX - LOYALTY_MIN);
  }

  think(input: BotInput): CommandBody[] {
    const { nowMs } = input;
    // Out of troops: not enough left for even one full squad. The bot stops acting for good,
    // though squads it already has in garrisons stay put and keep defending.
    if (this.outOfTroops(input)) return [];
    // First look: start the clock, so 38 bots do not all act on the same tick.
    this.nextActMs ??= nowMs + this.wait();
    if (nowMs < this.nextActMs) return [];
    this.nextActMs = nowMs + this.wait();

    // An ally's HQ under attack that we can reach in time: go and garrison it.
    if (this.rng.next() < this.loyalty) {
      const rescue = this.defendAlly(input);
      if (rescue) return [rescue];
    }
    // Still in the safe zone with a node of ours to land on: get the HQ out there.
    if (this.rng.next() < 0.8) {
      const move = this.teleport(input);
      if (move && input.view.hqs.find((h) => h.owner === input.playerId)?.location.kind === 'safe') return [move];
    }
    // Opportunistic: an enemy score cache inside our vision is worth a scout trip right now.
    if (this.rng.next() < this.stealChance) {
      const steal = this.stealCache(input);
      if (steal) return [steal];
    }
    // An enemy HQ out in the field that we feel confident about.
    if (this.rng.next() < this.aggression) {
      const assault = this.assaultHq(input);
      if (assault) return [assault];
    }

    const action = this.pickWeighted(ACTION_WEIGHTS.map(([a, w]) => ({ item: a, weight: w })));
    if (!action) return [];
    const cmd = action === 'attack' ? this.attack(input) : action === 'teleport' ? this.teleport(input) : this.scout(input);
    return cmd ? [cmd] : [];
  }

  private wait(): number {
    return BOT_WAIT_MIN_MS + this.rng.next() * (BOT_WAIT_MAX_MS - BOT_WAIT_MIN_MS);
  }

  private pick<T>(list: T[]): T | null {
    return list.length ? list[this.rng.int(0, list.length - 1)] : null;
  }

  private pickWeighted<T>(list: { item: T; weight: number }[]): T | null {
    const total = list.reduce((a, e) => a + e.weight, 0);
    if (list.length === 0 || total <= 0) return null;
    let r = this.rng.next() * total;
    for (const e of list) {
      r -= e.weight;
      if (r <= 0) return e.item;
    }
    return list[list.length - 1].item;
  }

  /** Troops in all its squads plus the reserve pool are less than one full squad. */
  private outOfTroops({ view, playerId }: BotInput): boolean {
    const mine = view.squads.filter((s: OwnSquadView) => s.owner === playerId);
    const hq = view.hqs.find((h) => h.owner === playerId);
    if (mine.length === 0 || !hq) return false;
    const total = mine.reduce((a, s) => a + s.troops, 0) + hq.pool;
    const oneSquad = Math.max(...mine.map((s) => s.maxTroops));
    return total < oneSquad;
  }

  /** Enemy-held or unknown nodes and enemy HQs, plus our own nodes that can take this bot's reinforcement. */
  private attack({ view, playerId, team, tune, nowMs }: BotInput): CommandBody | null {
    // Orders only go out from the HQ, with troops to fight.
    const mine = view.squads.filter((s: OwnSquadView) => s.owner === playerId);
    const squad = this.pick(mine.filter((s) => s.state === 'hq' && s.troops > 0));
    const hq = view.hqs.find((h) => h.owner === playerId);
    if (!hq) return null;
    if (!squad) {
      // Nothing at the HQ to send. With two or more garrisons out, pull one back so it can go again;
      // the last one stays to hold its node.
      const out = mine.filter((s) => s.state === 'garrison');
      const spare = out.length >= 2 ? this.pick(out) : null;
      return spare ? { type: 'cancel', squadId: spare.id } : null;
    }

    const garrisons = mine.filter((s) => s.state === 'garrison').length;
    const wantMore = garrisons < WANT_GARRISONS;
    const busy = new Set<string>();
    for (const s of mine) {
      if (s.nodeId) busy.add(s.nodeId);
      if (s.march?.nodeId) busy.add(s.march.nodeId);
    }
    const near = (pos: { x: number; y: number }) => 1 / (1 + Math.hypot(pos.x - hq.pos.x, pos.y - hq.pos.y) / (tune.map.cellSize * 15));

    const options: { item: Target; weight: number }[] = [];
    for (const n of view.nodes) {
      if (n.unlocksAtMs !== undefined && nowMs < n.unlocksAtMs) continue; // locked: cannot be marched on yet
      if (n.owner === team && n.visible) {
        // Reinforce: a free slot, and this commander not already there or on the way.
        if (busy.has(n.id) || (n.garrisonCount ?? 0) >= tune.garrison.maxSquads) continue;
        options.push({ item: { kind: 'node', nodeId: n.id }, weight: near(n.pos) * (wantMore ? 3 : 1) });
      } else {
        options.push({ item: { kind: 'node', nodeId: n.id }, weight: near(n.pos) });
      }
    }
    // Enemy HQs are not blind targets any more: assaultHq goes for one only when it is confident.
    const target = this.pickWeighted(options);
    return target ? { type: 'march', squadId: squad.id, target } : null;
  }

  /** True if the point is inside the team's vision (the circles around its visible nodes). */
  private inVision({ view, team, tune }: BotInput, x: number, y: number): boolean {
    for (const n of view.nodes) {
      if (n.owner !== team || !n.visible) continue;
      if (Math.hypot(n.pos.x - x, n.pos.y - y) <= tune.nodes[n.kind].visionRadiusCells * tune.map.cellSize) return true;
    }
    return false;
  }

  /** Where an enemy march is right now. */
  private marchAt(m: TeamView['enemyMarches'][number], nowMs: number): { x: number; y: number } {
    const span = m.march.arriveMs - m.march.startMs;
    const k = span <= 0 ? 1 : Math.min(1, Math.max(0, (nowMs - m.march.startMs) / span));
    return { x: m.march.from.x + (m.march.to.x - m.march.from.x) * k, y: m.march.from.y + (m.march.to.y - m.march.from.y) * k };
  }

  /**
   * Help a teammate whose HQ (out on a node) is about to be hit by an enemy march we can see: garrison a fit
   * squad there if it can arrive before the fight. The soonest threatened ally comes first.
   */
  private defendAlly(input: BotInput): CommandBody | null {
    const { view, playerId, tune, nowMs, speed } = input;
    const mine = view.squads.filter((s: OwnSquadView) => s.owner === playerId);
    const squad = this.pick(mine.filter((s) => s.state === 'hq' && s.troops >= s.maxTroops * FIT));
    const home = view.hqs.find((h) => h.owner === playerId);
    if (!squad || !home) return null;
    const cell = tune.map.cellSize;
    let best: { hqId: string; eta: number } | null = null;
    for (const h of view.hqs) {
      if (h.owner === playerId || h.location.kind !== 'node') continue;
      if (h.garrisonCount >= tune.garrison.maxSquads) continue;
      // Already helping this one (garrisoned or on the way).
      if (mine.some((s) => s.hqId === h.id || (s.march?.purpose === 'hq' && s.march.hqId === h.id))) continue;
      let eta = Infinity;
      for (const m of view.enemyMarches) {
        if (Math.hypot(m.march.to.x - h.pos.x, m.march.to.y - h.pos.y) > cell * 0.5 || m.march.arriveMs <= nowMs) continue;
        const at = this.marchAt(m, nowMs);
        if (!this.inVision(input, at.x, at.y)) continue; // only what the team can actually see
        eta = Math.min(eta, m.march.arriveMs - nowMs);
      }
      if (!Number.isFinite(eta)) continue;
      const travelMs = (Math.hypot(home.pos.x - h.pos.x, home.pos.y - h.pos.y) / Math.max(1, speed)) * 1000;
      if (travelMs > eta) continue; // would arrive after the fight
      if (!best || eta < best.eta) best = { hqId: h.id, eta };
    }
    return best ? { type: 'march', squadId: squad.id, target: { kind: 'hq', hqId: best.hqId } } : null;
  }

  /**
   * Go for an enemy HQ that is out in the field when confident. With a live scout report: our best squad must
   * beat the strongest known defender. Without one: only a really strong squad, or against a damaged HQ.
   */
  private assaultHq(input: BotInput): CommandBody | null {
    const { view, playerId, nowMs } = input;
    const mine = view.squads.filter((s: OwnSquadView) => s.owner === playerId);
    const fit = mine.filter((s) => s.state === 'hq' && s.troops >= s.maxTroops * FIT);
    const home = view.hqs.find((h) => h.owner === playerId);
    if (fit.length === 0 || !home) return null;
    const eff = (s: OwnSquadView) => (s.power * s.troops) / s.maxTroops;
    const best = fit.reduce((a, s) => (eff(s) > eff(a) ? s : a));
    let pick: { id: string; d: number } | null = null;
    for (const h of view.enemyHqs) {
      const report = view.scoutReports.filter((r) => r.target.kind === 'hq' && r.target.hqId === h.id && r.expiresAtMs > nowMs && !r.empty).sort((a, b) => b.takenAtMs - a.takenAtMs)[0];
      let confident: boolean;
      if (report) {
        const strongest = report.defenders.reduce((a, d) => Math.max(a, d.effectivePower), 0);
        confident = report.defenders.length <= 4 && eff(best) >= strongest * 1.1;
      } else {
        confident = eff(best) >= CONFIDENT_POWER || (h.burning && eff(best) >= CONFIDENT_POWER - 8);
      }
      if (!confident) continue;
      const d = Math.hypot(h.pos.x - home.pos.x, h.pos.y - home.pos.y);
      if (!pick || d < pick.d) pick = { id: h.id, d };
    }
    return pick ? { type: 'march', squadId: best.id, target: { kind: 'hq', hqId: pick.id } } : null;
  }

  /**
   * Send a scout to the closest cache that belongs to an enemy-held node, among those in view. Caches of a node
   * our own team holds are left alone: collecting those only secures what we already have.
   */
  private stealCache({ view, playerId, team, claims }: BotInput): CommandBody | null {
    const scout = this.pick(view.scouts.filter((s) => s.owner === playerId && s.state === 'home'));
    const hq = view.hqs.find((h) => h.owner === playerId);
    if (!scout || !hq) return null;
    const enemyNode = new Set(view.nodes.filter((n) => n.owner !== null && n.owner !== team).map((n) => n.id));
    // Scouts of our team already on their way, so the whole team does not pile onto one cache.
    const heading = new Map<string, number>();
    for (const s of view.scouts) {
      if (s.state !== 'out' || !s.to) continue;
      const to = s.to;
      const hit = view.caches.find((c) => Math.hypot(c.pos.x - to.x, c.pos.y - to.y) < 1);
      if (hit) heading.set(hit.id, (heading.get(hit.id) ?? 0) + 1);
    }
    let best: { id: string; d: number } | null = null;
    for (const c of view.caches) {
      if (!enemyNode.has(c.nodeId)) continue;
      if ((heading.get(c.id) ?? 0) + (claims?.get(c.id) ?? 0) >= MAX_PER_CACHE) continue;
      const d = Math.hypot(c.pos.x - hq.pos.x, c.pos.y - hq.pos.y);
      if (!best || d < best.d) best = { id: c.id, d };
    }
    if (!best) return null;
    claims?.set(best.id, (claims.get(best.id) ?? 0) + 1);
    return { type: 'scout', scoutIndex: scout.index, target: { kind: 'cache', cacheId: best.id } };
  }

  private scout({ view, playerId, team, nowMs }: BotInput): CommandBody | null {
    const scout = this.pick(view.scouts.filter((s) => s.owner === playerId && s.state === 'home'));
    const targets: Target[] = [];
    for (const n of view.nodes) if (!(n.owner === team && n.visible) && !(n.unlocksAtMs !== undefined && nowMs < n.unlocksAtMs)) targets.push({ kind: 'node', nodeId: n.id });
    for (const h of view.enemyHqs) targets.push({ kind: 'hq', hqId: h.id });
    // An enemy HQ we have no live report on is the most useful thing to look at: it decides whether to assault.
    const unreported = view.enemyHqs.filter((h) => !view.scoutReports.some((r) => r.target.kind === 'hq' && r.target.hqId === h.id && r.expiresAtMs > nowMs));
    const target = unreported.length > 0 && this.rng.next() < 0.7 ? ({ kind: 'hq', hqId: this.pick(unreported)!.id } as Target) : this.pick(targets);
    if (!scout || !target) return null;
    return { type: 'scout', scoutIndex: scout.index, target };
  }

  /**
   * Teleport brings every squad home, which empties its garrisons, so it is only legal when it
   * helps: the HQ is about to be hit, wounded squads need a refill, or there is nothing deployed.
   */
  private teleport({ view, playerId, team, nowMs, tune }: BotInput): CommandBody | null {
    const hq = view.hqs.find((h) => h.owner === playerId);
    if (!hq || hq.nextTeleportAtMs > nowMs) return null;
    const mine = view.squads.filter((s: OwnSquadView) => s.owner === playerId);
    const cell = tune.map.cellSize;

    // Marches are public, but a bot only reacts to the ones inside its own vision, like a person would.
    const vision = view.nodes.filter((n) => n.owner === team && n.visible).map((n) => ({ pos: n.pos, r: tune.nodes[n.kind].visionRadiusCells * cell }));
    const underThreat = view.enemyMarches.some(
      (m) =>
        m.march.arriveMs > nowMs &&
        vision.some((v) => {
          const f = Math.min(1, Math.max(0, (nowMs - m.march.startMs) / Math.max(1, m.march.arriveMs - m.march.startMs)));
          const x = m.march.from.x + (m.march.to.x - m.march.from.x) * f;
          const y = m.march.from.y + (m.march.to.y - m.march.from.y) * f;
          return Math.hypot(x - v.pos.x, y - v.pos.y) <= v.r;
        }) && Math.hypot(m.march.to.x - hq.pos.x, m.march.to.y - hq.pos.y) <= cell * 1.5 && m.march.arriveMs - nowMs <= THREAT_MS,
    );
    const healthyAtHq = mine.some((s) => s.state === 'hq' && s.troops >= s.maxTroops * WOUNDED);
    const wounded = mine.filter((s) => s.troops < s.maxTroops * WOUNDED && s.state !== 'march').length;
    const needsRefill = !healthyAtHq && wounded >= 2;
    // Still in the safe zone: any node of ours with a free slot is a reason to move out.
    const idleInSafeZone = hq.location.kind === 'safe';
    if (!underThreat && !needsRefill && !idleInSafeZone) return null;

    const here = hq.location.kind === 'node' ? hq.location.nodeId : null;
    const taken = (n: NodeView) => {
      let c = 0;
      for (const h of view.hqs) if (h.location.kind === 'node' && h.location.nodeId === n.id) c++;
      for (const h of view.enemyHqs) if (Math.hypot(h.pos.x - n.pos.x, h.pos.y - n.pos.y) <= cell * 1.5) c++;
      return c;
    };
    // Only nodes we can see are ours: a remembered owner may be out of date.
    const open = view.nodes.filter((n) => n.owner === team && n.visible && n.id !== here && taken(n) < tune.hq.slotsPerNode);
    const node = this.pick(open);
    return node ? { type: 'teleport', nodeId: node.id } : null;
  }
}
