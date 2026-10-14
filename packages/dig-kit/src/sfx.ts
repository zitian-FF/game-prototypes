import type Phaser from 'phaser';

type Wave = OscillatorType;

export interface SfxOptions {
  /** 0 to 1 master volume, read on every sound so a debug panel can change it live. */
  volume: () => number;
  /** Octave fraction added per consecutive hit. */
  pitchStep: () => number;
  /** Cap on consecutive hits that raise the pitch. */
  pitchStepMax: () => number;
}

/**
 * Placeholder sounds synthesised with the WebAudio context Phaser already
 * owns, so there are no audio files and no extra dependency.
 */
export class Sfx {
  private ctx: AudioContext | null;
  private master: GainNode | null = null;

  constructor(scene: Phaser.Scene, private opts: SfxOptions) {
    const mgr = scene.sound as unknown as { context?: AudioContext };
    this.ctx = mgr.context ?? null;
  }

  private out(): GainNode | null {
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    this.master.gain.value = this.opts.volume();
    return this.master;
  }

  tone(freq: number, dur: number, type: Wave, vol: number, slideTo?: number, delay = 0): void {
    const out = this.out();
    if (!out || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur: number, vol: number, cutoff: number, delay = 0): void {
    const out = this.out();
    if (!out || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(out);
    src.start(t);
  }

  private pitch(step: number): number {
    return Math.pow(2, Math.min(step, this.opts.pitchStepMax()) * this.opts.pitchStep());
  }

  rollStart(): void {
    this.noise(0.18, 0.5, 2400);
    this.tone(180, 0.12, 'square', 0.12, 320);
  }

  dieLand(i: number): void {
    this.tone(520 + (i % 5) * 40, 0.05, 'square', 0.08);
  }

  /** A hit. `step` is the number of consecutive hits so far; it raises the pitch. */
  hit(step: number, glancing: boolean): void {
    const p = this.pitch(step);
    if (glancing) {
      this.tone(150 * p, 0.07, 'triangle', 0.18);
      this.noise(0.05, 0.3, 1200);
    } else {
      this.tone(240 * p, 0.09, 'square', 0.2, 120 * p);
      this.noise(0.07, 0.45, 3000);
    }
  }

  strikeBreak(step: number): void {
    const p = this.pitch(step);
    this.noise(0.22, 0.7, 1800);
    this.tone(110 * p, 0.2, 'sawtooth', 0.22, 55 * p);
  }

  critical(): void {
    this.tone(110, 0.22, 'sawtooth', 0.35, 40);
    this.tone(660, 0.1, 'square', 0.18, 990);
    this.noise(0.25, 0.8, 4000);
  }

  wild(): void {
    this.tone(220, 0.35, 'sawtooth', 0.22, 880);
    this.tone(330, 0.35, 'triangle', 0.22, 1320, 0.03);
    this.noise(0.3, 0.6, 5000);
  }

  lucky(): void {
    [660, 830, 990, 1320].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.24, undefined, i * 0.055));
    this.noise(0.2, 0.5, 6000);
  }

  miss(): void {
    this.tone(120, 0.08, 'sine', 0.1, 80);
  }

  treasure(): void {
    [880, 1175, 1760].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.22, undefined, i * 0.07));
  }

  cleared(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.25, undefined, i * 0.1));
  }

  uiTap(): void {
    this.tone(400, 0.05, 'square', 0.1);
  }
}
