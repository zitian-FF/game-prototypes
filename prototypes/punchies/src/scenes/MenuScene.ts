import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { makeButton } from './FightStage';
import { normalizeRoomCode, ROOM_ALPHABET } from '../net/roomCode';
import { addFullscreenButton } from '../ui/fullscreen';
import { devices, SOURCE_LABEL, type InputSource } from '../input/devices';
import { loadLocalInputs, P1_OPTIONS, P2_OPTIONS, saveLocalInputs } from '../input/localSetup';
import { syncTuneFromGitHub, tuneSource } from '../sim/tune';
import { getNav, navRegister } from '../ui/menuNav';
import { backdrop } from '../render/art';

export class MenuScene extends Phaser.Scene {
  private msg!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(data: { message?: string }): void {
    applyCameraPixelRatio(this);
    backdrop(this, 0.18);
    const menuX = VIEW.cx;
    this.add
      .text(menuX, VIEW.cy - 128, 'PUNCHIES', { fontFamily: 'monospace', fontSize: '40px', fontStyle: 'bold', color: '#fff1d1', stroke: '#101b32', strokeThickness: 6, resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    makeButton(this, menuX, VIEW.cy - 80, 220, 'SINGLE PLAYER', () => this.scene.start('CharSelect', { mode: 'vsai' }), 36, 15);
    makeButton(this, menuX - 32, VIEW.cy - 38, 156, 'LOCAL VS', () => this.scene.start('CharSelect', { mode: 'localvs', inputs: loadLocalInputs() }), 36, 15);
    makeButton(this, menuX + 80, VIEW.cy - 38, 60, 'INPUT', () => this.openInputPopup(), 36, 12);
    makeButton(this, menuX - 40, VIEW.cy + 4, 140, 'TRAINING', () => this.scene.start('Training'), 36, 15);
    makeButton(this, menuX + 72, VIEW.cy + 4, 76, 'TUTORIAL', () => this.scene.start('Tutorial'), 36, 11);
    makeButton(this, menuX, VIEW.cy + 46, 220, 'HOST ONLINE', () => this.scene.start('Lobby', { role: 'host' }), 36, 15);
    makeButton(this, menuX, VIEW.cy + 88, 220, 'JOIN WITH CODE', () => this.join(), 36, 15);
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
      .text(menuX, VIEW.cy + 122, data?.message ?? '', { fontFamily: 'monospace', fontSize: '11px', color: '#ff8a7a', resolution: PIXEL_RATIO })
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
      navRegister(this, bg, onTap);
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

  // In-canvas code entry with its own keypad (a native prompt() dialog
  // swallows touch-end on Android and leaves the joystick stuck). Only
  // characters that can appear in a room code are offered. A physical
  // keyboard can type too.
  private join(): void {
    const items: Phaser.GameObjects.GameObject[] = [];
    const D = 300;
    let code = '';
    const txt = (x: number, y: number, s: string, size: number, color: string) => {
      const t = this.add
        .text(x, y, s, { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color, resolution: PIXEL_RATIO })
        .setOrigin(0.5)
        .setDepth(D + 2);
      items.push(t);
      return t;
    };
    const key = (x: number, y: number, w: number, h: number, label: string, onTap: () => void, fill = 0x2a3140) => {
      const bg = this.add.rectangle(x, y, w, h, fill, 1).setStrokeStyle(1, 0x7fb3ff).setDepth(D + 1).setInteractive();
      const tap = () => {
        bg.setFillStyle(0x4a5a78);
        this.time.delayedCall(90, () => bg.active && bg.setFillStyle(fill));
        onTap();
      };
      bg.on('pointerdown', tap);
      navRegister(this, bg, tap);
      items.push(bg);
      return txt(x, y, label, 13, '#ffffff');
    };

    items.push(this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x000000, 0.8).setDepth(D).setInteractive());
    items.push(this.add.rectangle(VIEW.cx, VIEW.cy, 400, 300, 0x151922, 1).setStrokeStyle(2, 0x5a6378).setDepth(D));
    txt(VIEW.cx, VIEW.cy - 128, 'ENTER ROOM CODE', 14, '#ffd24a');

    const slots: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < 3; i++) {
      const x = VIEW.cx + (i - 1) * 46;
      items.push(this.add.rectangle(x, VIEW.cy - 92, 38, 44, 0x0c0f15, 1).setStrokeStyle(2, 0x5a6378).setDepth(D + 1));
      slots.push(txt(x, VIEW.cy - 92, '', 26, '#ffffff'));
    }
    const status = txt(VIEW.cx, VIEW.cy - 60, '', 10, '#ff8a7a');

    getNav(this).textEntry = true;
    const close = () => {
      getNav(this).textEntry = false;
      window.removeEventListener('keydown', onKey);
      for (const o of items) o.destroy();
    };
    const submit = () => {
      const c = normalizeRoomCode(code);
      if (!c) {
        status.setText('enter all 3 characters');
        return;
      }
      close();
      this.scene.start('Lobby', { role: 'guest', code: c });
    };
    const type = (ch: string) => {
      if (code.length >= 3) return;
      code += ch;
      status.setText('');
      refresh();
    };
    const back = () => {
      code = code.slice(0, -1);
      refresh();
    };
    const refresh = () => {
      slots.forEach((s, i) => s.setText(code[i] ?? ''));
    };

    // 31 characters + DEL on an 8 x 4 grid.
    const cols = 8;
    const kw = 42;
    const kh = 30;
    const keys = [...ROOM_ALPHABET];
    keys.forEach((ch, i) => {
      const x = VIEW.cx + ((i % cols) - (cols - 1) / 2) * (kw + 4);
      const y = VIEW.cy - 24 + Math.floor(i / cols) * (kh + 4);
      key(x, y, kw, kh, ch, () => type(ch));
    });
    const di = keys.length;
    key(VIEW.cx + ((di % cols) - (cols - 1) / 2) * (kw + 4), VIEW.cy - 24 + Math.floor(di / cols) * (kh + 4), kw, kh, 'DEL', back, 0x3a2a2a);
    key(VIEW.cx - 70, VIEW.cy + 124, 120, 30, 'CANCEL', close, 0x3a2a2a);
    key(VIEW.cx + 70, VIEW.cy + 124, 120, 30, 'JOIN', submit, 0x2a4a34);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') close();
      else {
        const ch = e.key.toUpperCase().replace('O', '0');
        if (ch.length === 1 && ROOM_ALPHABET.includes(ch)) type(ch);
      }
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
  }
}
