import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { makeButton } from './FightStage';
import { normalizeRoomCode } from '../net/roomCode';
import { addFullscreenButton } from '../ui/fullscreen';
import { devices, SOURCE_LABEL, type InputSource } from '../input/devices';
import { loadLocalInputs, P1_OPTIONS, P2_OPTIONS, saveLocalInputs } from '../input/localSetup';
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
    makeButton(this, VIEW.cx, VIEW.cy - 80, 220, 'SINGLE PLAYER', () => this.scene.start('VsAI'), 36, 15);
    makeButton(this, VIEW.cx - 32, VIEW.cy - 38, 156, 'LOCAL VS', () => this.scene.start('LocalVs', loadLocalInputs()), 36, 15);
    makeButton(this, VIEW.cx + 80, VIEW.cy - 38, 60, 'INPUT', () => this.openInputPopup(), 36, 12);
    makeButton(this, VIEW.cx - 40, VIEW.cy + 4, 140, 'TRAINING', () => this.scene.start('Training'), 36, 15);
    makeButton(this, VIEW.cx + 72, VIEW.cy + 4, 76, 'TUTORIAL', () => this.scene.start('Tutorial'), 36, 11);
    makeButton(this, VIEW.cx, VIEW.cy + 46, 220, 'HOST ONLINE', () => this.scene.start('Lobby', { role: 'host' }), 36, 15);
    makeButton(this, VIEW.cx, VIEW.cy + 88, 220, 'JOIN WITH CODE', () => this.join(), 36, 15);
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
      .text(VIEW.cx, VIEW.cy + 122, data?.message ?? '', { fontFamily: 'monospace', fontSize: '11px', color: '#ff8a7a', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    addVersionStamp(this);
  }

  // Local VS input picker: cycle each player's device. Remembered on this
  // device. Only P1 can use touch; P1 and P2 can't share a device.
  private openInputPopup(): void {
    const v = loadLocalInputs();
    const items: Phaser.GameObjects.GameObject[] = [];
    const D = 300;
    const txt = (x: number, y: number, s: string, size = 12, color = '#dddddd') => {
      const t = this.add
        .text(x, y, s, { fontFamily: 'monospace', fontSize: `${size}px`, color, align: 'center', resolution: PIXEL_RATIO })
        .setOrigin(0.5)
        .setDepth(D + 2);
      items.push(t);
      return t;
    };
    const btn = (x: number, y: number, w: number, label: string, onTap: () => void) => {
      const bg = this.add.rectangle(x, y, w, 30, 0x2a3140, 1).setStrokeStyle(1, 0x7fb3ff).setDepth(D + 1).setInteractive();
      bg.on('pointerdown', onTap);
      items.push(bg);
      return txt(x, y, label, 12, '#ffffff');
    };
    items.push(this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x000000, 0.75).setDepth(D).setInteractive());
    items.push(this.add.rectangle(VIEW.cx, VIEW.cy, 440, 280, 0x151922, 1).setStrokeStyle(2, 0x5a6378).setDepth(D));
    txt(VIEW.cx, VIEW.cy - 118, 'LOCAL VS · INPUTS', 15, '#ffd24a');

    const cycle = (list: InputSource[], cur: InputSource, other: InputSource) => {
      let i = list.indexOf(cur);
      for (let n = 0; n < list.length; n++) {
        i = (i + 1) % list.length;
        if (list[i] !== other) return list[i];
      }
      return cur;
    };
    txt(VIEW.cx - 130, VIEW.cy - 76, 'PLAYER 1', 12, '#7fb3ff');
    const p1 = btn(VIEW.cx + 40, VIEW.cy - 76, 220, '', () => {
      v.p1 = cycle(P1_OPTIONS, v.p1, v.p2);
      refresh();
    });
    txt(VIEW.cx - 130, VIEW.cy - 36, 'PLAYER 2', 12, '#ff8a7a');
    const p2 = btn(VIEW.cx + 40, VIEW.cy - 36, 220, '', () => {
      v.p2 = cycle(P2_OPTIONS, v.p2, v.p1);
      refresh();
    });
    const pads = txt(VIEW.cx, VIEW.cy + 2, '', 11, '#8a90a0');
    txt(
      VIEW.cx,
      VIEW.cy + 50,
      'WASD: move  J/K/L jab/cross/hook  I upper  Space dodge  Shift guard\n' +
        'ARROWS: move  Num1/2/3 jab/cross/hook  Num5 upper  Num0 dodge  NumEnter guard\n' +
        'CONTROLLER: stick  X/Y/B jab/cross/hook  A dodge  RB/RT guard  LB/LT upper',
      9,
      '#aab0bc',
    );
    const refresh = () => {
      p1.setText(`< ${SOURCE_LABEL[v.p1]} >`);
      p2.setText(`< ${SOURCE_LABEL[v.p2]} >`);
      saveLocalInputs(v);
    };
    const padTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => pads.setText(`Controllers connected: ${devices.connectedPads()} (press a button to wake one)`),
    });
    padTimer.callback?.();
    btn(VIEW.cx, VIEW.cy + 108, 120, 'DONE', () => {
      padTimer.remove();
      for (const o of items) o.destroy();
    });
    refresh();
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
