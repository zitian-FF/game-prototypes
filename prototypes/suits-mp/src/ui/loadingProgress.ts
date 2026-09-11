import Phaser from 'phaser';
import { PIXEL_RATIO } from '../render/pixelRatio';

// Shown during HostGameScene/PlayerGameScene's preload() - the asset set
// (card backdrops/frames/symbols/faces/nameplates per Deity, several files
// over 1MB) can take a visible amount of time to fetch, and until now
// nothing was drawn during that gap: a blank/frozen canvas. Wired to the
// Scene's own LoaderPlugin events (this.load's 'progress'/'loaderror'), not
// a timed/faked animation, so the bar always reflects the loader's real
// file-count progress (Phaser's own `this.load.progress`, computed as
// completed-or-failed files / total queued files - the standard, accurate
// signal every Phaser loading-bar follows, not an approximation).
//
// Canvas-drawn rather than a DOM overlay (root CLAUDE.md's UI split is
// about who *designs* HUD chrome, not a hard rule against canvas-drawn
// status text - see e.g. this same file's siblings: orientation.ts's
// portrait guard and PlayerGameScene's own "Host disconnected" overlay,
// both plain canvas primitives): preload() runs before create(), so the
// canvas already exists and needs no coordination with when the DOM
// overlay container becomes available, and a two-primitive progress bar
// doesn't need the Claude-Design-mockup pipeline real HUD chrome goes
// through.
//
// preloadCardArt() loads assets/manifest.json first, then enqueues the
// loose images it lists once that completes - so the loader's total file
// count grows partway through the load. Phaser's `progress` value is
// recomputed against the queue as it stands at each event, so this can
// show a brief backwards jump right after the manifest itself finishes
// (100% of "1 file" becoming ~4% of "26 files") - an honest artifact of
// showing the loader's real state at each moment, not a bug to mask with a
// smoothed fake number.

export interface AssetLoadProgress {
  /** True once any file in the queue has failed to load. */
  hadError: boolean;
  /** Reveals a retry prompt below the (now-stalled) bar; wires `onRetry` to it. */
  showRetry(onRetry: () => void): void;
  /** Removes the whole overlay. Call once the real game view has actually rendered. */
  hide(): void;
}

const BAR_WIDTH_MARGIN = 60;
const BAR_HEIGHT = 10;

export function showAssetLoadProgress(scene: Phaser.Scene): AssetLoadProgress {
  // preload() runs before create() sets up each scene's usual camera
  // zoom/center (see e.g. HostGameScene.create()) - apply the same PIXEL_RATIO
  // zoom/center here too so this overlay's logical coordinates line up with
  // every other scene element instead of rendering at the raw, unzoomed
  // physical-pixel scale. create()'s later identical call is a harmless repeat.
  scene.cameras.main.setZoom(PIXEL_RATIO);
  const width = scene.scale.width / PIXEL_RATIO;
  const height = scene.scale.height / PIXEL_RATIO;
  scene.cameras.main.centerOn(width / 2, height / 2);

  const barWidth = Math.min(240, width - BAR_WIDTH_MARGIN);
  const barX = width / 2 - barWidth / 2;
  const barY = height / 2 + 20;

  const container = scene.add.container(0, 0).setDepth(20000);

  const bg = scene.add.rectangle(0, 0, width, height, 0x05080a, 0.97).setOrigin(0);
  const title = scene.add
    .text(width / 2, height / 2 - 30, 'Preparing the cards...', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#d8c078',
      align: 'center',
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);

  const track = scene.add.graphics();
  track.fillStyle(0x1c2422, 1);
  track.fillRoundedRect(barX, barY, barWidth, BAR_HEIGHT, BAR_HEIGHT / 2);
  track.lineStyle(1, 0x3a4442, 1);
  track.strokeRoundedRect(barX, barY, barWidth, BAR_HEIGHT, BAR_HEIGHT / 2);

  const fill = scene.add.graphics();

  const pctText = scene.add
    .text(width / 2, barY + BAR_HEIGHT + 16, '0%', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#9ecab8',
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);

  const statusText = scene.add
    .text(width / 2, barY + BAR_HEIGHT + 64, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#e0796a',
      align: 'center',
      wordWrap: { width: width - BAR_WIDTH_MARGIN },
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);

  container.add([bg, title, track, fill, pctText, statusText]);

  const redraw = (progress: number): void => {
    fill.clear();
    fill.fillStyle(0xcaa24e, 1);
    const w = Phaser.Math.Clamp(progress, 0, 1) * barWidth;
    if (w > 0) fill.fillRoundedRect(barX, barY, w, BAR_HEIGHT, BAR_HEIGHT / 2);
    pctText.setText(`${Math.round(Phaser.Math.Clamp(progress, 0, 1) * 100)}%`);
  };
  redraw(scene.load.progress);

  const handle: AssetLoadProgress = {
    hadError: false,
    showRetry(onRetry) {
      statusText.setText('Something failed to load.\nTap here to try again.');
      statusText.setColor('#e0796a');
      statusText.setInteractive({ useHandCursor: true });
      statusText.once(Phaser.Input.Events.POINTER_DOWN, onRetry);
    },
    hide() {
      scene.load.off(Phaser.Loader.Events.PROGRESS, redraw);
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
      container.destroy();
    },
  };

  function onFileError(file: Phaser.Loader.File): void {
    handle.hadError = true;
    console.error(`suits-mp asset load: failed to load "${file.key}" from ${file.src}`);
  }

  scene.load.on(Phaser.Loader.Events.PROGRESS, redraw);
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);

  return handle;
}
