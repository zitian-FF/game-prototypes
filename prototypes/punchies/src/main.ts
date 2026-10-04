import Phaser from 'phaser';
import { computeView, PIXEL_RATIO, refitCamera, setPendingView, updateRenderScale, VIEW } from './render/pixelRatio';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { TrainingScene } from './scenes/TrainingScene';
import { MenuScene } from './scenes/MenuScene';
import { LobbyScene } from './scenes/LobbyScene';
import { MatchScene } from './scenes/MatchScene';
import { VsAIScene } from './scenes/VsAIScene';
import { LocalVsScene } from './scenes/LocalVsScene';
import { TutorialScene } from './scenes/TutorialScene';
import { CharSelectScene } from './scenes/CharSelectScene';
import { ArtBootScene } from './render/art';
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

// Foldables (fold / unfold) and entering fullscreen change the screen's
// shape after load. Re-measure, resize the canvas to the new aspect so it
// fills the screen, and re-lay out menu-style scenes. A fight in progress
// keeps running (restarting it would break online play): its ring stays
// centred and the extra space is simply shown.
let resizeTimer = 0;
const MENU_SCENES = ['Menu', 'CharSelect'];
function onScreenShape(): void {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const v = computeView();
    const sharper = updateRenderScale();
    game.scale.setGameSize(v.width * PIXEL_RATIO, v.height * PIXEL_RATIO);
    // Existing text keeps the resolution it was made with: re-sharpen it.
    if (sharper) {
      for (const sc of game.scene.getScenes(false)) {
        for (const o of sc.children.list) if (o instanceof Phaser.GameObjects.Text) o.setResolution(PIXEL_RATIO);
      }
    }
    const active = game.scene.getScenes(true);
    if (active.every((sc) => MENU_SCENES.includes(sc.scene.key))) {
      // Menus: adopt the new shape and re-lay out.
      setPendingView(v);
      for (const sc of active) sc.scene.restart(sc.sys.settings.data);
    } else {
      // Fight / lobby: keep its layout, fitted into the new canvas; the new
      // shape applies from the next scene on.
      setPendingView(v);
      for (const sc of active) refitCamera(sc);
    }
  }, 250);
}
window.addEventListener('resize', onScreenShape);
window.addEventListener('orientationchange', onScreenShape);
document.addEventListener('fullscreenchange', onScreenShape);
game.scene.add('Menu', MenuScene, false);
game.scene.add('Training', TrainingScene, false);
game.scene.add('Lobby', LobbyScene, false);
game.scene.add('Match', MatchScene, false);
game.scene.add('VsAI', VsAIScene, false);
game.scene.add('LocalVs', LocalVsScene, false);
game.scene.add('Tutorial', TutorialScene, false);
game.scene.add('CharSelect', CharSelectScene, false);

// ?room=ABC (from the host's QR code / link) skips straight to joining.
game.scene.add('ArtBoot', ArtBootScene, true);
