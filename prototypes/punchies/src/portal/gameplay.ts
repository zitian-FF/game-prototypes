import type Phaser from 'phaser';
import { track } from './analytics';
import { portal } from './select';

// De-duplicated gameplayStart / gameplayStop. Portals reject a start after a
// start (or a stop after a stop), so every call goes through here.
let active = false;
export function setGameplay(on: boolean): void {
  if (on === active) return;
  active = on;
  try { portal.gameplay(on); } catch { /* SDK errors must never break a fight */ }
}

/** A fight scene is live while it runs: not paused (menu open), not shut down. Call `setGameplay(false)` when its result shows. */
export function trackFightScene(scene: Phaser.Scene): void {
  setGameplay(true);
  track('fight', scene.scene.key, 'round_start');
  scene.events.on('pause', () => setGameplay(false));
  scene.events.on('resume', () => setGameplay(true));
  scene.events.once('shutdown', () => setGameplay(false));
}
