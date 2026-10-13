import { tune } from './tune';

// Generated sound effects: every sound is synthesised with Web Audio when it
// plays (oscillators, filtered noise, short envelopes), so there are no audio
// files and no download. The AudioContext is created on the first tap or key
// press because browsers block sound before a user gesture.

type Ctx = BaseAudioContext;
interface Sound {
  dur: number; // seconds, a little longer than the audible tail
  build: (ctx: Ctx, out: AudioNode, t: number) => void;
}

const noiseCache = new WeakMap<Ctx, AudioBuffer>();
function noise(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate), ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345; // fixed seed so the noise is the same everywhere
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 4294967296) * 2 - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

// Gain envelope: quick attack to `peak`, exponential decay to silence by `dur`.
function env(ctx: Ctx, t: number, attack: number, dur: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function tone(ctx: Ctx, out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, attack = 0.005): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = env(ctx, t, attack, dur, peak);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function burst(ctx: Ctx, out: AudioNode, t: number, filter: BiquadFilterType, f0: number, f1: number, q: number, dur: number, peak: number, attack = 0.005): void {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = env(ctx, t, attack, dur, peak);
  s.connect(f).connect(g).connect(out);
  s.start(t);
  s.stop(t + dur + 0.02);
}

const NOTE = (semi: number) => 523.25 * Math.pow(2, semi / 12); // C5 + semitones

function arpeggio(ctx: Ctx, out: AudioNode, t: number, semis: number[], gap: number, type: OscillatorType, peak: number): void {
  semis.forEach((s, i) => tone(ctx, out, t + i * gap, type, NOTE(s), NOTE(s) * 0.995, 0.22, peak, 0.008));
}

export const SOUNDS = {
  whoosh_jab: { dur: 0.16, build: (c, o, t) => burst(c, o, t, 'bandpass', 700, 2600, 1.2, 0.12, 0.3, 0.015) },
  whoosh_cross: { dur: 0.26, build: (c, o, t) => burst(c, o, t, 'bandpass', 350, 1800, 1.0, 0.2, 0.4, 0.04) },
  hit_body: {
    dur: 0.22,
    build: (c, o, t) => {
      tone(c, o, t, 'sine', 170, 55, 0.16, 0.7);
      burst(c, o, t, 'highpass', 1800, 1800, 0.7, 0.04, 0.35, 0.002);
    },
  },
  hit_head: {
    dur: 0.26,
    build: (c, o, t) => {
      tone(c, o, t, 'sine', 210, 60, 0.18, 0.6);
      tone(c, o, t, 'square', 520, 240, 0.09, 0.1);
      burst(c, o, t, 'highpass', 2200, 2200, 0.7, 0.05, 0.28, 0.002);
    },
  },
  kill: {
    dur: 0.5,
    build: (c, o, t) => {
      tone(c, o, t, 'sine', 150, 38, 0.3, 0.9);
      burst(c, o, t, 'lowpass', 2400, 300, 0.7, 0.25, 0.45, 0.003);
      tone(c, o, t + 0.05, 'triangle', 320, 950, 0.18, 0.28, 0.01);
    },
  },
  sour: { dur: 0.16, build: (c, o, t) => tone(c, o, t, 'triangle', 120, 70, 0.12, 0.35) },
  hurt: {
    dur: 0.4,
    build: (c, o, t) => {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      lp.connect(o);
      tone(c, lp, t, 'sawtooth', 130, 55, 0.3, 0.6);
      burst(c, o, t, 'lowpass', 1500, 200, 0.7, 0.22, 0.4, 0.003);
    },
  },
  combo_1: { dur: 0.45, build: (c, o, t) => arpeggio(c, o, t, [0, 4, 7], 0.07, 'triangle', 0.3) },
  combo_2: { dur: 0.55, build: (c, o, t) => arpeggio(c, o, t, [4, 7, 12], 0.07, 'triangle', 0.32) },
  combo_3: { dur: 0.65, build: (c, o, t) => arpeggio(c, o, t, [7, 12, 16, 19], 0.065, 'triangle', 0.34) },
  combo_4: { dur: 0.8, build: (c, o, t) => arpeggio(c, o, t, [12, 16, 19, 24, 28], 0.06, 'square', 0.2) },
  horde: {
    dur: 0.9,
    build: (c, o, t) => {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      lp.connect(o);
      tone(c, lp, t, 'sawtooth', 62, 48, 0.8, 0.7, 0.12);
      tone(c, lp, t, 'sawtooth', 64.5, 50, 0.8, 0.5, 0.12);
    },
  },
  ready: { dur: 0.4, build: (c, o, t) => arpeggio(c, o, t, [7, 12], 0.12, 'triangle', 0.3) },
  ui: { dur: 0.08, build: (c, o, t) => tone(c, o, t, 'square', 900, 700, 0.05, 0.15, 0.002) },
  end_win: { dur: 1.1, build: (c, o, t) => arpeggio(c, o, t, [0, 4, 7, 12], 0.14, 'triangle', 0.32) },
  end_lose: { dur: 1.1, build: (c, o, t) => arpeggio(c, o, t, [7, 3, 0, -5], 0.2, 'sawtooth', 0.14) },
} satisfies Record<string, Sound>;

export type SoundName = keyof typeof SOUNDS;

const MAX_VOICES = 16;

export class Sfx {
  muted = false;
  readonly log: SoundName[] = [];
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = 0;

  // Call once; creates the context on the first user gesture and suspends it while the page is hidden.
  bindGestures(): void {
    const unlock = () => {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
      }
      void this.ctx.resume();
    };
    for (const type of ['pointerdown', 'touchstart', 'keydown'] as const) window.addEventListener(type, unlock, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (!this.muted) void this.ctx.resume();
    });
  }

  play(name: SoundName): void {
    this.log.push(name);
    if (this.log.length > 400) this.log.shift();
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted || ctx.state !== 'running' || this.voices >= MAX_VOICES) return;
    this.master.gain.value = tune.audio.master;
    const sound: Sound = SOUNDS[name];
    const out = ctx.createGain();
    out.connect(this.master);
    this.voices++;
    sound.build(ctx, out, ctx.currentTime + 0.005);
    window.setTimeout(() => {
      out.disconnect();
      this.voices--;
    }, (sound.dur + 0.1) * 1000);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : tune.audio.master;
  }
}

// Test helper: render one sound offline to samples (mono, 44.1 kHz).
export async function renderSoundData(name: SoundName): Promise<Float32Array> {
  const sr = 44100;
  const sound: Sound = SOUNDS[name];
  const ctx = new OfflineAudioContext(1, Math.ceil(sr * sound.dur), sr);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  sound.build(ctx, out, 0);
  return (await ctx.startRendering()).getChannelData(0);
}

// Test helper: report a sound's level. Proves the synthesis produces real, unclipped
// audio without needing speakers.
export async function renderSound(name: SoundName): Promise<{ seconds: number; peak: number; rms: number; nonFinite: number }> {
  const sr = 44100;
  const data = await renderSoundData(name);
  let peak = 0;
  let sum = 0;
  let bad = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!Number.isFinite(v)) bad++;
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  return { seconds: data.length / sr, peak, rms: Math.sqrt(sum / data.length), nonFinite: bad };
}
