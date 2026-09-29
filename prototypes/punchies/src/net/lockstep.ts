import { createSimState, step } from '../sim/sim';
import type { FrameInput, SimEvent, SimState } from '../sim/types';

// Deterministic lockstep with fixed input delay. Both peers run the same sim;
// tick N only advances once both players' inputs for tick N are known. Local
// input sampled now is scheduled `delay` ticks ahead, which hides that much
// latency. Every packet re-sends the last few unconfirmed inputs, so a
// dropped/late packet is covered by the next one. No Phaser here: this is
// driven by MatchScene and unit-testable on its own.

export type PackedInput = [number, number, number];

export interface InputPacket {
  k: 'inp';
  round: number;
  from: number; // tick of the first entry
  d: PackedInput[];
}

export interface HashPacket {
  k: 'hash';
  round: number;
  tick: number;
  h: number;
}

const HASH_EVERY = 60;

export function packInput(i: FrameInput): PackedInput {
  const bits =
    (i.jab ? 1 : 0) | (i.cross ? 2 : 0) | (i.hook ? 4 : 0) | (i.uppercut ? 8 : 0) | (i.dodge ? 16 : 0) | (i.guard ? 32 : 0);
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
    guard: (b & 32) !== 0,
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

export class Lockstep {
  readonly sim: SimState;
  private inputs: [Map<number, PackedInput>, Map<number, PackedInput>] = [new Map(), new Map()];
  private nextLocalTick: number;
  private localHashes = new Map<number, number>();
  private remoteHashes = new Map<number, number>();
  // How many recent local inputs every packet carries. The peer can lag at
  // most delay + 1 ticks behind us, and we can be delay ticks ahead of our
  // own sim, so this covers any single lost/late packet.
  private readonly redundancy: number;
  desynced = false;

  constructor(
    readonly localIdx: 0 | 1,
    readonly delay: number,
    readonly round: number,
    private sendInputs: (p: InputPacket) => void,
    private sendHash: (p: HashPacket) => void,
  ) {
    this.sim = createSimState({ timed: true, fighters: [{}, {}] });
    // The first `delay` ticks have no real input yet: both sides agree on
    // neutral for them.
    const neutral: PackedInput = [0, 0, 0];
    for (let t = 0; t < delay; t++) {
      this.inputs[0].set(t, neutral);
      this.inputs[1].set(t, neutral);
    }
    this.nextLocalTick = delay;
    this.redundancy = delay * 2 + 4;
  }

  get remoteIdx(): 0 | 1 {
    return this.localIdx === 0 ? 1 : 0;
  }

  // Schedule the local input for the next free tick (at most `delay` ahead
  // of the sim). Returns false when already that far ahead.
  canScheduleLocal(): boolean {
    return this.nextLocalTick < this.sim.tick + this.delay + 1;
  }

  scheduleLocal(input: FrameInput): void {
    const local = this.inputs[this.localIdx];
    local.set(this.nextLocalTick, packInput(input));
    this.nextLocalTick++;
    // Keep local history (the peer may still need it); prune the far past.
    local.delete(this.nextLocalTick - this.redundancy - 1);
    this.flushInputs();
  }

  // Re-send the most recent local inputs (called on every schedule, and can
  // be called as a keep-alive while stalled).
  flushInputs(): void {
    const local = this.inputs[this.localIdx];
    let from = Math.max(0, this.nextLocalTick - this.redundancy);
    while (from < this.nextLocalTick && !local.has(from)) from++;
    const d: PackedInput[] = [];
    for (let t = from; t < this.nextLocalTick; t++) d.push(local.get(t)!);
    this.sendInputs({ k: 'inp', round: this.round, from, d });
  }

  receiveInputs(p: InputPacket): void {
    if (p.round !== this.round) return;
    const map = this.inputs[this.remoteIdx];
    for (let i = 0; i < p.d.length; i++) {
      const t = p.from + i;
      if (t >= this.sim.tick && !map.has(t)) map.set(t, p.d[i]);
    }
  }

  receiveHash(p: HashPacket): void {
    if (p.round !== this.round) return;
    this.remoteHashes.set(p.tick, p.h);
    this.checkHash(p.tick);
  }

  canStep(): boolean {
    const t = this.sim.tick;
    return this.inputs[0].has(t) && this.inputs[1].has(t);
  }

  // Advance one tick. Caller must check canStep() first.
  step(): SimEvent[] {
    const t = this.sim.tick;
    const a = this.inputs[0].get(t)!;
    const b = this.inputs[1].get(t)!;
    // Remote input for t is no longer needed; local history is pruned in
    // scheduleLocal because the peer may still ask for it.
    this.inputs[this.remoteIdx].delete(t);
    const events = step(this.sim, [unpackInput(a), unpackInput(b)]);
    if (this.sim.tick % HASH_EVERY === 0) {
      const h = hashState(this.sim);
      this.localHashes.set(this.sim.tick, h);
      this.sendHash({ k: 'hash', round: this.round, tick: this.sim.tick, h });
      this.checkHash(this.sim.tick);
    }
    return events;
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
