// Small synthesized cues keep the prototype responsive without asset downloads.
const KEY = 'suits-mp:sound:v1';
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* storage may be unavailable */ }
let context: AudioContext | null = null;

export function soundEnabled(): boolean { return enabled; }

export function toggleSound(): boolean {
  enabled = !enabled;
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* session-only fallback */ }
  return enabled;
}

function tone(frequency: number, duration: number, gain: number, wave: OscillatorType, endFrequency?: number, delay = 0): void {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  } catch { /* missing or blocked WebAudio should never block play */ }
}

export const sfx = {
  tap: () => tone(390, 0.045, 0.018, 'triangle', 260),
  card: () => tone(240, 0.085, 0.032, 'triangle', 110),
  play: () => {
    tone(180, 0.13, 0.045, 'triangle', 90);
    tone(620, 0.10, 0.013, 'sine', 410, 0.035);
  },
  victory: () => {
    tone(392, 0.25, 0.035, 'sine');
    tone(523, 0.27, 0.030, 'sine', undefined, 0.12);
    tone(784, 0.42, 0.025, 'sine', undefined, 0.24);
  },
};
