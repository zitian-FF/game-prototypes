import type Phaser from 'phaser';

// Logical world; all layout and rules use these pixels.
export const W = 360;
export const H = 640;

// Canvas buffer pixels per logical pixel, capped for fill rate. Phaser 3 has
// no global resolution option, so the game size is W*PR by H*PR and every
// camera zooms by PR (see applyCameraPixelRatio).
export const PIXEL_RATIO = (() => {
  const dpr = window.devicePixelRatio || 1;
  const shownW = Math.min(window.innerWidth || W, ((window.innerHeight || H) * W) / H);
  const cap = window.matchMedia?.('(pointer: coarse)').matches ? 2 : 3;
  return Math.max(1, Math.min(Math.ceil((shownW * dpr) / W), cap));
})();

export function applyCameraPixelRatio(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setZoom(PIXEL_RATIO);
  cam.centerOn(W / 2, H / 2);
}
