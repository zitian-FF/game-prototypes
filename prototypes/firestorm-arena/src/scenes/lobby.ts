import { BaseScene, DEBUG, logicalSize } from './base';
import { Ui } from '../ui/ui';
import { intents } from '../input/intents';
import { session } from '../net/session';
import { COLORS, cssColor } from '../theme';

const AUTOPLAY = DEBUG && new URLSearchParams(location.search).get('autoplay') === '1';

export class LobbyScene extends BaseScene {
  private fillBots = true;
  private minutes = 30;
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
    session.finish();
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
      const ph = Math.min(300, h - py - 200);
      const me = lobby.players.find((p) => p.clientId === session.save.clientId);
      const per = 20;
      const gap = 12;
      const tw = (pw - gap) / 2;
      const rowH = 20;
      const canSwitch = lobby.phase === 'lobby';
      ([0, 1] as const).forEach((team) => {
        const x0 = px + team * (tw + gap);
        const members = lobby.players.filter((p) => p.team === team);
        const mine = me?.team === team;
        ui.panel(x0, py, tw, ph);
        if (mine) ui.rect(x0, py, tw, 3, team === 0 ? COLORS.mine : COLORS.enemy, 1);
        ui.text(`Team ${team + 1}`, x0 + 14, py + 10, { size: 15, bold: true, color: team === 0 ? cssColor(COLORS.mine) : cssColor(COLORS.enemy) });
        ui.text(`${members.length} / ${per} players`, x0 + tw - 14, py + 12, { size: 12, align: 'right', color: COLORS.dim });
        const rows = Math.max(1, Math.floor((ph - 86) / rowH));
        members.slice(0, rows).forEach((p, i) => {
          const y = py + 38 + i * rowH;
          ui.rect(x0 + 14, y + 5, 8, 8, p.connected ? 0x5dff8a : 0x666c75, 1, undefined, 4);
          const you = p.clientId === session.save.clientId ? ' (you)' : '';
          const host = p.clientId === lobby.hostId ? '  host' : '';
          ui.text(p.name + you + host, x0 + 28, y, { size: 13, color: p.clientId === lobby.hostId ? '#ffd54a' : COLORS.text });
        });
        if (members.length > rows) ui.text(`+${members.length - rows} more`, x0 + 28, py + 38 + rows * rowH, { size: 12, color: COLORS.dim });
        const by2 = py + ph - 40;
        if (mine) ui.text('You are on this team', x0 + tw / 2, by2 + 8, { size: 12, align: 'center', color: COLORS.dim });
        else {
          const full = members.length >= per;
          ui.button(x0 + 14, by2, tw - 28, 30, full ? 'Team full' : `Join Team ${team + 1}`, {
            onClick: () => session.send({ t: 'setTeam', team }),
            enabled: canSwitch && !full,
            size: 13,
            accent: team === 0 ? COLORS.mine : COLORS.enemy,
          });
        }
      });
      ui.text(`${lobby.players.length} ${lobby.players.length === 1 ? "player" : "players"}. Bots fill the empty slots of both teams to ${per} each when you start.`, cx, py + ph + 8, { size: 12, align: 'center', color: COLORS.dim });

      const by = py + ph + 64;
      const counting = lobby.phase === 'countdown';
      if (counting) {
        const left = Math.max(0, Math.ceil(((lobby.countdownEndsAtMs ?? 0) - session.serverNow()) / 1000));
        ui.text(`${lobby.minutes} minute match starts in ${left}`, cx, by, { size: 22, align: 'center', bold: true, color: COLORS.warn });
        if (session.isHost) ui.button(cx - 90, by + 38, 180, 40, 'Cancel start', { onClick: () => session.send({ t: 'cancelStart' }), accent: COLORS.enemy });
      } else if (session.isHost) {
        ui.text('Match length', cx - 250, by - 34, { size: 12, color: COLORS.dim });
        [10, 15, 20, 30].forEach((m, i) =>
          ui.button(cx - 164 + i * 84, by - 38, 76, 26, `${m} min`, { onClick: () => (this.minutes = m), active: this.minutes === m, size: 12 }),
        );
        ui.button(cx - 250, by, 250, 40, this.fillBots ? 'Bots fill empty slots: ON' : 'Bots fill empty slots: OFF', {
          onClick: () => (this.fillBots = !this.fillBots),
          active: this.fillBots,
        });
        ui.button(cx + 10, by, 240, 40, 'Start match', { onClick: () => session.send({ t: 'start', fillBots: this.fillBots, minutes: this.minutes }), active: true, size: 16 });
        ui.text('Starting opens a 3 second window you can cancel in.', cx, by + 52, { size: 12, align: 'center', color: COLORS.dim });
      } else {
        ui.text(`Waiting for the host to start (${lobby.minutes} minute match)...`, cx, by + 6, { size: 15, align: 'center', color: COLORS.dim });
      }
      ui.button(24, h - 56, session.isHost ? 120 : 100, 34, session.isHost ? 'End room' : 'Leave', { onClick: () => this.leave() });
      if (AUTOPLAY && session.isHost && !this.autoSent && lobby.phase === 'lobby') {
        this.autoSent = true;
        session.send({ t: 'start', fillBots: true, minutes: this.minutes });
      }
    } else {
      ui.text('Joining...', cx, top + 140, { size: 15, align: 'center', color: COLORS.warn });
    }
    this.drawVersion();
    ui.end();
  }
}
