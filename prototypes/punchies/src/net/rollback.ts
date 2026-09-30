import { createSimState, step } from '../sim/sim';
import type { FrameInput, SimEvent, SimState } from '../sim/types';

// Rollback netcode. Both peers run the same deterministic sim. The local
// player's input is applied after a small fixed delay (net.inputDelayFrames);
// the remote player's input, when it hasn't arrived yet, is PREDICTED (held
// stick/guard carry over, taps don't). When the real remote input arrives
// and differs from the prediction, the sim restores the snapshot from that
// tick and re-simulates up to now. A late packet therefore costs a small
// visual correction instead of a freeze. If the remote falls more than
// net.maxRollbackFrames behind, the sim waits (stall) like lockstep would.
//
// No Phaser here: MatchScene drives it and it's tested headless.

export type PackedInput = [number, number, number];

export interface InputPacket {
  k: 'inp';
  round: number;
  from: number; // tick of the first entry
  d: PackedInput[];
  adv: number; // sender's frame advantage, for time sync

}

export interface HashPacket {
  k: 'hash';
  round: number;
  tick: number;
  h: number;
}

const HASH_EVERY = 60;
const GUARD_BIT = 32;
// At most one skipped tick per this many ticks, so sync is smooth.
const SYNC_WAIT_EVERY = 10;

export function packInput(i: FrameInput): PackedInput {
  const bits =
    (i.jab ? 1 : 0) | (i.cross ? 2 : 0) | (i.hook ? 4 : 0) | (i.uppercut ? 8 : 0) | (i.dodge ? 16 : 0) | (i.guard ? GUARD_BIT : 0);
  return [i.mx, i.my, bits];
}

export function unpackInput([mx, my, b]: PackedInput): FrameInput {
  return {
    mx,
    my,
    jab: (b & 1) !== 0,
    cross: (b & 2) !== 0,
    hook: (b & 4) !== 0,
    uppercut: (b & 8) !== 0,
    dodge: (b & 16) !== 0,
    guard: (b & GUARD_BIT) !== 0,
  };
}

