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
import { PlayerButtonScene } from './scenes/PlayerButtonScene';
import type { BootData } from './net/playerSession';

mountDebugPanelIfRequested();

const bootData: BootData = {
  clientId: getOrCreateClientId('mp-net:clientId'),
  // Kicked off immediately so it's ready (or has failed and fallen back) by
  // the time the user actually hosts or joins, without blocking the landing
  // screen from rendering.
  iceServersPromise: fetchTurnIceServers(),
};

const lobbyParam = new URLSearchParams(location.search).get('lobby');
const initialCode = lobbyParam ? normalizeLobbyCode(lobbyParam) : null;

// Portrait by default (landing/join/player flows); HostLobbyScene resizes
// to landscape once someone actually chooses to host.
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

game.scene.add('Landing', LandingScene, false);
game.scene.add('JoinEntry', JoinEntryScene, false);
game.scene.add('Connecting', ConnectingScene, false);
game.scene.add('HostLobby', HostLobbyScene, false);
game.scene.add('HostGame', HostGameScene, false);
game.scene.add('PlayerLobby', PlayerLobbyScene, false);
game.scene.add('PlayerButton', PlayerButtonScene, false);

if (initialCode) {
  game.scene.start('Connecting', { ...bootData, code: initialCode });
} else {
  game.scene.start('Landing', bootData);
}
