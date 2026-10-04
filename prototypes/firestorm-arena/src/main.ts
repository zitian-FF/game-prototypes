import Phaser from 'phaser';
import { DPR, refreshDpr, refreshUiScale } from './scenes/base';
import { MenuScene } from './scenes/menu';
import { LobbyScene } from './scenes/lobby';
import { GameScene } from './scenes/game';
import { session } from './net/session';
import { intents } from './input/intents';
import { installFullscreen } from './input/fullscreen';
import { mountDebugPanelIfRequested } from './debug/debugPanel';


// The pixel buffer is logical size x DPR; Scale zoom of 1/DPR shows it at logical CSS size,
// and every scene's camera zoom of DPR maps logical coordinates back onto it.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: Math.round(window.innerWidth * DPR),
  height: Math.round(window.innerHeight * DPR),
  backgroundColor: '#0b0709',
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR },
  input: { mouse: false, touch: false, keyboard: false, gamepad: false },
  render: { antialias: true, roundPixels: false },
  scene: [MenuScene, LobbyScene, GameScene],
});

game.events.once(Phaser.Core.Events.READY, () => {
  intents.attach(game.canvas);
});
// The first touch on a laptop with a touch screen switches the UI to its touch scale.
window.addEventListener('pointerdown', (e) => e.pointerType === 'touch' && fit(), { passive: true });

/** Keep the buffer sharp when the window, fullscreen state, browser zoom or monitor changes. */
function fit(): void {
  const dprChanged = refreshDpr();
  const scaleChanged = refreshUiScale();
  if (dprChanged) game.scale.setZoom(1 / DPR);
  game.scale.resize(Math.round(window.innerWidth * DPR), Math.round(window.innerHeight * DPR));
  if (dprChanged || scaleChanged) game.events.emit('dpr');
}

window.addEventListener('resize', fit);
document.addEventListener('fullscreenchange', fit);
// Moving the window to a monitor with another pixel ratio fires no resize, only this media query.
function watchDpr(): void {
  const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mq.addEventListener(
    'change',
    () => {
      fit();
      watchDpr();
    },
    { once: true },
  );
}
watchDpr();

installFullscreen(() => intents.touch);

mountDebugPanelIfRequested();

// Handle for the Playwright check (debug builds only).
if (new URLSearchParams(location.search).get('debug') === '1') {
  Object.assign(window, { __game: game, __session: session });
}
