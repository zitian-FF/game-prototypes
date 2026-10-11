import type Phaser from 'phaser';
import rewardUrl from './stingers/reward.mp3?url';
import { audioOutput, unlockMixer } from './mixer';

const urls = { reward: rewardUrl };
type Cue = keyof typeof urls;
const bytes = new Map<Cue, Promise<ArrayBuffer>>();
export function preloadStingers(): void {
  for (const cue of Object.keys(urls) as Cue[]) if (!bytes.has(cue)) {
    const request = fetch(urls[cue]).then(r => { if (!r.ok) throw new Error('Stinger unavailable'); return r.arrayBuffer(); });
    void request.catch(() => {});
    bytes.set(cue, request);
  }
}
/** One-shot approved musical cues obey SFX volume/mute and stop with their overlay. */
export function playStinger(scene: Phaser.Scene, cue: Cue): () => void {
  preloadStingers();
  let cancelled = false;
  let source: AudioBufferSourceNode | null = null;
  const stop = () => { cancelled = true; source?.stop(); source?.disconnect(); source = null; };
  scene.events.once('shutdown', stop);
  const ctx = unlockMixer(), bus = audioOutput('sfx');
  if (ctx && bus) void bytes.get(cue)!.then(data => ctx.decodeAudioData(data.slice(0))).then(buffer => {
    if (cancelled) return;
    source = ctx.createBufferSource(); source.buffer = buffer; source.connect(bus);
    source.onended = () => { source?.disconnect(); source = null; scene.events.off('shutdown', stop); };
    source.start();
  }).catch(() => { /* An unavailable cue must never block results or acknowledgement. */ });
  return stop;
}
