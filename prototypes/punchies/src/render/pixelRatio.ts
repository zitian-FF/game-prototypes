// Phaser 3 dropped the old global `resolution` game-config option, so
// there's no single knob for "render at device pixel density" anymore.
// The equivalent today: size the canvas backing store at devicePixelRatio
// (main.ts), then zoom every camera by the same factor and re-center it on
// the unchanged logical world (see applyCameraPixelRatio) so all layout and
// gameplay math stays in logical pixels. Capped at 2x - many phones report
// 3x+, and the extra sharpness above 2x is barely visible while adding real
// fill-rate cost.
import type Phaser from 'phaser';

// Render scale: canvas buffer pixels per logical pixel. It follows the size
// the game is actually shown at (so fullscreen on a big screen stays sharp,
// not a small buffer stretched), capped for fill-rate: 2x on touch devices
// (many phones report 3x+), 3x elsewhere. `let` is a live binding, so every
// importer sees updates.
export let PIXEL_RATIO = 1;

export function computeRenderScale(): number {
  const dpr = window.devicePixelRatio || 1;
  const long = Math.max(window.innerWidth, window.innerHeight) || WORLD_WIDTH;
  const short = Math.min(window.innerWidth, window.innerHeight) || WORLD_HEIGHT;
  // FIT: the canvas is as wide as the screen allows for its aspect ratio.
  const shownW = Math.min(long, (short * VIEW.width) / VIEW.height);
  const cap = window.matchMedia?.('(pointer: coarse)').matches ? 2 : 3;
  return Math.max(1, Math.min(Math.ceil((shownW * dpr) / VIEW.width), cap));
}

// Re-evaluate after the display changed. Returns true when it changed.
export function updateRenderScale(): boolean {
  const next = computeRenderScale();
  if (next === PIXEL_RATIO) return false;
  PIXEL_RATIO = next;
  return true;
}

// Fixed logical world. The ring and all gameplay live in this space on
// every device (so PvP peers share identical geometry).
export const WORLD_WIDTH = 844;
export const WORLD_HEIGHT = 390;

// Responsive view: the visible area grows beyond the world to match the
// device's landscape aspect ratio (wider phones get extra width, squarer
// tablets extra height). HUD and controls anchor to VIEW edges.
export function computeView() {
  const long = Math.max(window.innerWidth, window.innerHeight) || WORLD_WIDTH;
  const short = Math.min(window.innerWidth, window.innerHeight) || WORLD_HEIGHT;
  const aspect = long / short;
  const worldAspect = WORLD_WIDTH / WORLD_HEIGHT;
  const width = aspect >= worldAspect ? Math.round(WORLD_HEIGHT * aspect) : WORLD_WIDTH;
  const height = aspect >= worldAspect ? WORLD_HEIGHT : Math.round(WORLD_WIDTH / aspect);
  const left = (WORLD_WIDTH - width) / 2;
  const top = (WORLD_HEIGHT - height) / 2;
  return { width, height, left, top, right: left + width, bottom: top + height, cx: WORLD_WIDTH / 2, cy: WORLD_HEIGHT / 2 };
}

export const VIEW = computeView();
PIXEL_RATIO = computeRenderScale();

// Screen shape changes (foldable, fullscreen) while a fight is on are held
// here and applied when the next scene is built, so a running fight never
// has its layout pulled out from under it.
let pendingView: ReturnType<typeof computeView> | null = null;

export function setPendingView(v: ReturnType<typeof computeView>): void {
  pendingView = v;
}

export function applyCameraPixelRatio(scene: Phaser.Scene): void {
  if (pendingView) {
    Object.assign(VIEW, pendingView);
    pendingView = null;
  }
  const cam = scene.cameras.main;
  cam.setZoom(PIXEL_RATIO);
  cam.centerOn(VIEW.cx, VIEW.cy);
}

// Fit the current VIEW (the layout the scene was built for) inside the
// canvas's present size, centred.
export function refitCamera(scene: Phaser.Scene): void {
  const w = scene.scale.gameSize.width / PIXEL_RATIO;
  const h = scene.scale.gameSize.height / PIXEL_RATIO;
  const fit = Math.min(w / VIEW.width, h / VIEW.height);
  const cam = scene.cameras.main;
  cam.setZoom(PIXEL_RATIO * fit);
  cam.centerOn(VIEW.cx, VIEW.cy);
}
