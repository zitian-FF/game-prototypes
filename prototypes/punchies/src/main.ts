import Phaser from 'phaser';
import { PIXEL_RATIO, VIEW } from './render/pixelRatio';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { TrainingScene } from './scenes/TrainingScene';
import { MenuScene } from './scenes/MenuScene';
import { LobbyScene } from './scenes/LobbyScene';
import { MatchScene } from './scenes/MatchScene';
import { VsAIScene } from './scenes/VsAIScene';
import { LocalVsScene } from './scenes/LocalVsScene';
import { TutorialScene } from './scenes/TutorialScene';
import { CharSelectScene } from './scenes/CharSelectScene';
import { roomFromUrl } from './net/roomCode';
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
game.scene.add('Menu', MenuScene, false);
game.scene.add('Training', TrainingScene, false);
game.scene.add('Lobby', LobbyScene, false);
game.scene.add('Match', MatchScene, false);
game.scene.add('VsAI', VsAIScene, false);
game.scene.add('LocalVs', LocalVsScene, false);
game.scene.add('Tutorial', TutorialScene, false);
game.scene.add('CharSelect', CharSelectScene, false);

// ?room=ABC (from the host's QR code / link) skips straight to joining.
const room = roomFromUrl();
if (room) game.scene.start('Lobby', { role: 'guest', code: room });
else game.scene.start('Menu');
