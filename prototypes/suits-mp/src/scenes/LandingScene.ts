import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { ALL_NET_PLAYER_IDS } from '../net/netPlayerId';
import { shuffleRosterSeats } from '../net/shuffleSeats';
import { showLanding, hideLanding } from '../uiState/lobby/lobbyUiStore';
import type { BootData } from '../net/playerSession';
import type { Roster } from '../net/types';
import type { HostGameData } from './HostGameScene';
import { TitleArt } from '../titleArt/TitleArt';

// Animated title art sits behind CanvasUiScene, which owns the approved
// logo, buttons, and lobby controls. The art pauses when the page is
// hidden and moves more gently when the player requests reduced motion.
export class LandingScene extends Phaser.Scene {
  private titleArt?: TitleArt;
  private reducedMotion = false;
  private motionQuery?: MediaQueryList;
  private readonly onMotionChange = (event: MediaQueryListEvent): void => { this.reducedMotion = event.matches; };
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

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery.matches;
    this.motionQuery.addEventListener('change', this.onMotionChange);
    this.titleArt = new TitleArt(this);

    showLanding(
      () => this.startSinglePlayer(data),
      () => this.scene.start('Tutorial'),
      (displayName) => this.scene.start('HostLobby', { ...data, displayName }),
      (code, displayName) => this.scene.start('Connecting', { ...data, code, displayName }),
    );
    // Phaser doesn't auto-call a `shutdown()` method on Scene subclasses
    // (only `Systems#shutdown`, which fires this event) - see
    // node_modules/phaser/src/scene/Systems.js.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      hideLanding();
      this.motionQuery?.removeEventListener('change', this.onMotionChange);
    });
  }

  update(_time: number, delta: number): void {
    this.titleArt?.update(delta, this.reducedMotion);
  }

  // No lobby, no room code, no networking of any kind (see BootData's
  // getIceServers - never called here, so not even a TURN fetch fires):
  // builds a local host + 3 bot roster directly and drops straight into
  // HostGameScene, same as a real host's "Start Game" would, just skipping
  // every networking step that only matters for real peers.
  private startSinglePlayer(data: BootData): void {
    const roster: Roster = new Map();
    roster.set(data.clientId, {
      clientId: data.clientId,
      peerId: 'host',
      displayName: 'Player 1',
      slot: 'p0',
      isHost: true,
    });
    for (const slot of ALL_NET_PLAYER_IDS) {
      if (slot === 'p0') continue;
      const clientId = `bot:${slot}`;
      roster.set(clientId, { clientId, peerId: 'bot', displayName: `Player ${ALL_NET_PLAYER_IDS.indexOf(slot) + 1}`, slot, isHost: false, isBot: true });
    }

    shuffleRosterSeats(roster);

    const gameData: HostGameData = { room: null, actions: null, roster };
    this.scene.start('HostGame', gameData);
  }
}
