import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import type { SharedNetData } from '../net/types';

export class PlayerWaitingScene extends Phaser.Scene {
  constructor() {
    super('PlayerWaiting');
  }

  create(data: SharedNetData): void {
    addVersionStamp(this);
    createOrientationGuard(this, 'portrait');

    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    const { actions } = data;

    const statusText = this.add
      .text(width / 2, height / 2, 'Connecting...', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#eeeeee',
        align: 'center',
        wordWrap: { width: width - 60 },
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    actions.hostUI.onMessage = (message) => {
      if (message.type === 'gameStarted') {
        this.scene.start('PlayerButton', data);
      }
    };

    this.game.events.once('host-seen', () => {
      if (!this.scene.isActive()) return;
      statusText.setText('Waiting for host to start...');
    });

    this.game.events.once('host-disconnected', () => {
      if (!this.scene.isActive()) return;
      statusText.setText('Host disconnected.\nSession ended.');
    });
  }
}
