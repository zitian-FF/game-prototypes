import Phaser from 'phaser';
import { Ui } from '../ui/ui';
import { clientTune } from '../clientTune';
import { VERSION_STAMP } from '../version.generated';

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

export function logicalSize(): { w: number; h: number } {
  return { w: window.innerWidth, h: window.innerHeight };
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
    this.ui = new Ui(this, DPR);
    this.applyCamera();
    const onResize = () => this.applyCamera();
    this.scale.on('resize', onResize);
    // The pixel ratio can change under a running game (fullscreen, browser zoom, another monitor).
    const onDpr = () => {
      this.ui.setDpr(DPR);
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
    cam.setZoom(DPR);
    cam.centerOn(w / 2, h / 2);
  }

  protected drawVersion(): void {
    this.ui.text(VERSION_STAMP, 6, 4, { size: 9, color: '#ffffff', alpha: 0.3 });
  }
}
