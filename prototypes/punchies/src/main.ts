import Phaser from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, PIXEL_RATIO } from './render/pixelRatio';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { TrainingScene } from './scenes/TrainingScene';

mountDebugPanelIfRequested();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#111111',
  input: { activePointers: 4 },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: LOGICAL_WIDTH * PIXEL_RATIO,
    height: LOGICAL_HEIGHT * PIXEL_RATIO,
  },
});

game.scene.add('Training', TrainingScene, true);
