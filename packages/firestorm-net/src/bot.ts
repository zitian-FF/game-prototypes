// Bots play through exactly the same commands as a person, and only ever see
// their team's fog-filtered view: they cannot peek at hidden state.
//
// A bot is a tiny state machine. Every few seconds (a random wait in a window)
// it picks one of three actions (weighted: mostly attack, rarely scout), then a
// target for it, leaning toward nearby nodes and toward reinforcing its own. If the
// action is legal it runs it; if not it does nothing and waits for the next cycle.
// A bot with less than one full squad of troops left stops acting altogether.

import { Rng } from 'arena-sim';
import type { NodeView, OwnSquadView, TeamId, TeamView, Tune } from 'arena-sim';
import type { CommandBody } from './protocol';

export interface BotInput {
  playerId: string;
  team: TeamId;
  view: TeamView;
  tune: Tune;
  /** Squad march speed in map units per second (unused by this bot, kept for the room). */
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

export class BotBrain {
  private nextActMs: number | undefined;

  constructor(
    readonly playerId: string,
    private readonly rng: Rng,
  ) {}

  think(input: BotInput): CommandBody[] {
    const { nowMs } = input;
    // Out of troops: not enough left for even one full squad. The bot stops acting for good,
    // though squads it already has in garrisons stay put and keep defending.
    if (this.outOfTroops(input)) return [];
    // First look: start the clock, so 38 bots do not all act on the same tick.
    this.nextActMs ??= nowMs + this.wait();
    if (nowMs < this.nextActMs) return [];
    this.nextActMs = nowMs + this.wait();

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
    for (const h of view.enemyHqs) options.push({ item: { kind: 'hq', hqId: h.id }, weight: near(h.pos) * 0.5 });
    const target = this.pickWeighted(options);
    return target ? { type: 'march', squadId: squad.id, target } : null;
  }

  private scout({ view, playerId, team, nowMs }: BotInput): CommandBody | null {
    const scout = this.pick(view.scouts.filter((s) => s.owner === playerId && s.state === 'home'));
    const targets: Target[] = [];
    for (const n of view.nodes) if (!(n.owner === team && n.visible) && !(n.unlocksAtMs !== undefined && nowMs < n.unlocksAtMs)) targets.push({ kind: 'node', nodeId: n.id });
    for (const h of view.enemyHqs) targets.push({ kind: 'hq', hqId: h.id });
    const target = this.pick(targets);
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
    const deployed = mine.filter((s) => s.state === 'garrison').length;
    const needsRefill = !healthyAtHq && wounded >= 2;
    const idleInSafeZone = hq.location.kind === 'safe' && deployed === 0;
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
