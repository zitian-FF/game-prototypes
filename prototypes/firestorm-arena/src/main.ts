import Phaser from 'phaser';
import { DPR, logicalSize } from './scenes/base';
import { MenuScene } from './scenes/menu';
import { LobbyScene } from './scenes/lobby';
import { GameScene } from './scenes/game';
import { session } from './net/session';
import { intents } from './input/intents';
import { mountDebugPanelIfRequested } from './debug/debugPanel';

const { w, h } = logicalSize();

// The pixel buffer is logical size x DPR; Scale zoom of 1/DPR shows it at logical CSS size,
// and every scene's camera zoom of DPR maps logical coordinates back onto it.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: Math.round(w * DPR),
  height: Math.round(h * DPR),
  backgroundColor: '#0b0709',
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR },
  input: { mouse: false, touch: false, keyboard: false, gamepad: false },
  render: { antialias: true, roundPixels: false },
  scene: [MenuScene, LobbyScene, GameScene],
});

game.events.once(Phaser.Core.Events.READY, () => {
  intents.attach(game.canvas);
});

window.addEventListener('resize', () => {
  const s = logicalSize();
  game.scale.resize(Math.round(s.w * DPR), Math.round(s.h * DPR));
});

mountDebugPanelIfRequested();

// Handle for the Playwright check (debug builds only).
if (new URLSearchParams(location.search).get('debug') === '1') {
  Object.assign(window, { __game: game, __session: session });
}
