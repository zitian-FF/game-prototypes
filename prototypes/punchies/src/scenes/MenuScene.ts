import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { makeButton } from './FightStage';
import { normalizeRoomCode } from '../net/roomCode';

export class MenuScene extends Phaser.Scene {
  private msg!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(data: { message?: string }): void {
    applyCameraPixelRatio(this);
    this.add
      .text(VIEW.cx, VIEW.cy - 110, 'PUNCHIES', { fontFamily: 'monospace', fontSize: '40px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    makeButton(this, VIEW.cx, VIEW.cy - 30, 220, 'TRAINING', () => this.scene.start('Training'), 44, 16);
    makeButton(this, VIEW.cx, VIEW.cy + 26, 220, 'HOST ONLINE', () => this.scene.start('Lobby', { role: 'host' }), 44, 16);
    makeButton(this, VIEW.cx, VIEW.cy + 82, 220, 'JOIN WITH CODE', () => this.join(), 44, 16);
    this.msg = this.add
      .text(VIEW.cx, VIEW.cy + 128, data?.message ?? '', { fontFamily: 'monospace', fontSize: '11px', color: '#ff8a7a', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    addVersionStamp(this);
  }

  private join(): void {
    const raw = window.prompt('Room code (3 characters)');
    if (raw === null) return;
    const code = normalizeRoomCode(raw);
    if (!code) {
      this.msg.setText(`"${raw}" is not a valid room code`);
      return;
    }
    this.scene.start('Lobby', { role: 'guest', code });
  }
}
