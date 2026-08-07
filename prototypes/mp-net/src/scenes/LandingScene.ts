import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { PIXEL_RATIO } from '../render/pixelRatio';
import type { BootData } from '../net/playerSession';

export class LandingScene extends Phaser.Scene {
  constructor() {
    super('Landing');
  }

  create(data: BootData): void {
    addVersionStamp(this);
    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    this.add
      .text(width / 2, height / 2 - 160, 'mp-net', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffffff',
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
  }
}
