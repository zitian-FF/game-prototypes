import Phaser from 'phaser';
import { Ui } from '../ui/ui';
import { clientTune } from '../clientTune';
import { VERSION_STAMP } from '../version.generated';

export const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

/** Backing-store scale: the game buffer is logical size times this, undone by camera zoom. */
export const DPR = Math.min(window.devicePixelRatio || 1, clientTune.dpr.max);

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
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

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
