import Phaser from 'phaser';
import QRCode from 'qrcode';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import type { Roster, SharedNetData } from '../net/types';

export class HostLobbyScene extends Phaser.Scene {
  private roster: Roster = new Map();

  constructor() {
    super('HostLobby');
  }

  create(data: SharedNetData): void {
    addVersionStamp(this);
    createOrientationGuard(this, 'landscape');

    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    const { room, actions, lobbyCode } = data;

    this.add
      .text(width / 2, 24, 'mp-base host', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 60, `Lobby code: ${lobbyCode}`, {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffd27a',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    const joinUrl = `${location.origin}${location.pathname}?lobby=${lobbyCode}`;
    void QRCode.toDataURL(joinUrl, { margin: 1, width: 220, color: { dark: '#000000', light: '#ffffff' } }).then(
      (dataUrl) => {
        this.textures.addBase64('qr-code', dataUrl);
      },
    );
    this.textures.once(Phaser.Textures.Events.ADD_KEY + 'qr-code', () => {
      this.add.image(140, height / 2 + 20, 'qr-code');
    });

    this.add.text(280, 110, 'Players:', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#aaaaaa',
      resolution: PIXEL_RATIO,
    });

    const playerListText = this.add.text(280, 136, '(no players yet)', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#eeeeee',
      lineSpacing: 6,
      resolution: PIXEL_RATIO,
    });

    const startButton = this.add
      .text(width / 2, height - 40, '[ Start Game ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#88ff88',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setAlpha(0.4);

    const renderRoster = (): void => {
      if (this.roster.size === 0) {
        playerListText.setText('(no players yet)');
      } else {
        playerListText.setText([...this.roster.values()].map((entry) => shortId(entry.clientId)).join('\n'));
      }
      startButton.setAlpha(this.roster.size > 0 ? 1 : 0.4);
    };

    actions.identity.onMessage = (clientId, context) => {
      const existing = this.roster.get(clientId);
      if (existing) {
        existing.peerId = context.peerId;
      } else {
        this.roster.set(clientId, { clientId, peerId: context.peerId, counter: 0, lastInputMask: 0 });
      }
      renderRoster();
    };

    room.onPeerLeave = (peerId) => {
      for (const entry of this.roster.values()) {
        if (entry.peerId === peerId) {
          this.roster.delete(entry.clientId);
          break;
        }
      }
      renderRoster();
    };

    startButton.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.roster.size === 0) return;
      void actions.hostUI.send({ type: 'gameStarted' });
      this.scene.start('HostGame', { ...data, roster: this.roster });
    });
  }
}

function shortId(clientId: string): string {
  return clientId.slice(0, 8);
}
