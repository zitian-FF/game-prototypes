import Phaser from 'phaser';
import { getOrCreateClientId } from './net/clientId';
import { createNetworkRoom } from './net/room';
import { createNetworkActions } from './net/actions';
import type { SharedNetData } from './net/types';
import { HostLobbyScene } from './scenes/HostLobbyScene';
import { HostGameScene } from './scenes/HostGameScene';
import { PlayerWaitingScene } from './scenes/PlayerWaitingScene';
import { PlayerButtonScene } from './scenes/PlayerButtonScene';

const LOBBY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randomLobbyCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += LOBBY_CODE_CHARS[Math.floor(Math.random() * LOBBY_CODE_CHARS.length)];
  }
  return code;
}

const params = new URLSearchParams(location.search);
const lobbyParam = params.get('lobby');
const isHost = !lobbyParam;
const lobbyCode = isHost ? randomLobbyCode() : lobbyParam.toUpperCase();

const clientId = getOrCreateClientId();
const room = createNetworkRoom(lobbyCode);
const actions = createNetworkActions(room);

const sharedData: SharedNetData = { room, actions, clientId, lobbyCode };

const WIDTH = isHost ? 844 : 390;
const HEIGHT = isHost ? 390 : 844;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#111111',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH,
    height: HEIGHT,
  },
});

if (isHost) {
  game.scene.add('HostLobby', HostLobbyScene, true, sharedData);
  game.scene.add('HostGame', HostGameScene, false);
} else {
  game.scene.add('PlayerWaiting', PlayerWaitingScene, true, sharedData);
  game.scene.add('PlayerButton', PlayerButtonScene, false);

  // The host is always in the room before a player joins (there's no
  // lobby-less "player only" state), so the first peer a player ever sees
  // is the host. No host migration, so that peerId is host for the rest of
  // the session.
  let hostPeerId: string | null = null;
  room.onPeerJoin = (peerId) => {
    if (hostPeerId === null) {
      hostPeerId = peerId;
      game.events.emit('host-seen');
    }
    void actions.identity.send(clientId, { target: peerId });
  };
  room.onPeerLeave = (peerId) => {
    if (peerId === hostPeerId) {
      game.events.emit('host-disconnected');
    }
  };
}
