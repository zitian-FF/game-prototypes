import Phaser from 'phaser';

export type ExpectedOrientation = 'landscape' | 'portrait';

// Each scene is laid out for one orientation (host = landscape, player =
// portrait). No hard orientation lock (unreliable cross-browser, unsupported
// on iOS Safari for plain web pages) - instead an overlay covers the scene
// whenever the device's actual orientation doesn't match what it expects.
export function createOrientationGuard(scene: Phaser.Scene, expected: ExpectedOrientation): void {
  const width = scene.scale.width;
  const height = scene.scale.height;

  const overlay = scene.add.container(0, 0).setDepth(10000);
  const bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.94).setOrigin(0);
  const text = scene.add
    .text(width / 2, height / 2, 'Please rotate your device', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: width - 40 },
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
