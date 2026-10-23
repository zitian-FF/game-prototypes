import { BaseScene, DEBUG, bufferScale, isTouch, logicalSize } from './base';
import { LOGO_H, LOGO_W, bakeLogo } from '../ui/material';
import { drawKeyboard } from '../ui/keyboard';
import { Ui, TextField, drawField } from '../ui/ui';
import { intents } from '../input/intents';
import { session, normalizeRoomCode, randomRoomCode, serverBase } from '../net/session';
import { COLORS } from '../theme';
import { GAME_VERSION, VERSION_LOG } from '../versionLog';
import { QuotaWatcher } from '../net/quota';
import { VERSION_STAMP } from '../version.generated';
import { cleanName } from 'firestorm-net';
import { HandbookView } from './handbookView';
import tuneJson from '../../tune.json';

const AUTOPLAY = DEBUG && new URLSearchParams(location.search).get('autoplay') === '1';

/** Heights of the menu footer: capacity, version and change log, reset and privacy; or capacity, reset and privacy. */
const FOOT_FULL = 150;
const FOOT_SLIM = 80;

export class MenuScene extends BaseScene {
  private nameField = new TextField('', 20, (s) => s.replace(/[<>]/g, ''));
  private quota = new QuotaWatcher();
  private codeField = new TextField('', 3, normalizeRoomCode);
  private focus: 'name' | 'code' = 'name';
  private started = false;
  private handbook = new HandbookView();
  private handbookOpen = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.setup();
    this.nameField.value = session.name;
    this.focus = session.name ? 'code' : 'name';
    this.started = false;
    this.handbookOpen = false;
    this.handbook.reset();
    intents.textMode = true;
    this.quota.start();
    this.events.once('shutdown', () => this.quota.stop());
    if (AUTOPLAY && !this.started) {
      this.nameField.value = 'Tester';
      this.createRoom();
    }
  }

  private connecting(): boolean {
    return session.status === 'connecting';
  }

  private createRoom(): void {
    const name = cleanName(this.nameField.value);
    if (!name) {
      session.error = 'Enter a name first.';
      return;
    }
    if (this.quota.status && !this.quota.status.canStart) {
      session.error = 'The server has used up its daily limit. New games open again at 00:00 UTC.';
      return;
    }
    session.setName(name);
    this.started = true;
    session.connect(randomRoomCode(), true);
  }

  private joinRoom(): void {
    const name = cleanName(this.nameField.value);
    if (!name) {
      session.error = 'Enter a name first.';
      return;
    }
    if (this.codeField.value.length !== 3) {
      session.error = 'Room codes are 3 letters or digits.';
      return;
    }
    session.setName(name);
    this.started = true;
    session.connect(this.codeField.value, false);
  }

  private wrapLog(text: string, maxW: number): string[] {
    const maxChars = Math.max(20, Math.floor(maxW / 5.8));
    const out: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      if ((line + ' ' + word).trim().length > maxChars && line) {
        out.push(line);
        line = word;
      } else line = (line + ' ' + word).trim();
    }
    if (line) out.push(line);
    return out;
  }

  update(): void {
    const field = this.focus === 'name' ? this.nameField : this.codeField;
    for (const e of intents.drain()) {
      if (this.handbookOpen) {
        if (this.handbook.input(e, this.handbook.area)) this.handbookOpen = false;
        else if (e.type === 'primary') this.ui.click(e.x, e.y);
        continue;
      }
      if (e.type === 'text' && !this.connecting()) field.type(e.char);
      else if (e.type === 'backspace') field.backspace();
      else if (e.type === 'submit' && !this.connecting()) (this.focus === 'code' && this.codeField.value.length === 3 ? this.joinRoom() : this.createRoom());
      else if (e.type === 'primary') this.ui.click(e.x, e.y);
    }

    if (session.status === 'open' && session.lobby) {
      this.go('Lobby');
      return;
    }

    const { w, h } = logicalSize();
    const ui: Ui = this.ui;
    ui.begin();
    if (this.handbookOpen) {
      this.handbook.draw(ui, w, h, this.time.now / 1000, () => (this.handbookOpen = false));
      this.drawVersion();
      ui.end();
      return;
    }
    // Touch devices get an on-screen keyboard: beside the form when the window is wide, below it when tall.
    const touch = isTouch();
    const wide = w >= 760;
    const kbW = touch ? (wide ? Math.min(430, w * 0.48) : Math.min(430, w - 24)) : 0;
    const cx = touch && wide ? w * 0.27 : w / 2;
    // Short windows (phones in landscape, small laptop windows) use the tighter form spacing.
    const compact = h < 560;
    const top = compact ? 6 : touch ? 14 : Math.max(16, h / 2 - 330);
    // The footer shares the screen with the keyboard, so a tall touch layout drops it.
    const footer = !touch || wide;
    // Height from the logo's bottom to the bottom of the form plate and its status line.
    const formH = (compact ? 14 + 24 : 19 + 40) + (compact ? 68 + 50 + 18 + 40 + 10 : 78 + 70 + 22 + 40 + 16) + (compact ? 22 : 30);
    // Fit the logo and the footer to the height: the full footer, then a slim one (capacity and reset), then none.
    // The logo shrinks first, down to a floor, before the footer gives way.
    const maxLs = Math.min(touch ? 0.46 : 0.6, ((touch && wide ? w * 0.5 : w) - 24) / LOGO_W);
    const lsFor = (f: number): number => Math.min(maxLs, (h - f - top - formH) / LOGO_H);
    const foot = !footer ? 'none' : lsFor(FOOT_FULL) >= 0.3 ? 'full' : lsFor(FOOT_SLIM) >= 0.22 ? 'slim' : 'none';
    const ls = Math.max(0.16, lsFor(foot === 'full' ? FOOT_FULL : foot === 'slim' ? FOOT_SLIM : 0));
    const footTop = foot === 'full' ? h - FOOT_FULL : foot === 'slim' ? h - FOOT_SLIM : h;
    ui.backdrop(0, 0, w, h, 0x0b0709, 1);
    // A glow of lava on the horizon: low on the screen, above the footer and, where there is room, below the form.
    const formEnd = top + LOGO_H * ls + formH - (compact ? 22 : 30);
    let horizon = Math.min(h * 0.72, footTop - 6);
    if (horizon < formEnd + 4) horizon = Math.min(footTop - 2, formEnd + 4);
    ui.backdrop(0, horizon, w, h - horizon, 0x2a0d05, 0.7);
    if (foot !== 'none') ui.backdrop(0, horizon, w, 3, 0xff6a2a, 0.8);
    // The logo: baked once at the screen's pixel ratio, scaled to fit.
    ui.image(bakeLogo(this, bufferScale()), cx, top, ls / bufferScale(), 0.5, 0);
    const subY = top + LOGO_H * ls + (compact ? 0 : 4);
    ui.text(`${tuneJson.match.playersPerTeam} v ${tuneJson.match.playersPerTeam} node capture under fog of war`, cx, subY, { size: compact ? 12 : 15, align: 'center', color: COLORS.dim });

    const pw = Math.min(360, w - 60);
    const px = cx - pw / 2;
    let y = subY + (compact ? 24 : 40);
    const formTop = y - (compact ? 10 : 16);
    // The form sits on one steel plate, drawn first so the widgets on it take the clicks.
    const formBottom = y + (compact ? 68 + 50 + 18 : 78 + 70 + 22) + 40 + (compact ? 10 : 16);
    ui.panel(px - (compact ? 12 : 20), formTop, pw + (compact ? 24 : 40), formBottom - formTop);
    ui.text('Your name', px, y, { size: 12, color: COLORS.dim });
    drawField(ui, this.nameField, px, y + 18, pw, 40, this.focus === 'name', 'Commander name', () => (this.focus = 'name'));
    y += compact ? 68 : 78;
    const q = this.quota.status;
    ui.button(px, y, pw, compact ? 38 : 44, 'Create a room', { onClick: () => this.createRoom(), enabled: !this.connecting() && !(q && !q.canStart), active: true, size: 16 });
    y += compact ? 50 : 70;
    ui.text('or join with a code', cx, y, { size: 12, align: 'center', color: COLORS.dim });
    y += compact ? 18 : 22;
    drawField(ui, this.codeField, px, y, pw - 110, 40, this.focus === 'code', 'ROOM', () => (this.focus = 'code'));
    ui.button(px + pw - 100, y, 100, 40, 'Join', { onClick: () => this.joinRoom(), enabled: !this.connecting() && this.codeField.value.length === 3 });
    y += compact ? 50 : 60;
    if (this.connecting()) ui.text('Connecting...', cx, y, { size: 14, align: 'center', color: COLORS.warn });
    else if (session.error) ui.text(session.error, cx, y, { size: 14, align: 'center', color: COLORS.bad });
    if (touch) {
      const keyH = Math.max(30, Math.min(42, (h - (wide ? 40 : y + 20)) / 6.6));
      const gap = 5;
      const kind = this.focus === 'name' ? 'name' : 'code';
      const field = this.focus === 'name' ? this.nameField : this.codeField;
      const kbH = (kind === 'code' ? 5 : 5) * keyH + 4 * gap;
      const kx = wide ? w - kbW - 16 : (w - kbW) / 2;
      const ky = wide ? Math.max(10, (h - kbH) / 2) : Math.max(y + 8, h - kbH - 8);
      ui.text(kind === 'name' ? 'Type your name' : 'Room code', kx + kbW / 2, ky - 18, { size: 12, align: 'center', color: COLORS.dim });
      drawKeyboard(ui, field, kind, kx, ky, kbW, keyH, gap, kind === 'name' ? 'Next' : 'Join', () => {
        if (this.connecting()) return;
        if (kind === 'name') this.focus = 'code';
        else this.joinRoom();
      });
    }
    if (foot !== 'none') ui.button(cx - 80, h - 46, 160, 26, 'Reset saved session', {
      onClick: () => {
        session.resetSaved();
        this.nameField.value = '';
        this.codeField.value = '';
        this.focus = 'name';
      },
      size: 11,
    });
    // Daily server capacity: an estimate of how many more games today's free limits allow.
    if (q && foot !== 'none') {
      const left = q.matchesLeft;
      const pctLeft = typeof q.percentLeft === 'number' ? q.percentLeft : Math.round((left / 22) * 100); // an older server has no percent
      const reset = Math.max(0, q.resetsAtMs - Date.now());
      const hh = Math.floor(reset / 3_600_000);
      const mm = Math.floor((reset % 3_600_000) / 60_000);
      const text = q.canStart ? `Server capacity today: ${pctLeft}% left, room for about ${left} more 30 min ${left === 1 ? 'game' : 'games'}` : `Server daily limit reached, new games open in ${hh}h ${mm}m`;
      ui.text(text, cx, footTop + 8, { size: 12, align: 'center', bold: true, color: !q.canStart ? COLORS.bad : pctLeft <= 15 ? COLORS.warn : COLORS.dim });
    } else if (this.quota.failed && foot !== 'none') {
      ui.text('Server capacity: unknown (server not reachable)', cx, footTop + 8, { size: 12, align: 'center', color: COLORS.dim });
    }
    if (foot === 'full') {
      ui.text(`Version ${GAME_VERSION} (${VERSION_STAMP})`, cx, h - 114, { size: 11, align: 'center', color: COLORS.dim, bold: true });
      // The change log wraps to the space available, ending just above the version line.
      const lines = this.wrapLog(VERSION_LOG, Math.min(w - 24, touch ? w * 0.5 : 900));
      lines.forEach((l, i) => ui.text(l, cx, h - 98 + i * 14, { size: 11, align: 'center', color: COLORS.dim }));
    }
    // Players are told, in one line, that anonymous play stats are kept.
    if (foot !== 'none') ui.text('Anonymous play stats (what you order and score) are recorded to improve the game.', cx, h - 15, { size: 10, align: 'center', color: COLORS.dim, alpha: 0.8 });
    ui.button(12, 20, 104, 30, 'Handbook', { onClick: () => (this.handbookOpen = true), size: 13 });
    ui.button(12, 56, 104, 26, session.tipsOn ? 'Tips: on' : 'Tips: off', { onClick: () => session.setTipsOn(!session.tipsOn), size: 11, active: session.tipsOn });
    if (DEBUG) ui.text(`server ${serverBase()}`, cx, 22, { size: 10, align: 'center', color: COLORS.dim });
    this.drawVersion();
    ui.end();
  }
}
