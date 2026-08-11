import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { ALL_NET_PLAYER_IDS } from '../net/netPlayerId';
import type { BootData } from '../net/playerSession';
import type { Roster } from '../net/types';
import type { HostGameData } from './HostGameScene';

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

    this.add
      .text(width / 2, height / 2 - 160, 'Suit of Madness\n(suits-mp)', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    const hostButton = this.add
      .text(width / 2, height / 2 - 30, '[ Host ]', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#88ff88',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hostButton.on('pointerdown', () => this.scene.start('HostLobby', data));

    const joinButton = this.add
      .text(width / 2, height / 2 + 50, '[ Join ]', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#88aaff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    joinButton.on('pointerdown', () => this.scene.start('JoinEntry', data));

    const singlePlayerButton = this.add
      .text(width / 2, height / 2 + 130, '[ Single Player (play with bots) ]', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ff8888',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    singlePlayerButton.on('pointerdown', () => this.startSinglePlayer(data));
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
