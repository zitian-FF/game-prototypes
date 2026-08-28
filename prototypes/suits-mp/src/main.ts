import Phaser from 'phaser';
import { PIXEL_RATIO } from './render/pixelRatio';
import { getOrCreateClientId } from 'mp-core';
import { fetchTurnIceServers } from './turn/turnConfig';
import { normalizeLobbyCode } from './net/lobbyCode';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { LandingScene } from './scenes/LandingScene';
import { JoinEntryScene } from './scenes/JoinEntryScene';
import { ConnectingScene } from './scenes/ConnectingScene';
import { HostLobbyScene } from './scenes/HostLobbyScene';
import { HostGameScene } from './scenes/HostGameScene';
import { PlayerLobbyScene } from './scenes/PlayerLobbyScene';
import { PlayerGameScene } from './scenes/PlayerGameScene';
import { mountDom } from './dom/mountDom';
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
const initialCode = lobbyParam ? normalizeLobbyCode(lobbyParam) : null;

// Portrait on every screen, including the host - see root BRIEF for this
// prototype (deliberately not mp-base/mp-net's landscape-host dashboard).
const WIDTH = 390;
const HEIGHT = 844;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#111111',
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH * PIXEL_RATIO,
    height: HEIGHT * PIXEL_RATIO,
  },
});

// `game.domContainer` isn't created until Game#boot runs (after
// DOMContentLoaded), so mounting must wait for the `ready` event rather
// than happening synchronously right after construction.
game.events.once(Phaser.Core.Events.READY, () => mountDom(game));

game.scene.add('Landing', LandingScene, false);
game.scene.add('JoinEntry', JoinEntryScene, false);
game.scene.add('Connecting', ConnectingScene, false);
game.scene.add('HostLobby', HostLobbyScene, false);
game.scene.add('HostGame', HostGameScene, false);
game.scene.add('PlayerLobby', PlayerLobbyScene, false);
game.scene.add('PlayerGame', PlayerGameScene, false);

if (initialCode) {
  game.scene.start('Connecting', { ...bootData, code: initialCode });
} else {
  game.scene.start('Landing', bootData);
}
