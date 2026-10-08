import Phaser from 'phaser';
import { PlayScene } from './scenes/PlayScene';
import { W, H, PIXEL_RATIO } from './pixelRatio';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: W * PIXEL_RATIO,
  height: H * PIXEL_RATIO,
  backgroundColor: '#0d1426',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [PlayScene],
});
