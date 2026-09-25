import Phaser from 'phaser';
import { PIXEL_RATIO } from './render/pixelRatio';
import { getOrCreateClientId } from 'mp-core';
import { fetchTurnIceServers } from './turn/turnConfig';
import { isValidLobbyCode, normalizeLobbyCode } from './net/lobbyCode';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { recordRendererType } from './debug/shimmerDiagnostics';
import { LandingScene } from './scenes/LandingScene';
import { BootScene } from './scenes/BootScene';
import { ConnectingScene } from './scenes/ConnectingScene';
import { HostLobbyScene } from './scenes/HostLobbyScene';
import { HostGameScene } from './scenes/HostGameScene';
import { PlayerLobbyScene } from './scenes/PlayerLobbyScene';
import { PlayerGameScene } from './scenes/PlayerGameScene';
import { TutorialScene } from './scenes/TutorialScene';
import { CanvasUiScene } from './ui/CanvasUiScene';
import type { BootData } from './net/playerSession';

mountDebugPanelIfRequested();

// Lazy and memoized: the fetch only fires the first time a Host/Join path
// actually calls this (so it's ready by the time that flow needs it,
// without blocking the landing screen from rendering), and never at all
// for Single Player, which has no networking of any kind.
function lazyIceServers(): () => Promise<RTCIceServer[] | undefined> {
  let promise: Promise<RTCIceServer[] | undefined> | undefined;
  return () => {
    if (!promise) promise = fetchTurnIceServers();
    return promise;
  };
}

const bootData: BootData = {
  clientId: getOrCreateClientId('suits-mp:clientId'),
  getIceServers: lazyIceServers(),
};

const lobbyParam = new URLSearchParams(location.search).get('lobby');
const normalizedLobbyParam = lobbyParam ? normalizeLobbyCode(lobbyParam) : null;
const initialCode = normalizedLobbyParam && isValidLobbyCode(normalizedLobbyParam) ? normalizedLobbyParam : null;

// Portrait on every screen, including the host - see root BRIEF for this
// prototype (deliberately not mp-base/mp-net's landscape-host dashboard).
const WIDTH = 390;
const HEIGHT = 844;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#111111',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH * PIXEL_RATIO,
    height: HEIGHT * PIXEL_RATIO,
  },
});

// Phaser's FIT scale mode measures its parent (#app) once at construction
// to compute the canvas's CSS scale/position. On itch.io the game runs in
// an iframe that itch.io resizes asynchronously - if that measurement
// happens before the iframe settles to its real size, the canvas ends up
// scaled/positioned against a stale (often 0 or tiny) size and everything
// canvas-drawn renders invisible or badly mis-scaled, while the DOM
// overlay (laid out independently via its own CSS) looks fine. A window
// resize event makes Phaser remeasure and self-correct, which is why
// opening DevTools "fixes" it - this ResizeObserver reacts to the actual
// #app size changing (whenever itch.io actually resizes the iframe)
// rather than guessing at a timeout, and calls the same recalculation
// Phaser's own resize listener already triggers. Not disconnected - it
// stays active for the page's lifetime, same as that internal listener.
const appEl = document.getElementById('app');
if (appEl) {
  new ResizeObserver(() => game.scale.refresh()).observe(appEl);
}

game.events.once(Phaser.Core.Events.READY, () => {
  // game.renderer only exists once boot() has run (see Game.js), which is
  // what READY waits on - the earliest point the real AUTO->WEBGL/CANVAS
  // resolution is known. Surfaced read-only in the ?debug=1 panel (see
  // debug/shimmerDiagnostics.ts) so a real-device tester can confirm which
  // renderer actually got chosen, without needing devtools.
  recordRendererType(game.renderer.type);
});

game.scene.add('Boot', BootScene, false);
game.scene.add('Landing', LandingScene, false);
game.scene.add('Connecting', ConnectingScene, false);
game.scene.add('HostLobby', HostLobbyScene, false);
game.scene.add('HostGame', HostGameScene, false);
game.scene.add('PlayerLobby', PlayerLobbyScene, false);
game.scene.add('PlayerGame', PlayerGameScene, false);
game.scene.add('Tutorial', TutorialScene, false);
game.scene.add('CanvasUI', CanvasUiScene, false);
game.scene.run('CanvasUI');

// Boot prepares the entire packaged asset manifest before either path begins.
game.scene.start('Boot', { ...bootData, initialCode });
