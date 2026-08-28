import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { ALL_NET_PLAYER_IDS } from '../net/netPlayerId';
import { showLanding, hideLanding } from '../dom/lobby/lobbyUiStore';
import type { BootData } from '../net/playerSession';
import type { Roster } from '../net/types';
import type { HostGameData } from './HostGameScene';

// Presentation now comes entirely from the DOM Lobby flow
// (dom/lobby/LobbyFlow.tsx, mounted via lobbyUiStore) rather than Phaser
// primitives - see root CLAUDE.md's "UI implementation split". This
// scene's only remaining job is the version stamp/portrait guard (still
// canvas-owned) and showing/hiding that DOM view, plus the one real
// non-networked action it can still perform directly: Single Player.
//
// Host/Join stay inside the DOM flow's own placeholder state (room code,
// seat list, code entry - see BUILD_STATUS.md) rather than transitioning
// to the real HostLobbyScene/JoinEntryScene: this task explicitly defers
// real networking wiring, so those two scenes are currently unreachable
// from here (still intact for a future task to wire in), but 'Landing'
// itself must stay a real, registered scene - JoinEntryScene's back
// button and ConnectingScene's cancel/error paths both call
// `scene.start('Landing', data)` to return here.
export class LandingScene extends Phaser.Scene {
  constructor() {
    super('Landing');
  }

  create(data: BootData): void {
    addVersionStamp(this);
    createPortraitGuard(this);
    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    showLanding(() => this.startSinglePlayer(data));
    // Phaser doesn't auto-call a `shutdown()` method on Scene subclasses
    // (only `Systems#shutdown`, which fires this event) - see
    // node_modules/phaser/src/scene/Systems.js.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, hideLanding);
  }

  // No lobby, no room code, no networking of any kind (see BootData's
  // getIceServers - never called here, so not even a TURN fetch fires):
  // builds a local host + 3 bot roster directly and drops straight into
  // HostGameScene, same as a real host's "Start Game" would, just skipping
  // every networking step that only matters for real peers.
  private startSinglePlayer(data: BootData): void {
    const roster: Roster = new Map();
    roster.set(data.clientId, { clientId: data.clientId, peerId: 'host', slot: 'p0', isHost: true });
    for (const slot of ALL_NET_PLAYER_IDS) {
      if (slot === 'p0') continue;
      const clientId = `bot:${slot}`;
      roster.set(clientId, { clientId, peerId: 'bot', slot, isHost: false, isBot: true });
    }

    const gameData: HostGameData = { room: null, actions: null, roster };
    this.scene.start('HostGame', gameData);
  }
}
