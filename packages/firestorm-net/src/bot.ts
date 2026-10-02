// Bots play through exactly the same commands as a person, and only ever see
// their team's fog-filtered view: they cannot peek at hidden state.
//
// A bot is a tiny state machine. Every few seconds (a random wait in a window)
// it picks one of three actions at random: attack, teleport or scout. It then
// picks a random target for that action. If the action is legal it runs it; if
// not it does nothing and waits for the next cycle.

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
const ACTIONS: readonly Action[] = ['attack', 'teleport', 'scout'];

type Target = Extract<CommandBody, { type: 'march' }>['target'];

export class BotBrain {
  private nextActMs: number | undefined;

  constructor(
    readonly playerId: string,
    private readonly rng: Rng,
  ) {}

  think(input: BotInput): CommandBody[] {
    const { nowMs } = input;
    // First look: start the clock, so 38 bots do not all act on the same tick.
    this.nextActMs ??= nowMs + this.wait();
    if (nowMs < this.nextActMs) return [];
    this.nextActMs = nowMs + this.wait();

    const action = ACTIONS[this.rng.int(0, ACTIONS.length - 1)];
    const cmd = action === 'attack' ? this.attack(input) : action === 'teleport' ? this.teleport(input) : this.scout(input);
    return cmd ? [cmd] : [];
  }

  private wait(): number {
    return BOT_WAIT_MIN_MS + this.rng.next() * (BOT_WAIT_MAX_MS - BOT_WAIT_MIN_MS);
  }

  private pick<T>(list: T[]): T | null {
    return list.length ? list[this.rng.int(0, list.length - 1)] : null;
  }

  /** Nodes and enemy HQs a bot may send something at: anything that is not already ours. */
  private targets(view: TeamView, team: TeamId): Target[] {
    const out: Target[] = [];
    for (const n of view.nodes) if (!(n.owner === team && n.visible)) out.push({ kind: 'node', nodeId: n.id });
    for (const h of view.enemyHqs) out.push({ kind: 'hq', hqId: h.id });
    return out;
  }

  private attack({ view, playerId, team }: BotInput): CommandBody | null {
    // Orders only go out from the HQ, with troops to fight.
    const ready = view.squads.filter((s: OwnSquadView) => s.owner === playerId && s.state === 'hq' && s.troops > 0);
    const squad = this.pick(ready);
    const target = this.pick(this.targets(view, team));
    if (!squad || !target) return null;
    return { type: 'march', squadId: squad.id, target };
  }

  private scout({ view, playerId, team }: BotInput): CommandBody | null {
    const scout = this.pick(view.scouts.filter((s) => s.owner === playerId && s.state === 'home'));
    const target = this.pick(this.targets(view, team));
    if (!scout || !target) return null;
    return { type: 'scout', scoutIndex: scout.index, target };
  }

  private teleport({ view, playerId, team, nowMs, tune }: BotInput): CommandBody | null {
    const hq = view.hqs.find((h) => h.owner === playerId);
    if (!hq || hq.nextTeleportAtMs > nowMs) return null;
    const here = hq.location.kind === 'node' ? hq.location.nodeId : null;
    const cell = tune.map.cellSize;
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
