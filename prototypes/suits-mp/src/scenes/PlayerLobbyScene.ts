import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { showWaiting, setWaitingHostLeft, hideWaiting } from '../dom/lobby/lobbyUiStore';
import type { PlayerSessionData } from '../net/playerSession';

// Presentation comes entirely from the DOM Lobby flow (dom/lobby/LobbyFlow.tsx,
// mounted via lobbyUiStore) rather than Phaser primitives - see root
// CLAUDE.md's "UI implementation split". No live seat list here: the host
// doesn't currently broadcast roster/seat state to joined peers during the
// lobby phase, only the lobbyJoined/gameStarted/roomFull/alreadyInProgress
// signals - this screen mirrors exactly the two states the scene already
// tracked before this conversion (waiting / host disconnected), just as DOM
// instead of canvas Text.
export class PlayerLobbyScene extends Phaser.Scene {
  constructor() {
    super('PlayerLobby');
  }

  create(data: PlayerSessionData): void {
    addVersionStamp(this);
    createPortraitGuard(this);

    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    const { actions, room } = data;

    showWaiting();
    // Phaser doesn't auto-call a `shutdown()` method on Scene subclasses
    // (only `Systems#shutdown`, which fires this event) - see
    // node_modules/phaser/src/scene/Systems.js.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, hideWaiting);

    actions.hostUI.onMessage = (message, context) => {
      data.hostPeerId.current = context.peerId;
      if (message.type === 'gameStarted') {
        this.scene.start('PlayerGame', data);
      }
    };

    room.onPeerLeave = (peerId) => {
      if (peerId === data.hostPeerId.current) {
        setWaitingHostLeft();
      }
    };
  }
}
