import { tune } from '../tune';
import type { Intent } from '../input/intents';
import { anchorAround, anchorNear } from './board';
import { type Kind, LEVELS, type Level, MODEL_INFO, type NodeRef } from './content';
import { type BatchResult, type Layout, type NodeCfg, canConnect, canPlace, emptyLayout, estimate, simulateBatch } from './sim';

export const SAVE_KEY = 'agents-io:save:v4';

export interface Best {
  stars: number;
  successRate: number;
  costPerTask: number;
  time: number;
}

interface Save {
  v: 4;
  levelIdx: number;
  unlocked: number;
  layouts: Record<string, Layout>;
  best: Record<string, Best>;
}

export type GameEvent =
  | { type: 'changed' }
  | { type: 'toast'; text: string; bad: boolean }
  | { type: 'run'; result: BatchResult }
  | { type: 'level' };

/** Game state and rules. Reads intents only; knows nothing about pointers, keys or Phaser. */
export class Game {
  levelIdx = 0;
  unlocked = 0;
  layouts: Record<string, Layout> = {};
  best: Record<string, Best> = {};
  /** Selected node ('in', 'out' or an agent id). */
  selected: NodeRef | null = null;
  /** Index into layout.edges of the selected wire. */
  selectedWire: number | null = null;
  /** Empty spot chosen for a new agent: its top-left cell. */
  pending: { x: number; y: number } | null = null;
  running = false;
  /** Result waiting to be shown (set when a run finishes). */
  result: BatchResult | null = null;
  /** Latest result per level, kept for the side panel (not saved). */
  lastRuns: Record<string, BatchResult> = {};
  private listeners: ((e: GameEvent) => void)[] = [];

  constructor() {
    this.load();
  }

  on(fn: (e: GameEvent) => void): void {
    this.listeners.push(fn);
  }

