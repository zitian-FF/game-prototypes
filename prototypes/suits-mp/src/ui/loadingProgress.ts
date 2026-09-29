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

const BAR_WIDTH_MARGIN = 62;
const BAR_HEIGHT = 12;

export function showAssetLoadProgress(scene: Phaser.Scene, titleText = 'Preparing the game'): AssetLoadProgress {
  // Apply the logical camera scale before BootScene.create() runs.
  scene.cameras.main.setZoom(PIXEL_RATIO);
  const width = scene.scale.width / PIXEL_RATIO;
  const height = scene.scale.height / PIXEL_RATIO;
  scene.cameras.main.centerOn(width / 2, height / 2);

  const barWidth = Math.min(286, width - BAR_WIDTH_MARGIN);
  const barX = width / 2 - barWidth / 2;
  const barY = height / 2 + 71;

  const container = scene.add.container(0, 0).setDepth(20000);

  const bg = scene.add.rectangle(0, 0, width, height, 0x050a12, 1).setOrigin(0);
  const ornament = scene.add.graphics();
  const cx = width / 2;
  const cy = height / 2 - 126;
  for (let i = 0; i < 56; i++) {
    ornament.fillStyle(0xbed0d6, 0.05 + (i % 5) * 0.025);
    ornament.fillCircle((i * 137.508 + 13) % width, (i * 251.17 + 31) % height, i % 8 === 0 ? 1.1 : 0.55);
  }
  ornament.lineStyle(1, 0x84999e, 0.25);
  ornament.strokeCircle(cx, cy, 145);
  ornament.strokeCircle(cx, cy, 133);
  ornament.lineStyle(0.7, 0x9e8a66, 0.34);
  ornament.strokeCircle(cx, cy, 104);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    ornament.lineBetween(cx + Math.cos(angle) * 133, cy + Math.sin(angle) * 133, cx + Math.cos(angle) * 145, cy + Math.sin(angle) * 145);
  }
  for (const [angle, color] of [[-Math.PI / 2, 0x5caec0], [0, 0x8961a7], [Math.PI / 2, 0xa0914f], [Math.PI, 0x5b866d]]) {
    const x = cx + Math.cos(angle) * 139;
    const y = cy + Math.sin(angle) * 139;
    ornament.fillStyle(color, 0.65);
    ornament.fillCircle(x, y, 3);
  }
  ornament.lineStyle(1, 0x967b4e, 0.75);
  ornament.lineBetween(barX - 8, barY - 10, barX + barWidth + 8, barY - 10);
  ornament.lineBetween(barX - 8, barY + BAR_HEIGHT + 10, barX + barWidth + 8, barY + BAR_HEIGHT + 10);
  ornament.lineStyle(1, 0x8e7954, 0.62);
  ornament.strokeRect(barX - 4, barY - 4, barWidth + 8, BAR_HEIGHT + 8);

  const brand = scene.add
    .text(cx, cy - 8, 'SUITS OF\nMADNESS', {
      fontFamily: '"IM Fell English SC", Georgia, serif',
      fontSize: '30px',
      color: '#e4ddce',
      align: 'center',
      lineSpacing: -2,
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);
  const title = scene.add
    .text(cx, barY - 38, titleText, {
      fontFamily: '"Cormorant Unicase", Georgia, serif',
      fontSize: '17px',
      color: '#d8bd83',
      align: 'center',
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);

  const track = scene.add.graphics();
  track.fillStyle(0x122028, 1);
  track.fillRect(barX, barY, barWidth, BAR_HEIGHT);
  track.lineStyle(1, 0x556266, 0.7);
  track.strokeRect(barX, barY, barWidth, BAR_HEIGHT);

  const fill = scene.add.graphics();

  const pctText = scene.add
    .text(width / 2, barY + BAR_HEIGHT + 34, '0%', {
      fontFamily: '"Cormorant Unicase", Georgia, serif',
      fontSize: '14px',
      color: '#a9c3c2',
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);

  const statusText = scene.add
    .text(width / 2, barY + BAR_HEIGHT + 86, '', {
      fontFamily: '"Cormorant Unicase", Georgia, serif',
      fontSize: '16px',
      color: '#e0796a',
      align: 'center',
      wordWrap: { width: width - BAR_WIDTH_MARGIN },
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);

  container.add([bg, ornament, brand, title, track, fill, pctText, statusText]);

  const redraw = (progress: number): void => {
    fill.clear();
    fill.fillStyle(0xb79661, 1);
    const w = Phaser.Math.Clamp(progress, 0, 1) * barWidth;
    if (w > 0) fill.fillRect(barX + 2, barY + 2, Math.max(0, w - 4), BAR_HEIGHT - 4);
    pctText.setText(`${Math.round(Phaser.Math.Clamp(progress, 0, 1) * 100)}%`);
  };
  redraw(scene.load.progress);

  const handle: AssetLoadProgress = {
    hadError: false,
    showRetry(onRetry) {
      statusText.setText('Some assets could not load.\nTap to retry.');
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
