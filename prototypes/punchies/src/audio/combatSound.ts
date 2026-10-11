import type { PunchType } from '../sim/types';

export type CombatCue = 'swing' | 'impact' | 'counter' | 'block' | 'perfect' | 'dodge' | 'evade' | 'guard' | 'step' | 'breath';
const weights: Record<PunchType, number> = { jab: 0.65, cross: 0.9, hook: 1, uppercut: 1.2 };
/** Shared procedural DSP for runtime and WAV auditions; physical cues use filtered noise and rounded bass. */
export function combatSamples(cue: CombatCue, rate: number, punch: PunchType = 'jab', sweet = false, head = false): Float32Array {
  const weight = weights[punch];
  const duration = cue === 'swing' ? 0.11 + weight * 0.05 : cue === 'impact' ? (sweet ? 0.16 : 0.09) : cue === 'perfect' ? 0.3 : cue === 'breath' ? 0.27 : cue === 'step' ? 0.065 : 0.15;
  const samples = new Float32Array(Math.ceil(rate * duration));
  let low = 0, mid = 0, phase = 0;
  const brightness: Record<PunchType, number> = { jab: 0.5, cross: 0.22, hook: 0.14, uppercut: 0.3 };
  let seed = 123456789;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1, t = i / rate, u = t / duration;
    low += 0.04 * (noise - low); mid += brightness[punch] * (noise - mid);
    const attack = Math.min(1, t / 0.002);
    const decay = Math.exp(-u * (cue === 'swing' || cue === 'breath' ? 3 : 7));
    phase += 2 * Math.PI * (cue === 'impact' ? (sweet ? 115 : 85) * weight * (1 - 0.6 * u) : 105 * (1 - 0.5 * u)) / rate;
    let value: number;
    if (cue === 'impact') value = (Math.sin(phase) * (sweet ? 0.42 : 0.22) + (sweet ? mid : low) * (head ? 0.9 : 0.65) + noise * (sweet ? 0.1 : 0.025)) * weight;
    else if (cue === 'swing') value = (mid - low) * 0.8 * weight * Math.sin(Math.PI * u) * (punch === 'uppercut' ? 0.6 + u : punch === 'hook' ? 0.7 + 0.3 * Math.sin(u * Math.PI * 2) : 1);
    else if (cue === 'counter') value = Math.sin(phase) * 0.3 + noise * 0.18;
    else if (cue === 'perfect') value = Math.sin(t * 2 * Math.PI * 1360) * 0.13 + Math.sin(t * 2 * Math.PI * 2217) * 0.07 + noise * 0.07;
    else if (cue === 'block') value = low * 0.85 + Math.sin(phase) * (sweet ? 0.18 : 0.12);
    else if (cue === 'step') value = low * (sweet ? 0.21 : 0.24) + mid * (sweet ? 0.075 : 0.06);
    else if (cue === 'guard') value = (mid - low) * 0.12;
    else if (cue === 'breath') value = (mid - low) * 0.3 * Math.sin(Math.PI * u);
    else value = (mid - low) * (cue === 'evade' ? 0.38 : 0.55) * Math.sin(Math.PI * u);
    samples[i] = Math.max(-0.85, Math.min(0.85, value * attack * decay));
  }
  return samples;
}
