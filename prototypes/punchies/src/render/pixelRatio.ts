// Phaser 3 dropped the old global `resolution` game-config option, so
// there's no single knob for "render at device pixel density" anymore.
// The equivalent today: size the canvas backing store at devicePixelRatio
// (main.ts), then zoom every camera by the same factor and re-center it on
// the unchanged logical world (see applyCameraPixelRatio) so all layout and
// gameplay math stays in logical pixels. Capped at 2x - many phones report
// 3x+, and the extra sharpness above 2x is barely visible while adding real
// fill-rate cost.
import type Phaser from 'phaser';

export const PIXEL_RATIO = Math.min(Math.ceil(window.devicePixelRatio || 1), 2);

// Logical (CSS-pixel) play space. Landscape phone proportions.
export const LOGICAL_WIDTH = 844;
export const LOGICAL_HEIGHT = 390;

export function applyCameraPixelRatio(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setZoom(PIXEL_RATIO);
  cam.centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
}
