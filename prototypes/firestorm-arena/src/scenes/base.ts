import Phaser from 'phaser';
import { Ui } from '../ui/ui';
import { clientTune } from '../clientTune';
import { VERSION_STAMP } from '../version.generated';
import { intents } from '../input/intents';

export const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

/** Backing-store scale: the game buffer is logical size times this, undone by camera zoom. */
export let DPR = Math.min(window.devicePixelRatio || 1, clientTune.dpr.max);

/** Re-read devicePixelRatio (browser zoom, fullscreen, another monitor). Returns true if it changed. */
export function refreshDpr(): boolean {
  const next = Math.min(window.devicePixelRatio || 1, clientTune.dpr.max);
  if (Math.abs(next - DPR) < 1e-6) return false;
  DPR = next;
  return true;
}

function computeUiScale(): number {
  // Desktop keeps 1:1. On a touch device the layout is drawn smaller in logical pixels so every
  // control grows on screen: the smaller the window, the larger the scale, within sane bounds.
  if (!intents.touch) return 1;
  const k = Math.min(window.innerWidth / 900, window.innerHeight / 520);
  return Math.min(1.5, Math.max(0.8, k));
}

/** Responsive scale: logical size is the window size divided by this. */
export let UI_SCALE = computeUiScale();
intents.scale = UI_SCALE;

/** Re-read the UI scale (rotation, resize, first touch). Returns true if it changed. */
export function refreshUiScale(): boolean {
  const next = computeUiScale();
  if (Math.abs(next - UI_SCALE) < 1e-6) return false;
  UI_SCALE = next;
  intents.scale = next;
  return true;
}

/** Device pixels per logical pixel: what camera zoom and text resolution use. */
export function bufferScale(): number {
  return DPR * UI_SCALE;
}

/** Real window size in CSS pixels, and the logical size scenes lay out in. */
export function logicalSize(): { w: number; h: number } {
  return { w: window.innerWidth / UI_SCALE, h: window.innerHeight / UI_SCALE };
}

let probe: HTMLDivElement | null = null;

/** Notch and rounded-corner insets in logical pixels (zero on devices without them). */
export function safeInsets(): { l: number; r: number; t: number; b: number } {
  if (!intents.touch) return { l: 0, r: 0, t: 0, b: 0 };
  try {
    if (!probe) {
      probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      document.body.appendChild(probe);
    }
    const c = getComputedStyle(probe);
    const px = (v: string) => (parseFloat(v) || 0) / UI_SCALE;
    return { t: px(c.paddingTop), r: px(c.paddingRight), b: px(c.paddingBottom), l: px(c.paddingLeft) };
  } catch {
    return { l: 0, r: 0, t: 0, b: 0 };
  }
}

/** Phone or tablet, by the pointer that has been used. */
export function isTouch(): boolean {
  return intents.touch;
}

/** Shared scene plumbing: DPR-correct camera, a UI layer and the version stamp. */
export abstract class BaseScene extends Phaser.Scene {
  protected ui!: Ui;

  private leaving = false;

  /** Switch scenes once: update keeps running until the switch completes. */
  protected go(key: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start(key);
  }

  protected setup(): void {
    this.leaving = false;
    this.ui = new Ui(this, bufferScale());
    this.applyCamera();
    const onResize = () => this.applyCamera();
    this.scale.on('resize', onResize);
    // The pixel ratio can change under a running game (fullscreen, browser zoom, another monitor).
    const onDpr = () => {
      this.ui.setDpr(bufferScale());
      this.onDprChanged();
      this.applyCamera();
    };
    this.game.events.on('dpr', onDpr);
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      this.game.events.off('dpr', onDpr);
    });
  }

  /** Scenes with their own text objects re-resolve them here. */
  protected onDprChanged(): void {}

  /** Layout and game code work in logical pixels; zoom maps them onto the bigger buffer. */
  protected applyCamera(): void {
    const { w, h } = logicalSize();
    const cam = this.cameras.main;
    cam.setZoom(bufferScale());
    cam.centerOn(w / 2, h / 2);
  }

  protected drawVersion(): void {
    this.ui.text(VERSION_STAMP, 6, 4, { size: 9, color: '#ffffff', alpha: 0.3 });
  }
}
