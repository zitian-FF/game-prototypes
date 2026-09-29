import Phaser from 'phaser';
import { PIXEL_RATIO, VIEW } from './render/pixelRatio';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { TrainingScene } from './scenes/TrainingScene';
import { setupOrientation } from './orientation/orientation';

mountDebugPanelIfRequested();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#111111',
  input: { activePointers: 4 },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW.width * PIXEL_RATIO,
    height: VIEW.height * PIXEL_RATIO,
  },
});

setupOrientation(game);
game.scene.add('Training', TrainingScene, true);
