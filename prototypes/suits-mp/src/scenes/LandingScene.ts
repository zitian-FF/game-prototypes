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
import tune from '../../tune.json';

// Animated title art sits behind CanvasUiScene, which owns the approved
// logo, buttons, and lobby controls. The art stops updating when the page
// is hidden or the player requests reduced motion.
export class LandingScene extends Phaser.Scene {
  private orbit?: Phaser.GameObjects.Graphics;
  private dust?: Phaser.GameObjects.Graphics;
  private moon?: Phaser.GameObjects.Image;
  private motionTime = 0;
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
    this.createTitleArt(width, height);

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

  private createTitleArt(width: number, height: number): void {
    this.add.image(width / 2, height / 2, 'title_cosmos_background').setDisplaySize(width, height);

    // Each layer is independently positioned. Graphics are drawn once;
    // movement only changes transforms, avoiding per-frame texture uploads.
    this.orbit = this.add.graphics({ x: width / 2, y: 285 });
    this.orbit.lineStyle(0.55, 0x9fb6bb, 0.15);
    this.orbit.strokeCircle(0, 0, 138);
    this.orbit.strokeCircle(0, 0, 126);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      this.orbit.lineBetween(Math.cos(angle) * 126, Math.sin(angle) * 126, Math.cos(angle) * 138, Math.sin(angle) * 138);
    }
    this.orbit.setAlpha(0.5);

    this.dust = this.add.graphics();
    for (let i = 0; i < 30; i++) {
      const x = (i * 137.508 + 39) % width;
      const y = (i * 251.17 + 71) % (height - 100);
      this.dust.fillStyle(0xc9d9d7, 0.06 + (i % 4) * 0.025);
      this.dust.fillCircle(x, y, i % 7 === 0 ? 1.2 : 0.6);
    }

    this.moon = this.add.image(324, 236, 'title_celestial_moon').setDisplaySize(55, 55).setAlpha(0.56);
  }

  update(_time: number, delta: number): void {
    if (this.reducedMotion || document.hidden) return;
    this.motionTime += Math.min(delta, 50);
    const t = this.motionTime;
    if (this.orbit) this.orbit.rotation = t * (Math.PI * 2 / tune.titleOrbitPeriodMs);
    if (this.dust) this.dust.y = Math.sin(t * Math.PI * 2 / tune.titleDustPeriodMs) * tune.titleDustTravelPx;
    if (this.moon) {
      this.moon.x = 324 + Math.sin(t * Math.PI * 2 / tune.titleMoonPeriodMs) * tune.titleMoonTravelPx;
      this.moon.y = 236 + Math.cos(t * Math.PI * 2 / tune.titleMoonPeriodMs) * tune.titleMoonTravelPx * 0.4;
    }
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
