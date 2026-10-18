import { tune } from '../tune';
import type { Intent } from '../input/intents';
import { LEVELS, type Level, MODEL_INFO, type NodeRef, type SlotId } from './content';
import { type BatchResult, type Layout, type NodeCfg, canConnect, emptyLayout, estimate, pruneEdges, simulateBatch } from './sim';

export const SAVE_KEY = 'agents-io:save:v1';

export interface Best {
  stars: number;
  successRate: number;
  costPerTask: number;
  time: number;
}

interface Save {
  v: 1;
  levelIdx: number;
  unlocked: number;
  layouts: Record<string, Layout>;
  best: Record<string, Best>;
  tokens: number;
  savedAt: number;
}

export type GameEvent =
  | { type: 'changed' }
  | { type: 'toast'; text: string; bad: boolean }
  | { type: 'run'; result: BatchResult };

/** Game state and rules. Reads intents only; knows nothing about pointers, keys or Phaser. */
export class Game {
  levelIdx = 0;
  unlocked = 0;
  layouts: Record<string, Layout> = {};
  best: Record<string, Best> = {};
  selected: NodeRef | null = null;
  running = false;
  /** Result waiting to be shown (set when a run finishes). */
  result: BatchResult | null = null;
  private tokens = tune.wallet.max;
  private tokensAt = Date.now();
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

  /** Wallet with real-time refill applied. */
  walletNow(now = Date.now()): number {
    return Math.min(tune.wallet.max, this.tokens + Math.max(0, (now - this.tokensAt) / 1000) * tune.wallet.refillPerSec);
  }

  runCost(): number {
    const est = estimate(this.layout);
    return est.valid ? est.costPerTask * tune.run.batchSize : 0;
  }

  /** Why Run is unavailable, or '' when it is ready. */
  runBlock(now = Date.now()): string {
    if (this.running) return 'Running';
    const est = estimate(this.layout);
    if (!est.valid) return est.reason;
    const need = this.runCost();
    const have = this.walletNow(now);
    if (have < need) return `Need ${need} tok, refill in ${Math.ceil((need - have) / tune.wallet.refillPerSec)}s`;
    return '';
  }

  handle(i: Intent, now = Date.now()): void {
    if (this.running) return;
    switch (i.type) {
      case 'select':
        this.selected = i.ref === this.selected ? this.selected : i.ref;
        break;
      case 'escape':
        this.selected = null;
        this.result = null;
        break;
      case 'closeResult':
        this.result = null;
        break;
      case 'place': {
        const prev = this.layout.nodes[i.slot];
        const info = MODEL_INFO[i.model];
        const cfg: NodeCfg = { model: i.model, words: (prev?.words ?? []).slice(0, tune.models[i.model].slots), out: info.out[0] };
        this.layout.nodes[i.slot] = cfg;
        this.selected = i.slot;
        const dropped = pruneEdges(this.layout, this.level);
        if (dropped) this.toast(`${dropped} wire${dropped > 1 ? 's' : ''} removed (type mismatch)`);
        break;
      }
      case 'remove':
        delete this.layout.nodes[i.slot];
        this.layout.edges = this.layout.edges.filter(([a, b]) => a !== i.slot && b !== i.slot);
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
      case 'cycleOut': {
        const cfg = this.selectedCfg();
        if (!cfg) return;
        const outs = MODEL_INFO[cfg.model].out;
        cfg.out = outs[(outs.indexOf(cfg.out) + 1) % outs.length];
        const dropped = pruneEdges(this.layout, this.level);
        if (dropped) this.toast(`${dropped} wire${dropped > 1 ? 's' : ''} removed (type mismatch)`);
        break;
      }
      case 'wire': {
        const { from, to } = i;
        const has = this.layout.edges.findIndex(([a, b]) => a === from && b === to);
        if (has >= 0) {
          this.layout.edges.splice(has, 1);
          break;
        }
        const ok = canConnect(this.layout, this.level, from, to);
        if (!ok.ok) {
          this.toast(ok.reason);
          return;
        }
        this.layout.edges.push([from, to]);
        break;
      }
      case 'clear':
        this.layouts[this.level.id] = emptyLayout();
        this.selected = null;
        break;
      case 'level':
        if (i.index < 0 || i.index >= LEVELS.length) return;
        if (i.index > this.unlocked) {
          this.toast('Earn a star on the previous level first');
          return;
        }
        this.levelIdx = i.index;
        this.selected = null;
        this.result = null;
        break;
      case 'run':
        this.startRun(now);
        return;
    }
    this.save(now);
    this.emit({ type: 'changed' });
  }

  private startRun(now: number): void {
    const block = this.runBlock(now);
    if (block) {
      this.toast(block);
      return;
    }
    const result = simulateBatch(this.layout, this.level) as BatchResult;
    this.tokens = this.walletNow(now) - result.totalCost;
    this.tokensAt = now;
    this.running = true;
    this.selected = null;
    const prev = this.best[this.level.id];
    if (!prev || result.stars > prev.stars || (result.stars === prev.stars && result.successRate > prev.successRate)) {
      this.best[this.level.id] = { stars: result.stars, successRate: result.successRate, costPerTask: result.costPerTask, time: result.time };
    }
    if (result.stars > 0) this.unlocked = Math.max(this.unlocked, Math.min(LEVELS.length - 1, this.levelIdx + 1));
    this.save(now);
    this.emit({ type: 'run', result });
    this.emit({ type: 'changed' });
  }

  /** Called by the scene when the run animation has played out. */
  finishRun(result: BatchResult): void {
    this.running = false;
    this.result = result;
    this.emit({ type: 'changed' });
  }

  private selectedCfg(): NodeCfg | null {
    const s = this.selected;
    return s && s !== 'in' && s !== 'out' ? this.layout.nodes[s] ?? null : null;
  }

  selectedSlot(): SlotId | null {
    const s = this.selected;
    return s && s !== 'in' && s !== 'out' ? s : null;
  }

  cfgOf(ref: NodeRef): NodeCfg | null {
    return ref === 'in' || ref === 'out' ? null : this.layout.nodes[ref] ?? null;
  }

  // ------------------------------------------------------------ save / load

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Save;
      if (s.v !== 1) return;
      this.levelIdx = Math.min(s.levelIdx, LEVELS.length - 1);
      this.unlocked = Math.min(s.unlocked, LEVELS.length - 1);
      this.layouts = s.layouts ?? {};
      this.best = s.best ?? {};
      // Wallet refills in real time, including while the tab was closed.
      this.tokens = s.tokens;
      this.tokensAt = s.savedAt;
    } catch {
      /* corrupt or unavailable save: start fresh */
    }
  }

  save(now = Date.now()): void {
    const tokens = this.walletNow(now);
    this.tokens = tokens;
    this.tokensAt = now;
    const data: Save = { v: 1, levelIdx: this.levelIdx, unlocked: this.unlocked, layouts: this.layouts, best: this.best, tokens, savedAt: now };
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
