import { BaseScene, DEBUG, logicalSize } from './base';
import { Ui } from '../ui/ui';
import { intents } from '../input/intents';
import { session } from '../net/session';
import { COLORS } from '../theme';

const AUTOPLAY = DEBUG && new URLSearchParams(location.search).get('autoplay') === '1';

export class LobbyScene extends BaseScene {
  private fillBots = true;
  private autoSent = false;

  constructor() {
    super('Lobby');
  }

  create(): void {
    this.setup();
    intents.textMode = false;
    this.fillBots = true;
    this.autoSent = false;
  }

  private leave(): void {
    session.leave();
    this.go('Menu');
  }

  update(): void {
    for (const e of intents.drain()) {
      if (e.type === 'primary') this.ui.click(e.x, e.y);
      else if (e.type === 'pause') this.leave();
    }
    if (session.info) {
      this.go('Game');
      return;
    }
    if (session.status === 'idle') {
      this.go('Menu');
      return;
    }
    const lobby = session.lobby;
    const { w, h } = logicalSize();
    const ui: Ui = this.ui;
    ui.begin();
    ui.rect(0, 0, w, h, 0x0b0709, 1);
    const cx = w / 2;
    const top = Math.max(30, h / 2 - 280);
    ui.text('ROOM CODE', cx, top, { size: 12, align: 'center', color: COLORS.dim });
    ui.text(session.room, cx, top + 16, { size: 56, align: 'center', bold: true, color: '#ff8a3d' });
    ui.text('Share this code. Friends join from the main menu.', cx, top + 84, { size: 13, align: 'center', color: COLORS.dim });

    if (lobby) {
      const pw = Math.min(620, w - 40);
      const px = cx - pw / 2;
      const py = top + 118;
      const ph = Math.min(300, h - py - 150);
      ui.panel(px, py, pw, ph);
      ui.text(`Players ${lobby.players.length} / ${lobby.maxPlayers}`, px + 14, py + 10, { size: 13, bold: true });
      const colW = (pw - 28) / 2;
      const rowH = 22;
      const perCol = Math.max(1, Math.floor((ph - 44) / rowH));
      lobby.players.slice(0, perCol * 2).forEach((p, i) => {
        const col = Math.floor(i / perCol);
        const row = i % perCol;
        const x = px + 14 + col * colW;
        const y = py + 36 + row * rowH;
        ui.rect(x, y + 6, 8, 8, p.connected ? 0x5dff8a : 0x666c75, 1, undefined, 4);
        const you = p.clientId === session.save.clientId ? ' (you)' : '';
        const host = p.clientId === lobby.hostId ? '  host' : '';
        ui.text(p.name + you + host, x + 16, y, { size: 13, color: p.clientId === lobby.hostId ? '#ffd54a' : COLORS.text });
      });

      const by = py + ph + 16;
      const counting = lobby.phase === 'countdown';
      if (counting) {
        const left = Math.max(0, Math.ceil(((lobby.countdownEndsAtMs ?? 0) - session.serverNow()) / 1000));
        ui.text(`Match starts in ${left}`, cx, by, { size: 22, align: 'center', bold: true, color: COLORS.warn });
        if (session.isHost) ui.button(cx - 90, by + 38, 180, 40, 'Cancel start', { onClick: () => session.send({ t: 'cancelStart' }), accent: COLORS.enemy });
      } else if (session.isHost) {
        ui.button(cx - 250, by, 250, 40, this.fillBots ? 'Bots fill empty slots: ON' : 'Bots fill empty slots: OFF', {
          onClick: () => (this.fillBots = !this.fillBots),
          active: this.fillBots,
        });
        ui.button(cx + 10, by, 240, 40, 'Start match', { onClick: () => session.send({ t: 'start', fillBots: this.fillBots }), active: true, size: 16 });
        ui.text('Starting opens a 3 second window you can cancel in.', cx, by + 52, { size: 12, align: 'center', color: COLORS.dim });
      } else {
        ui.text('Waiting for the host to start...', cx, by + 6, { size: 15, align: 'center', color: COLORS.dim });
      }
      ui.button(24, h - 56, 100, 34, 'Leave', { onClick: () => this.leave() });
      if (AUTOPLAY && session.isHost && !this.autoSent && lobby.phase === 'lobby') {
        this.autoSent = true;
        session.send({ t: 'start', fillBots: true });
      }
    } else {
      ui.text('Joining...', cx, top + 140, { size: 15, align: 'center', color: COLORS.warn });
    }
    this.drawVersion();
    ui.end();
  }
}
