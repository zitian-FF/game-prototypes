import { mulberry32 } from 'dig-kit';
import { tune } from '../tune';
import { AGENT_CELLS, type CellRect, END_CELLS, IN_ANCHOR, OUT_ANCHOR, inBounds, rectsClash } from './board';
import { type Kind, LEVELS, type Level, MODEL_INFO, type ModelId, type NodeRef, type WordId } from './content';

export interface NodeCfg {
  model: ModelId;
  words: WordId[];
  /** Top-left grid cell on the blueprint. */
  x: number;
  y: number;
}

/** A wire: from node, to node, and the type it carries (the type of the ports at both ends). */
export type Edge = [NodeRef, NodeRef, Kind];

export interface Layout {
  nodes: Record<string, NodeCfg>;
  edges: Edge[];
  /** Counter for new agent ids ('n1', 'n2', ...). */
  next: number;
}

export const emptyLayout = (): Layout => ({ nodes: {}, edges: [], next: 1 });

/** Types a node can send out of its output ports, in port order. */
export function outKinds(layout: Layout, level: Level, ref: NodeRef): Kind[] {
  if (ref === 'in') return [level.inKind];
  const n = layout.nodes[ref];
  return n && ref !== 'out' ? MODEL_INFO[n.model].out : [];
}

/** Types a node accepts on its input ports, in port order. */
export function inKinds(layout: Layout, level: Level, ref: NodeRef): Kind[] {
  if (ref === 'out') return [level.outKind];
  const n = layout.nodes[ref];
  return n && ref !== 'in' ? MODEL_INFO[n.model].in : [];
}

/** Footprint of a node in grid cells. */
export function nodeRect(layout: Layout, ref: NodeRef): CellRect {
  if (ref === 'in') return { ...IN_ANCHOR, ...END_CELLS };
  if (ref === 'out') return { ...OUT_ANCHOR, ...END_CELLS };
  const n = layout.nodes[ref];
  return { x: n?.x ?? 0, y: n?.y ?? 0, ...AGENT_CELLS };
}

/** Can an agent footprint at this cell sit on the board without touching another node? */
export function canPlace(layout: Layout, x: number, y: number, ignore?: NodeRef): boolean {
  const r: CellRect = { x, y, ...AGENT_CELLS };
  if (!inBounds(r)) return false;
  const others: NodeRef[] = ['in', 'out', ...Object.keys(layout.nodes)].filter((id) => id !== ignore);
  return others.every((id) => !rectsClash(r, nodeRect(layout, id)));
}

/** Would a wire from `from` to `to` close a loop? (Is `from` already reachable from `to`?) */
export function wouldLoop(layout: Layout, from: NodeRef, to: NodeRef): boolean {
  const seen = new Set<NodeRef>();
  const stack: NodeRef[] = [to];
  while (stack.length) {
    const n = stack.pop() as NodeRef;
    if (n === from) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const [a, b] of layout.edges) if (a === n) stack.push(b);
  }
  return false;
}

export const skillOf = (model: ModelId, word: WordId): number =>
  (tune.models[model].skill as Record<string, number>)[word] ?? tune.run.unknownSkill;

/** Chance a node lands one word, after prompt dilution from its other words. */
export const wordChance = (model: ModelId, word: WordId, wordCount: number): number =>
  Math.max(0, Math.min(1, (skillOf(model, word) / 100) * (1 - tune.models[model].dilute * Math.max(0, wordCount - 1))));

export const nodeCost = (cfg: NodeCfg): number =>
  tune.models[cfg.model].price * (tune.run.overheadTokens + cfg.words.reduce((s, w) => s + tune.words[w].cost, 0));

export function canConnect(layout: Layout, level: Level, from: NodeRef, to: NodeRef, kind: Kind): { ok: boolean; reason: string } {
  if (from === 'out' || to === 'in' || from === to) return { ok: false, reason: 'Wires run from an output port to an input port' };
  if (from !== 'in' && !layout.nodes[from]) return { ok: false, reason: 'Nothing to wire from' };
  if (to !== 'out' && !layout.nodes[to]) return { ok: false, reason: 'Nothing to wire to' };
  if (!outKinds(layout, level, from).includes(kind)) return { ok: false, reason: 'That node has no such output' };
  if (!inKinds(layout, level, to).includes(kind)) {
    return to === 'out' ? { ok: false, reason: `DELIVER wants ${level.outKind}, this carries ${kind}` } : { ok: false, reason: `${MODEL_INFO[layout.nodes[to].model].label} cannot take ${kind}` };
  }
  if (wouldLoop(layout, from, to)) return { ok: false, reason: 'That wire would make a loop' };
  return { ok: true, reason: '' };
}

/** Nodes that sit on a path from INPUT to DELIVER. Only these run and cost tokens. */
export function activeNodes(layout: Layout): Set<NodeRef> {
  const fwd = new Set<NodeRef>(['in']);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [a, b] of layout.edges) if (fwd.has(a) && !fwd.has(b)) (fwd.add(b), (changed = true));
  }
  const back = new Set<NodeRef>(['out']);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [a, b] of layout.edges) if (back.has(b) && !back.has(a)) (back.add(a), (changed = true));
  }
  const both = new Set<NodeRef>();
  for (const r of fwd) if (back.has(r)) both.add(r);
  return both;
}

