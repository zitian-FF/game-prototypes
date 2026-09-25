import Phaser from 'phaser';
import { PIXEL_RATIO } from '../render/pixelRatio';

// Shown once during BootScene's preload(), before the lobby or game starts.
// It reflects Phaser's real LoaderPlugin progress and reports failed files.
// The manifest is loaded first, then its images are queued, so progress can
// briefly move backwards when that larger queue appears.

export interface AssetLoadProgress {
  /** True once any file in the queue has failed to load. */
  hadError: boolean;
  /** Reveals a retry prompt below the (now-stalled) bar; wires `onRetry` to it. */
  showRetry(onRetry: () => void): void;
  /** Removes the overlay after startup assets have loaded. */
  hide(): void;
}

const BAR_WIDTH_MARGIN = 60;
const BAR_HEIGHT = 10;

export function showAssetLoadProgress(scene: Phaser.Scene, titleText = 'Preparing the game...'): AssetLoadProgress {
  // Apply the logical camera scale before BootScene.create() runs.
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
    .text(width / 2, height / 2 - 30, titleText, {
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
