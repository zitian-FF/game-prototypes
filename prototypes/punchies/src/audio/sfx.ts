// Placeholder sound cues synthesised with WebAudio, so hit feedback has
// sound without waiting on audio assets. Presentation only; never read by
// the sim.

import { audioOutput, getAudioSettings, unlockMixer } from './mixer';
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  ctx = unlockMixer();
}

// Mobile browsers only allow audio to start from a completed user gesture
// (touchend/click), not touchstart. Listen for those globally.
for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) {
  window.addEventListener(ev, unlockAudio, { capture: true, passive: true });
}

// Short filtered noise burst: the body of a punch impact.
function thud(gain: number, cutoff: number, dur: number): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(audioOutput('sfx')!);
  src.start(t);
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, delay = 0): void {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(audioOutput('sfx')!);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
  uiSelect: () => limited('select', 0.08, () => tone(760, 0.035, 'sine', 0.04, 900)),
  uiConfirm: () => limited('confirm', 0.08, () => { tone(660, 0.055, 'sine', 0.06); tone(990, 0.07, 'sine', 0.04, undefined, 0.035); }),
  uiBack: () => limited('back', 0.08, () => tone(620, 0.075, 'triangle', 0.05, 360)),
  denied: () => limited('denied', 0.25, () => tone(165, 0.08, 'triangle', 0.07, 100)),
  emergency: () => { tone(330, 0.09, 'triangle', 0.06, 180); tone(220, 0.1, 'triangle', 0.05, 120, 0.1); },
  recovered: () => { tone(440, 0.06, 'sine', 0.05); tone(660, 0.09, 'sine', 0.05, undefined, 0.06); },
  roundBell: () => bell(0),
  timeUp: () => { bell(0); bell(0.3); },
  tokenEarned: () => { tone(1175, 0.08, 'sine', 0.06); tone(1568, 0.1, 'sine', 0.04, undefined, 0.065); },
  tokenSpent: () => tone(800, 0.1, 'triangle', 0.05, 400),
  shopOpen: () => tone(500, 0.09, 'sine', 0.04, 750),
  chestOpen: () => { thud(0.14, 1200, 0.08); tone(300, 0.12, 'triangle', 0.05, 700); },
  rewardReveal: () => { tone(784, 0.09, 'sine', 0.05); tone(988, 0.1, 'sine', 0.05, undefined, 0.09); tone(1568, 0.3, 'sine', 0.05, undefined, 0.18); },
  victory: () => { tone(523, 0.13, 'triangle', 0.07); tone(659, 0.13, 'triangle', 0.07, undefined, 0.13); tone(784, 0.32, 'triangle', 0.07, undefined, 0.26); },
  defeat: () => { tone(392, 0.14, 'triangle', 0.06); tone(330, 0.14, 'triangle', 0.05, undefined, 0.14); tone(262, 0.25, 'triangle', 0.05, undefined, 0.28); },
  whoosh: () => tone(500, 0.06, 'triangle', 0.05, 250),
  sour: () => {
    thud(0.35, 900, 0.07);
    tone(120, 0.07, 'sine', 0.2, 70);
  },
  sweet: () => {
    thud(0.6, 2200, 0.1);
    tone(150, 0.12, 'sine', 0.35, 50);
    tone(1400, 0.08, 'sine', 0.06, 1800);
  },
  counter: () => {
    thud(0.8, 3000, 0.14);
    tone(160, 0.14, 'sawtooth', 0.18, 60);
    tone(880, 0.1, 'square', 0.1);
    tone(1320, 0.14, 'square', 0.1, undefined, 0.07);
  },
  // Taking a hit: duller and lower than landing one.
  hurt: () => {
    thud(0.55, 600, 0.12);
    tone(90, 0.14, 'sine', 0.3, 45);
  },
  hurtBig: () => {
    thud(0.8, 800, 0.18);
    tone(80, 0.22, 'sawtooth', 0.2, 35);
    tone(220, 0.18, 'square', 0.08, 110, 0.05);
  },
  ready: () => tone(440, 0.18, 'square', 0.08),
  go: () => {
    tone(880, 0.25, 'square', 0.1);
    tone(1320, 0.3, 'square', 0.06, undefined, 0.05);
  },
  block: () => {
    thud(0.25, 500, 0.06);
    tone(220, 0.07, 'triangle', 0.14, 160);
  },
  perfectGuard: () => {
    tone(1046, 0.18, 'sine', 0.12);
    tone(1568, 0.25, 'sine', 0.1, undefined, 0.05);
  },
  dodge: () => tone(900, 0.07, 'sine', 0.05, 1500),
  stun: () => tone(600, 0.5, 'triangle', 0.1, 200),
  starsReady: () => {
    tone(784, 0.08, 'square', 0.07);
    tone(1175, 0.12, 'square', 0.07, undefined, 0.08);
  },
  ko: () => {
    tone(300, 0.9, 'sawtooth', 0.18, 40);
    // Ring bell: ding ding ding.
    for (let i = 0; i < 3; i++) bell(0.25 + i * 0.38);
  },
};

const lastCue = new Map<string, number>();
function limited(key: string, seconds: number, play: () => void): void {
  unlockAudio();
  if (!ctx || getAudioSettings().muted || getAudioSettings().sfx === 0) return;
  const now = ctx.currentTime;
  if (now - (lastCue.get(key) ?? -Infinity) < seconds) return;
  lastCue.set(key, now); play();
}

// Boxing-ring bell strike: inharmonic sine partials with a long ring-out.
function bell(delay: number): void {
  const base = 1180;
  const partials: [number, number, number][] = [
    [1, 0.16, 1.4],
    [2.76, 0.07, 0.9],
    [5.4, 0.04, 0.5],
    [8.93, 0.02, 0.3],
  ];
  for (const [ratio, gain, dur] of partials) tone(base * ratio, dur, 'sine', gain, undefined, delay);
}