/** Active nodes in an order where every node comes after the nodes that feed it. */
export function runOrder(layout: Layout, active: Set<NodeRef>): NodeRef[] {
  const left = new Set(active);
  const order: NodeRef[] = [];
  while (left.size) {
    const ready = [...left].filter((n) => layout.edges.every(([a, b]) => b !== n || !left.has(a) || !active.has(a)));
    if (!ready.length) break; // unreachable: loops are refused when wiring
    ready.sort();
    for (const n of ready) {
      order.push(n);
      left.delete(n);
    }
  }
  return order;
}

export interface Estimate {
  valid: boolean;
  reason: string;
  active: Set<NodeRef>;
  costPerTask: number;
  /** Seconds per task along the slowest path. */
  time: number;
  finish: Partial<Record<NodeRef, number>>;
}

export function estimate(layout: Layout): Estimate {
  const active = activeNodes(layout);
  const finish: Partial<Record<NodeRef, number>> = { in: 0 };
  let costPerTask = 0;
  for (const ref of runOrder(layout, active)) {
    if (ref === 'in') continue;
    const preds = layout.edges.filter(([a, b]) => b === ref && active.has(a)).map(([a]) => finish[a] ?? 0);
    const start = preds.length ? Math.max(...preds) : 0;
    if (ref === 'out') {
      finish.out = start;
      continue;
    }
    const cfg = layout.nodes[ref] as NodeCfg;
    finish[ref] = start + tune.models[cfg.model].latency;
    costPerTask += nodeCost(cfg);
  }
  const valid = active.has('out');
  return { valid, reason: valid ? '' : 'Wire INPUT > agent > DELIVER', active, costPerTask, time: finish.out ?? 0, finish };
}

export interface TaskResult {
  passed: boolean;
  covered: WordId[];
}

export interface BatchResult {
  levelId: string;
  tasks: TaskResult[];
  delivered: number;
  successRate: number;
  costPerTask: number;
  totalCost: number;
  time: number;
  stars: number;
  /** Fraction of tasks where each needed word made it into the output. */
  wordRates: Partial<Record<WordId, number>>;
  /** Active edges and node finish times, for the run animation. */
  edges: Edge[];
  finish: Partial<Record<NodeRef, number>>;
}

/**
 * Stratified dice. Every decision (a node landing a word, a node passing a word on) gets its own
 * shuffled deck of N evenly spaced values, one per task. Over a batch the number of successes
 * tracks the odds closely, so results read as "about 85%" instead of swinging with luck, and a
 * fixed seed makes the same layout always give the same result.
 */
class Draws {
  private decks = new Map<string, number[]>();
  constructor(
    private seed: number,
    private n: number,
  ) {}

  at(key: string, task: number): number {
    let deck = this.decks.get(key);
    if (!deck) {
      let h = this.seed >>> 0;
      for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
      const rng = mulberry32(h);
      deck = Array.from({ length: this.n }, (_, i) => i);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      this.decks.set(key, deck);
    }
    return (deck[task] + 0.5) / this.n;
  }
}

function runTask(layout: Layout, est: Estimate, draws: Draws, task: number): TaskResult {
  const carried = new Map<NodeRef, Set<WordId>>([['in', new Set()]]);
  let delivered = new Set<WordId>();
  for (const ref of runOrder(layout, est.active)) {
    if (ref === 'in') continue;
    const inbound = layout.edges.filter(([a, b]) => b === ref && est.active.has(a));
    const inherited = new Set<WordId>();
    for (const [a] of inbound) for (const w of carried.get(a) ?? []) inherited.add(w);
    if (ref === 'out') {
      delivered = inherited;
      continue;
    }
    const cfg = layout.nodes[ref] as NodeCfg;
    const here = new Set<WordId>();
    for (const w of inherited) if (draws.at(`${ref}:pass:${w}`, task) >= tune.models[cfg.model].error) here.add(w);
    for (const w of cfg.words) if (draws.at(`${ref}:own:${w}`, task) < wordChance(cfg.model, w, cfg.words.length)) here.add(w);
    carried.set(ref, here);
  }
  return { passed: false, covered: [...delivered] };
}

/** Fixed seed per level: the same layout always gives the same result, so tuning is repeatable. */
export function simulateBatch(layout: Layout, level: Level): BatchResult | null {
  const est = estimate(layout);
  if (!est.valid) return null;
  const tasks: TaskResult[] = [];
  const draws = new Draws(level.seed, tune.run.batchSize);
  for (let i = 0; i < tune.run.batchSize; i++) {
    const t = runTask(layout, est, draws, i);
    t.passed = level.needs.every((w) => t.covered.includes(w));
    tasks.push(t);
  }
  const delivered = tasks.filter((t) => t.passed).length;
  const successRate = delivered / tasks.length;
  const wordRates: Partial<Record<WordId, number>> = {};
  for (const w of level.needs) wordRates[w] = tasks.filter((t) => t.covered.includes(w)).length / tasks.length;
  const g = level.goals;
  let stars = 0;
  if (successRate >= g.success) {
    stars = 1;
    if (est.costPerTask <= g.cost) {
      stars = 2;
      if (est.time <= g.time) stars = 3;
    }
  }
  return {
    levelId: level.id,
    tasks,
    delivered,
    successRate,
    costPerTask: est.costPerTask,
    totalCost: est.costPerTask * tasks.length,
    time: est.time,
    stars,
    wordRates,
    edges: layout.edges.filter(([a, b]) => est.active.has(a) && est.active.has(b)),
    finish: est.finish,
  };
}

export const levelById = (id: string): Level => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