// FNV-1a over the JSON of the sim state. Only used for the 1 Hz desync check.
export function hashState(s: SimState): number {
  const str = JSON.stringify(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const same = (a: PackedInput, b: PackedInput) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export class Rollback {
  sim: SimState;
  private local = new Map<number, PackedInput>();
  private remote = new Map<number, PackedInput>();
  // What we assumed for remote ticks we simulated without real input.
  private predicted = new Map<number, PackedInput>();
  // State at the START of each tick still inside the rollback window.
  private snapshots = new Map<number, SimState>();
  // Events already shown per tick, so re-simulation doesn't replay them.
  private shown = new Map<number, Set<string>>();
  private nextLocalTick: number;
  // All remote ticks below this are known.
  private remoteConfirmed: number;
  private lastRemote: PackedInput = [0, 0, 0];
  private rollbackFrom = Infinity;
  private readonly redundancy: number;
  private localHashes = new Map<number, number>();
  private remoteHashes = new Map<number, number>();
  private nextHashTick = HASH_EVERY;
  desynced = false;
  private remoteAdv = 0;
  private lastSyncWait = 0;
  rollbacks = 0;
  rolledBackFrames = 0;

  constructor(
    readonly localIdx: 0 | 1,
    readonly delay: number,
    readonly maxRollback: number,
    readonly round: number,
    private sendInputs: (p: InputPacket) => void,
    private sendHash: (p: HashPacket) => void,
  ) {
    this.sim = createSimState({ timed: true, fighters: [{}, {}] });
    const neutral: PackedInput = [0, 0, 0];
    for (let t = 0; t < delay; t++) {
      this.local.set(t, neutral);
      this.remote.set(t, neutral);
    }
    this.nextLocalTick = delay;
    this.remoteConfirmed = delay;
    this.redundancy = delay + maxRollback + 6;
  }

  canScheduleLocal(): boolean {
    return this.nextLocalTick <= this.sim.tick + this.delay;
  }

  scheduleLocal(input: FrameInput): void {
    this.local.set(this.nextLocalTick, packInput(input));
    this.nextLocalTick++;
    this.local.delete(this.nextLocalTick - this.redundancy - 1);
    this.flushInputs();
  }

  flushInputs(): void {
    let from = Math.max(0, this.nextLocalTick - this.redundancy);
    while (from < this.nextLocalTick && !this.local.has(from)) from++;
    const d: PackedInput[] = [];
    for (let t = from; t < this.nextLocalTick; t++) d.push(this.local.get(t)!);
    this.sendInputs({ k: 'inp', round: this.round, from, d, adv: this.localAdvantage() });
  }

  receiveInputs(p: InputPacket): void {
    if (p.round !== this.round) return;
    this.remoteAdv = p.adv;
    for (let i = 0; i < p.d.length; i++) {
      const t = p.from + i;
      if (t < this.remoteConfirmed || this.remote.has(t)) continue;
      const v = p.d[i];
      this.remote.set(t, v);
      const guess = this.predicted.get(t);
      if (guess) {
        this.predicted.delete(t);
        if (!same(guess, v) && t < this.rollbackFrom) this.rollbackFrom = t;
      }
    }
    while (this.remote.has(this.remoteConfirmed)) {
      this.lastRemote = this.remote.get(this.remoteConfirmed)!;
      this.remoteConfirmed++;
    }
  }

  receiveHash(p: HashPacket): void {
    if (p.round !== this.round) return;
    this.remoteHashes.set(p.tick, p.h);
    this.checkHash(p.tick);
  }

  // The local input for this tick must exist, and we must not run further
  // ahead of the remote than the rollback window allows.
  canStep(): boolean {
    return this.local.has(this.sim.tick) && this.sim.tick - this.remoteConfirmed < this.maxRollback;
  }

  // How far our sim runs ahead of the newest remote input we have.
  private localAdvantage(): number {
    return this.sim.tick - (this.remoteConfirmed - this.delay);
  }

  // Time sync (GGPO style): if we're further ahead of the opponent than they
  // are of us (e.g. they joined late or run slower), skip an occasional tick
  // so both clocks meet in the middle. Without this the faster side sits at
  // the rollback cap and every misprediction costs the full window.
  shouldWaitForSync(): boolean {
    const drift = (this.localAdvantage() - this.remoteAdv) / 2;
    if (drift < 1 || this.sim.tick - this.lastSyncWait < SYNC_WAIT_EVERY) return false;
    this.lastSyncWait = this.sim.tick;
    return true;
  }

  private remoteFor(t: number): PackedInput {
    const real = this.remote.get(t);
    if (real) return real;
    // Prediction: the opponent keeps holding what they held; no new taps.
    const guess: PackedInput = [this.lastRemote[0], this.lastRemote[1], this.lastRemote[2] & GUARD_BIT];
    this.predicted.set(t, guess);
    return guess;
  }

  private simulate(t: number): SimEvent[] {
    this.snapshots.set(t, structuredClone(this.sim));
    const mine = this.local.get(t)!;
    const theirs = this.remoteFor(t);
    const inputs: [FrameInput, FrameInput] =
      this.localIdx === 0 ? [unpackInput(mine), unpackInput(theirs)] : [unpackInput(theirs), unpackInput(mine)];
    const events = step(this.sim, inputs);
    // Only surface events not already shown for this tick.
    const seen = this.shown.get(t) ?? new Set<string>();
    const fresh = events.filter((e) => {
      const key = JSON.stringify(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    this.shown.set(t, seen);
    return fresh;
  }

  // Apply any pending correction: restore the snapshot from the first
  // mispredicted tick and re-simulate up to the present.
  resolve(): SimEvent[] {
    if (this.rollbackFrom === Infinity) return [];
    const from = this.rollbackFrom;
    this.rollbackFrom = Infinity;
    const snap = this.snapshots.get(from);
    if (!snap || from >= this.sim.tick) return [];
    const target = this.sim.tick;
    this.sim = structuredClone(snap);
    const out: SimEvent[] = [];
    for (let t = from; t < target; t++) {
      // Stale guesses for these ticks are re-made (or replaced by real input).
      this.predicted.delete(t);
      out.push(...this.simulate(t));
    }
    this.rollbacks++;
    this.rolledBackFrames += target - from;
    return out;
  }

  // Advance one tick. Caller must check canStep() first.
  step(): SimEvent[] {
    const out = this.resolve();
    // A finished sim doesn't advance (a rollback may still un-finish it).
    if (!this.sim.result) out.push(...this.simulate(this.sim.tick));
    this.confirmAndPrune();
    return out;
  }

  // The match result, only once every input that led to it is real (a
  // predicted KO could still be rolled back).
  confirmedResult(): SimState['result'] {
    return this.sim.result && this.remoteConfirmed >= this.sim.tick ? this.sim.result : null;
  }

  private confirmAndPrune(): void {
    // Ticks below `confirmed` can never be rolled back again.
    const confirmed = Math.min(this.remoteConfirmed, this.sim.tick);
    while (this.nextHashTick <= confirmed) {
      const t = this.nextHashTick;
      const state = t === this.sim.tick ? this.sim : this.snapshots.get(t);
      if (state) {
        const h = hashState(state);
        this.localHashes.set(t, h);
        this.sendHash({ k: 'hash', round: this.round, tick: t, h });
        this.checkHash(t);
      }
      this.nextHashTick += HASH_EVERY;
    }
    for (const t of this.snapshots.keys()) if (t < confirmed - 1) this.snapshots.delete(t);
    for (const t of this.shown.keys()) if (t < confirmed - 1) this.shown.delete(t);
    for (const t of this.remote.keys()) if (t < confirmed - 1) this.remote.delete(t);
  }

  private checkHash(tick: number): void {
    const l = this.localHashes.get(tick);
    const r = this.remoteHashes.get(tick);
    if (l === undefined || r === undefined) return;
    if (l !== r) this.desynced = true;
    this.localHashes.delete(tick);
    this.remoteHashes.delete(tick);
  }
}
