// Placeholder sound cues synthesised with WebAudio, so hit feedback has
// sound without waiting on audio assets. Presentation only; never read by
// the sim.

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
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
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
  whoosh: () => tone(500, 0.06, 'triangle', 0.05, 250),
  sour: () => tone(140, 0.08, 'square', 0.12, 80),
  sweet: () => {
    tone(180, 0.1, 'square', 0.16, 70);
    tone(1400, 0.08, 'sine', 0.08, 1800);
  },
  counter: () => {
    tone(160, 0.14, 'sawtooth', 0.18, 60);
    tone(880, 0.1, 'square', 0.1);
    tone(1320, 0.14, 'square', 0.1, undefined, 0.07);
  },
  block: () => tone(220, 0.07, 'triangle', 0.14, 160),
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
  ko: () => tone(300, 0.9, 'sawtooth', 0.18, 40),
};
