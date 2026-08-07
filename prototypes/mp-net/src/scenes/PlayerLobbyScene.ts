import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import type { PlayerSessionData } from '../net/playerSession';

export class PlayerLobbyScene extends Phaser.Scene {
  constructor() {
    super('PlayerLobby');
  }

  create(data: PlayerSessionData): void {
    addVersionStamp(this);
    createOrientationGuard(this, 'portrait');

    const { actions, room } = data;
    const width = this.scale.width;
    const height = this.scale.height;

    const statusText = this.add
      .text(width / 2, height / 2, 'Waiting for host to start...', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#eeeeee',
        align: 'center',
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5);

    actions.hostUI.onMessage = (message, context) => {
      data.hostPeerId.current = context.peerId;
      if (message.type === 'gameStarted') {
        this.scene.start('PlayerButton', data);
      }
    };

    room.onPeerLeave = (peerId) => {
      if (peerId === data.hostPeerId.current) {
        statusText.setText('Host disconnected.\nSession ended.');
      }
    };
  }
}
