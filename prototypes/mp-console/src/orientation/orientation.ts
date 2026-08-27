import Phaser from 'phaser';
import { PIXEL_RATIO } from '../render/pixelRatio';

export type ExpectedOrientation = 'landscape' | 'portrait';

// Each scene is laid out for one orientation (host = landscape, player =
// portrait). No hard orientation lock (unreliable cross-browser, unsupported
// on iOS Safari for plain web pages) - instead an overlay covers the scene
// whenever the device's actual orientation doesn't match what it expects.
export function createOrientationGuard(scene: Phaser.Scene, expected: ExpectedOrientation): void {
  // scene.scale.width/height are the actual canvas backing-store size,
  // which is logical size * PIXEL_RATIO (see main.ts); divide back out so
  // this overlay is laid out in the same logical/CSS pixel space as
  // everything else, unaffected by device pixel ratio.
  const width = scene.scale.width / PIXEL_RATIO;
  const height = scene.scale.height / PIXEL_RATIO;

  const overlay = scene.add.container(0, 0).setDepth(10000);
  const bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.94).setOrigin(0);
  const text = scene.add
    .text(width / 2, height / 2, 'Please rotate your device', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: width - 40 },
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);
  overlay.add([bg, text]);

  const portraitQuery = window.matchMedia('(orientation: portrait)');

  const update = () => {
    const actual: ExpectedOrientation = portraitQuery.matches ? 'portrait' : 'landscape';
    overlay.setVisible(actual !== expected);
  };
  update();

  portraitQuery.addEventListener('change', update);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    portraitQuery.removeEventListener('change', update);
  });
}
