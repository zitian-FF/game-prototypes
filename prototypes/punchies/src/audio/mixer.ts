export interface AudioSettings { bgm: number; sfx: number; muted: boolean }
const KEY = 'punchies:audio:v1';
const defaults: AudioSettings = { bgm: 0.35, sfx: 0.7, muted: false };
const level = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
function load(): AudioSettings {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { bgm: level(v.bgm, defaults.bgm), sfx: level(v.sfx, defaults.sfx), muted: v.muted === true }; }
  catch { return { ...defaults }; }
}
let settings = load();
let context: AudioContext | null = null;
let soundBus: GainNode | null = null;
let musicBus: GainNode | null = null;
const listeners = new Set<(settings: AudioSettings) => void>();
export function getAudioSettings(): AudioSettings { return { ...settings }; }
function apply(): void {
  if (!context) return;
  soundBus?.gain.setTargetAtTime(settings.muted ? 0 : settings.sfx, context.currentTime, 0.01);
  musicBus?.gain.setTargetAtTime(settings.muted ? 0 : settings.bgm, context.currentTime, 0.01);
}
export function setAudioSettings(next: Partial<AudioSettings>): void {
  settings = { bgm: level(next.bgm, settings.bgm), sfx: level(next.sfx, settings.sfx), muted: next.muted ?? settings.muted };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  apply(); listeners.forEach(fn => fn(getAudioSettings()));
}
// Music integration uses this same bus/settings, including global mute.
export function subscribeAudioSettings(fn: (settings: AudioSettings) => void): () => void {
  listeners.add(fn); fn(getAudioSettings()); return () => { listeners.delete(fn); };
}
export function unlockMixer(): AudioContext | null {
  try {
    if (!context) {
      context = new AudioContext(); soundBus = context.createGain(); musicBus = context.createGain();
      soundBus.connect(context.destination); musicBus.connect(context.destination); apply();
    }
    if (context.state === 'suspended') void context.resume().catch(() => {});
    return context;
  } catch { return null; }
}
export function audioOutput(channel: 'sfx' | 'bgm'): GainNode | null { return channel === 'sfx' ? soundBus : musicBus; }
