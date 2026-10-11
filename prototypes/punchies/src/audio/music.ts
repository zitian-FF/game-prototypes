import type Phaser from 'phaser';
import { preloadStingers } from './stingers';
import { audioOutput, unlockMixer } from './mixer';

type Track = 'title' | 'charselect' | 'gameplay';
declare const __PUNCHIES_ASSET_BASE__: string;
declare const __PUNCHIES_MUSIC_EXTENSION__: 'mp3' | 'm4a';
const fights = new Set(['FirstFight', 'Training', 'Tutorial', 'VsAI', 'LocalVs', 'Match', 'Survival']);
const root = `${__PUNCHIES_ASSET_BASE__}prototypes/punchies/audio/`;

// Stream long tracks rather than decoding all three into memory on mobile.
export function installMusic(game: Phaser.Game): void {
  preloadStingers();
  const players = new Map<Track, { element: HTMLAudioElement; gain: GainNode }>();
  let selected: Track | null = null;
  let context: AudioContext | null = null;
  const contextChanged = () => { if (context?.state === 'running') play(); };
  function play(): void {
    if (!selected || document.hidden) return;
    const ctx = unlockMixer();
    if (ctx && ctx !== context) {
      context?.removeEventListener('statechange', contextChanged);
      context = ctx;
      context.addEventListener('statechange', contextChanged);
    }
    const bus = audioOutput('bgm');
    if (!ctx || !bus) return;
    let player = players.get(selected);
    if (!player) {
      const element = new Audio(`${root}${selected}.${__PUNCHIES_MUSIC_EXTENSION__}`);
      element.loop = true;
      element.preload = 'none';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(element).connect(gain).connect(bus);
      player = { element, gain };
      players.set(selected, player);
    }
    for (const [track, p] of players) {
      p.gain.gain.cancelScheduledValues(ctx.currentTime);
      p.gain.gain.setTargetAtTime(track === selected ? 1 : 0, ctx.currentTime, 0.15);
    }
    void player.element.play().catch(() => { /* Retry on the next user gesture. */ });
  }
  function update(): void {
    const scenes = game.scene.getScenes(true).map(s => s.scene.key);
    // A paused single-player fight remains the music owner beneath Settings.
    const fighting = [...fights].some(key => (key !== 'FirstFight' || !game.registry.get('firstFightComplete')) && (game.scene.isActive(key) || game.scene.isPaused(key)));
    const next: Track = fighting ? 'gameplay' : scenes.includes('CharSelect') ? 'charselect' : 'title';
    if (next !== selected) { selected = next; play(); }
    const ctx = context;
    if (ctx) for (const [track, p] of players) {
      if (track !== selected && p.gain.gain.value < 0.002) p.element.pause();
    }
  }
  // Try on initial scene readiness: browsers that permit autoplay start at once.
  // A rejected media play remains queued as selected; retry on a real gesture
  // and when the shared SFX/audio context finishes unlocking.
  function gesture(): void { play(); }
  function visibility(): void {
    if (document.hidden) for (const p of players.values()) p.element.pause();
    else play();
  }
  game.events.on('step', update);
  window.addEventListener('pointerdown', gesture, {capture:true,passive:true});
  window.addEventListener('keydown', gesture, {capture:true,passive:true});
  document.addEventListener('visibilitychange', visibility);
  game.events.once('destroy', () => {
    game.events.off('step', update);
    window.removeEventListener('pointerdown', gesture, true);
    window.removeEventListener('keydown', gesture, true);
    document.removeEventListener('visibilitychange', visibility);
    context?.removeEventListener('statechange', contextChanged);
    for (const p of players.values()) { p.element.pause(); p.element.removeAttribute('src'); p.element.load(); p.gain.disconnect(); }
  });
}
