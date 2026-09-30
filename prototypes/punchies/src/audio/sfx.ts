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
  src.connect(filter).connect(g).connect(ctx.destination);
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
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
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
  ko: () => tone(300, 0.9, 'sawtooth', 0.18, 40),
};
