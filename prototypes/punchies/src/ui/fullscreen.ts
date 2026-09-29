import Phaser from 'phaser';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';

// Fullscreen button. Android and iPad support the Fullscreen API; iPhone
// Safari does not (Apple only allows it for video), so there the button
// explains "Add to Home Screen", which launches without browser bars.

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

function fullscreenSupported(): boolean {
  const d = document as FsDoc;
  return Boolean(document.fullscreenEnabled || d.webkitFullscreenEnabled);
}

function isFullscreen(): boolean {
  const d = document as FsDoc;
  return Boolean(document.fullscreenElement || d.webkitFullscreenElement);
}

function toggleFullscreen(): void {
  const d = document as FsDoc;
  if (isFullscreen()) {
    if (document.exitFullscreen) void document.exitFullscreen();
    else d.webkitExitFullscreen?.();
    return;
  }
  const el = document.documentElement as FsEl;
  const done = () => {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    o.lock?.('landscape').catch(() => {});
  };
  if (el.requestFullscreen) el.requestFullscreen().then(done, () => {});
  else el.webkitRequestFullscreen?.();
}

function isStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
}

export function addFullscreenButton(scene: Phaser.Scene, x: number, y: number): void {
  if (isStandalone()) return; // already launched from the Home Screen
  const btn = scene.add.circle(x, y, 13, 0x222222, 0.9).setStrokeStyle(2, 0xaaaaaa).setDepth(160);
  const g = scene.add.graphics().setDepth(161);
  g.lineStyle(2, 0xffffff, 1);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.lineBetween(x + sx * 6, y + sy * 6, x + sx * 6, y + sy * 2);
    g.lineBetween(x + sx * 6, y + sy * 6, x + sx * 2, y + sy * 6);
  }
  btn.setInteractive();
  // pointerup (touchend) counts as a user gesture for the Fullscreen API;
  // pointerdown from a touch does not.
  btn.on('pointerup', () => {
    if (fullscreenSupported()) toggleFullscreen();
    else showHomeScreenHint(scene);
  });
}

function showHomeScreenHint(scene: Phaser.Scene): void {
  const inFrame = window.top !== window.self;
  const lines = [
    'iPhone does not allow web games to go fullscreen.',
    '',
    'To play without the browser bars:',
    '1. Tap Share (the square with an arrow)',
    '2. Tap "Add to Home Screen"',
    '3. Launch Punchies from your Home Screen',
  ];
  if (inFrame) lines.push('', 'Do this from the game-only page:', location.href.split('?')[0]);
  lines.push('', '(tap to close)');
  const bg = scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x000000, 0.9).setDepth(300).setInteractive();
  const t = scene.add
    .text(VIEW.cx, VIEW.cy, lines.join('\n'), {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: VIEW.width - 40 },
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5)
    .setDepth(301);
  bg.once('pointerup', () => {
    bg.destroy();
    t.destroy();
  });
}
