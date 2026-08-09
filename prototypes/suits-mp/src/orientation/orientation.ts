import Phaser from 'phaser';
import { PIXEL_RATIO } from '../render/pixelRatio';

// suits-mp is portrait-only on every screen, including the host (unlike
// mp-base/mp-net's landscape-host dashboard) - see root BRIEF for this
// prototype. This guard just covers a player rotating their phone
// sideways mid-session; there is no orientation this prototype ever wants
// to lay out for besides portrait.
export function createPortraitGuard(scene: Phaser.Scene): void {
  const width = scene.scale.width / PIXEL_RATIO;
  const height = scene.scale.height / PIXEL_RATIO;

  const overlay = scene.add.container(0, 0).setDepth(10000);
  const bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.94).setOrigin(0);
  const text = scene.add
    .text(width / 2, height / 2, 'Please rotate your device\nback to portrait', {
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
    overlay.setVisible(!portraitQuery.matches);
  };
  update();

  portraitQuery.addEventListener('change', update);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    portraitQuery.removeEventListener('change', update);
  });
}
