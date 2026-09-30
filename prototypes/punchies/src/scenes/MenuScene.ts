import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { makeButton } from './FightStage';
import { normalizeRoomCode } from '../net/roomCode';
import { addFullscreenButton } from '../ui/fullscreen';
import { syncTuneFromGitHub, tuneSource } from '../sim/tune';

export class MenuScene extends Phaser.Scene {
  private msg!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(data: { message?: string }): void {
    applyCameraPixelRatio(this);
    this.add
      .text(VIEW.cx, VIEW.cy - 128, 'PUNCHIES', { fontFamily: 'monospace', fontSize: '40px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    makeButton(this, VIEW.cx, VIEW.cy - 64, 220, 'SINGLE PLAYER', () => this.scene.start('VsAI'), 40, 16);
    makeButton(this, VIEW.cx, VIEW.cy - 16, 220, 'TRAINING', () => this.scene.start('Training'), 40, 16);
    makeButton(this, VIEW.cx, VIEW.cy + 32, 220, 'HOST ONLINE', () => this.scene.start('Lobby', { role: 'host' }), 40, 16);
    makeButton(this, VIEW.cx, VIEW.cy + 80, 220, 'JOIN WITH CODE', () => this.join(), 40, 16);
    const tuneLabel = this.add
      .text(VIEW.right - 16, VIEW.bottom - 44, `tune: ${tuneSource()}`, { fontFamily: 'monospace', fontSize: '10px', color: '#888888', resolution: PIXEL_RATIO })
      .setOrigin(1, 0.5);
    const syncBtn = makeButton(this, VIEW.right - 70, VIEW.bottom - 20, 120, 'SYNC TUNE', () => {
      if (syncBtn.text === 'SYNCING...') return;
      syncBtn.setText('SYNCING...');
      void syncTuneFromGitHub().then((r) => {
        if (!this.scene.isActive()) return;
        syncBtn.setText('SYNC TUNE');
        tuneLabel.setText(r.ok ? `tune: ${tuneSource()} (${r.applied} values)` : `sync failed: ${r.error} (still ${tuneSource()})`);
      });
    });
    addFullscreenButton(this, VIEW.right - 24, VIEW.top + 24);
    this.msg = this.add
      .text(VIEW.cx, VIEW.cy + 116, data?.message ?? '', { fontFamily: 'monospace', fontSize: '11px', color: '#ff8a7a', resolution: PIXEL_RATIO })
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