  private emit(e: GameEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private toast(text: string, bad = true): void {
    this.emit({ type: 'toast', text, bad });
  }

  get level(): Level {
    return LEVELS[this.levelIdx];
  }

  get layout(): Layout {
    return (this.layouts[this.level.id] ??= emptyLayout());
  }

  /** Total tokens a batch of the current layout would spend. */
  runCost(): number {
    const est = estimate(this.layout);
    return est.valid ? est.costPerTask * tune.run.batchSize : 0;
  }

  /** Why Run is unavailable, or '' when it is ready. */
  runBlock(): string {
    if (this.running) return 'Running';
    return estimate(this.layout).reason;
  }

  private clearSelection(): void {
    this.selected = null;
    this.selectedWire = null;
    this.pending = null;
  }

  handle(i: Intent): void {
    if (this.running) return;
    const layout = this.layout;
    switch (i.type) {
      case 'select':
        this.clearSelection();
        this.selected = i.ref;
        break;
      case 'selectWire':
        this.clearSelection();
        this.selectedWire = i.index;
        break;
      case 'escape':
        this.clearSelection();
        this.result = null;
        break;
      case 'closeResult':
        this.result = null;
        break;
      case 'cell': {
        const a = anchorAround(i.bx, i.by);
        if (!canPlace(layout, a.x, a.y)) {
          this.toast('No room for an agent there');
          return;
        }
        this.clearSelection();
        this.pending = a;
        break;
      }
      case 'place': {
        if (!this.pending) return;
        const id = `n${layout.next++}`;
        const cfg: NodeCfg = { model: i.model, words: [], x: this.pending.x, y: this.pending.y };
        layout.nodes[id] = cfg;
        this.clearSelection();
        this.selected = id;
        break;
      }
      case 'move': {
        const n = layout.nodes[i.id];
        if (!n) return;
        const a = anchorNear(i.bx, i.by);
        if (a.x === n.x && a.y === n.y) return;
        if (!canPlace(layout, a.x, a.y, i.id)) {
          this.toast('No room for an agent there');
          return;
        }
        n.x = a.x;
        n.y = a.y;
        break;
      }
      case 'remove':
        this.removeNode(i.id);
        break;
      case 'delete':
        if (this.selectedWire !== null) {
          layout.edges.splice(this.selectedWire, 1);
          this.selectedWire = null;
        } else if (this.selected && this.selected !== 'in' && this.selected !== 'out') this.removeNode(this.selected);
        else return;
        break;
      case 'word': {
        const cfg = this.selectedCfg();
        if (!cfg) {
          this.toast('Select an agent first');
          return;
        }
        const at = cfg.words.indexOf(i.word);
        if (at >= 0) cfg.words.splice(at, 1);
        else if (cfg.words.length >= tune.models[cfg.model].slots) {
          this.toast(`${MODEL_INFO[cfg.model].label} holds ${tune.models[cfg.model].slots} words`);
          return;
        } else cfg.words.push(i.word);
        break;
      }
      case 'wire': {
        const { from, to, kind } = i;
        const has = layout.edges.findIndex(([a, b, k]) => a === from && b === to && k === kind);
        if (has >= 0) {
          layout.edges.splice(has, 1);
          this.selectedWire = null;
          break;
        }
        const ok = canConnect(layout, this.level, from, to, kind);
        if (!ok.ok) {
          this.toast(ok.reason);
          return;
        }
        layout.edges.push([from, to, kind]);
        this.selectedWire = null;
        break;
      }
      case 'clear':
        this.layouts[this.level.id] = emptyLayout();
        this.clearSelection();
        break;
      case 'level':
        if (i.index < 0 || i.index >= LEVELS.length) return;
        if (i.index > this.unlocked) {
          this.toast('Earn a star on the previous level first');
          return;
        }
        this.levelIdx = i.index;
        this.clearSelection();
        this.result = null;
        this.emit({ type: 'level' });
        break;
      case 'run':
        this.startRun();
        return;
      default:
        return; // view intents (zoom, pan, fit) belong to the scene
    }
    this.save();
    this.emit({ type: 'changed' });
  }

  private removeNode(id: NodeRef): void {
    delete this.layout.nodes[id];
    this.layout.edges = this.layout.edges.filter(([a, b]) => a !== id && b !== id);
    this.clearSelection();
  }

  private startRun(): void {
    const block = this.runBlock();
    if (block) {
      this.toast(block);
      return;
    }
    const result = simulateBatch(this.layout, this.level) as BatchResult;
    this.running = true;
    this.clearSelection();
    const prev = this.best[this.level.id];
    if (!prev || result.stars > prev.stars || (result.stars === prev.stars && result.successRate > prev.successRate)) {
      this.best[this.level.id] = { stars: result.stars, successRate: result.successRate, costPerTask: result.costPerTask, time: result.time };
    }
    if (result.stars > 0) this.unlocked = Math.max(this.unlocked, Math.min(LEVELS.length - 1, this.levelIdx + 1));
    this.save();
    this.emit({ type: 'run', result });
    this.emit({ type: 'changed' });
  }

  /** Called by the scene when the run animation has played out. */
  finishRun(result: BatchResult): void {
    this.running = false;
    this.result = result;
    this.lastRuns[result.levelId] = result;
    this.emit({ type: 'changed' });
  }

  private selectedCfg(): NodeCfg | null {
    return this.cfgOf(this.selected);
  }

  cfgOf(ref: NodeRef | null): NodeCfg | null {
    return ref === null || ref === 'in' || ref === 'out' ? null : (this.layout.nodes[ref] ?? null);
  }

  /** Can a wire be drawn from `from` to `to` right now? (Used for drag feedback.) */
  wireOk(from: NodeRef, to: NodeRef, kind: Kind): boolean {
    return canConnect(this.layout, this.level, from, to, kind).ok;
  }

  // ------------------------------------------------------------ save / load

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Save;
      if (s.v !== 4) return;
      this.levelIdx = Math.min(s.levelIdx, LEVELS.length - 1);
      this.unlocked = Math.min(s.unlocked, LEVELS.length - 1);
      this.layouts = s.layouts ?? {};
      this.best = s.best ?? {};
    } catch {
      /* corrupt or unavailable save: start fresh */
    }
  }

  save(): void {
    const data: Save = { v: 4, levelIdx: this.levelIdx, unlocked: this.unlocked, layouts: this.layouts, best: this.best };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable: play on without saving */
    }
  }

  resetSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}
