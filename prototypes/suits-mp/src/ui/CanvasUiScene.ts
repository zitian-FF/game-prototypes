import Phaser from 'phaser';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { preloadCardArt } from './cardArt';
import { symbolArtFile } from '../rules/godArt';
import { getSnapshot as lobby, subscribe as subscribeLobby, goToJoinScreen, goToLandingScreen } from '../uiState/lobby/lobbyUiStore';
import { getSnapshot as overlay, subscribe as subscribeOverlay } from '../uiState/overlay/gameOverlayStore';
import { getSnapshot as modal, subscribe as subscribeModal, closeRules, closeRedistLog, closeMenu, closeEndGameConfirm } from '../uiState/domUiStore';
import { getSnapshot as tutorial, subscribe as subscribeTutorial } from '../uiState/tutorial/tutorialUiStore';
import { seatModel } from '../uiState/lobby/lobbySeats';
import { ERRORS, SUBTITLES } from '../uiState/lobby/lobbyContent';
import type { ErrorKind } from '../uiState/lobby/lobbyContent';
import { SECTIONS } from '../uiState/rulesContent';
import { isValidLobbyCode, lobbyInviteUrl, normalizeLobbyCode, LOBBY_CODE_CHARS, LOBBY_CODE_LENGTH } from '../net/lobbyCode';
const DISPLAY_NAME_MAX_LENGTH = 20;
import tune from '../../tune.json';

const W = 390, H = 844;
const GOLD = '#d8bd83', PALE = '#eee6d6', TEAL = '#9bcac4';

// This scene contains only interface controls. The game board and cards stay in
// their existing scenes; Phaser's input manager lets empty areas pass through.
export class CanvasUiScene extends Phaser.Scene {
  private nodes: Phaser.GameObjects.GameObject[] = [];
  private unsubs: Array<() => void> = [];
  private name = '';
  private code = '';
  private rulesPage = 0;
  private logPage = 0;
  private keyboard: { title: string; value: string; save: (value: string) => void } | null = null;
  private toast = '';

  constructor() { super({ key: 'CanvasUI' }); }
  preload(): void { preloadCardArt(this); }
  create(): void {
    this.cameras.main.setZoom(PIXEL_RATIO);
    this.cameras.main.centerOn(W / 2, H / 2);
    const redraw = () => this.redraw();
    this.unsubs = [subscribeLobby(redraw), subscribeOverlay(redraw), subscribeModal(redraw), subscribeTutorial(redraw)];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((fn) => fn()));
    this.redraw();
  }
  update(): void {
    const scenes = this.scene.manager.getScenes(true);
    if (this.scene.isActive() && scenes[scenes.length - 1] !== this) this.scene.bringToTop();
  }
  private track<T extends Phaser.GameObjects.GameObject>(node: T): T { this.nodes.push(node); return node; }
  private rect(x: number, y: number, w: number, h: number, fill = 0x0b1117, alpha = 1, stroke = 0x9f8452): Phaser.GameObjects.Rectangle {
    return this.track(this.add.rectangle(x, y, w, h, fill, alpha).setStrokeStyle(1, stroke, 0.75));
  }
  private text(value: string, x: number, y: number, size = 16, color = PALE, width = 330): Phaser.GameObjects.Text {
    return this.track(this.add.text(x, y, value, { fontFamily: size >= 17 ? '"IM Fell English SC", Georgia, serif' : '"Cormorant Unicase", Georgia, serif', fontSize: `${size}px`, color, align: 'center', wordWrap: { width }, lineSpacing: 3 }).setOrigin(0.5));
  }
  private image(key: string, x: number, y: number, w: number, h: number): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(key)) return null;
    return this.track(this.add.image(x, y, key).setDisplaySize(w, h));
  }
  private nine(key: string, x: number, y: number, w: number, h: number, cuts: [number, number], borders: [number, number]): void {
    if (!this.textures.exists(key)) return;
    const texture = this.textures.get(key);
    const source = texture.getSourceImage() as HTMLImageElement;
    const [top, left] = cuts, [edgeY, edgeX] = borders;
    const sw = [left, source.width - 2 * left, left];
    const sh = [top, source.height - 2 * top, top];
    const dw = [edgeX, w - 2 * edgeX, edgeX];
    const dh = [edgeY, h - 2 * edgeY, edgeY];
    let sy = 0, dy = y - h / 2;
    for (let row = 0; row < 3; row++) {
      let sx = 0, dx = x - w / 2;
      for (let col = 0; col < 3; col++) {
        const frame = `__canvas_ui_${top}_${left}_${row}_${col}`;
        if (!texture.has(frame)) texture.add(frame, 0, sx, sy, sw[col], sh[row]);
        this.track(this.add.image(dx + dw[col] / 2, dy + dh[row] / 2, key, frame).setDisplaySize(dw[col], dh[row]));
        sx += sw[col]; dx += dw[col];
      }
      sy += sh[row]; dy += dh[row];
    }
  }
  private button(label: string, x: number, y: number, w: number, h: number, callback: () => void, art?: string, enabled = true, size = 17): void {
    if (art === 'ui_landing_input') this.nine(art, x, y, w, h, [200, 170], [18, 15]);
    else if (art?.startsWith('ui_landing_button')) this.nine(art, x, y, w, h, [200, 170], art.endsWith('primary') ? [30, 26] : art.endsWith('secondary') ? [20, 17] : [13, 11]);
    else if (art?.startsWith('ui_action_slab_')) this.nine(art, x, y, w, h, [80, 80], [44, 44]);
    else if (art) this.image(art, x, y, w, h); else this.rect(x, y, w, h, enabled ? 0x172229 : 0x12171b, 0.95);
    this.text(label, x, y, size, enabled ? PALE : '#80908e', w - 18);
    if (enabled) this.track(this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).on('pointerup', callback));
  }
  private scrim(): void { this.track(this.add.rectangle(W / 2, H / 2, W, H, 0x020609, 0.88).setInteractive()); }
  private frame(title: string, subtitle = ''): void {
    this.rect(W / 2, H / 2, 364, 800, 0x0b1117, 0.97);
    this.text(title, W / 2, 69, 28, GOLD);
    if (subtitle) this.text(subtitle, W / 2, 99, 12, TEAL);
  }
  private redraw(): void {
    for (const node of this.nodes) node.destroy();
    this.nodes = [];
    const l = lobby(), g = overlay(), m = modal(), t = tutorial();
    if (l.visible) this.drawLobby();
    if (g.visible) this.drawGame();
    if (t.topBarOpen) this.drawTutorialBar();
    if (t.lessonOpen) { this.rect(195, 711, 350, 82, 0x0b2022, 0.96); this.text(t.lessonText, 195, 711, 14, PALE, 320); }
    if (t.introOpen) {
      this.scrim();
      this.text('How to Play', 195, 273, 26, PALE);
      this.text('4 players. 2 hidden teams of 2.', 195, 338, 17);
      this.text('Your goal: collect one full Deity Suit — all 10 cards of one god.', 195, 402, 17, PALE, 320);
      this.text('For this tutorial, Player 2 is your ally. In a real game your ally is hidden — you have to work it out from how people play.', 195, 500, 16, PALE, 320);
      this.button('Tap to continue', 195, 664, 250, 55, t.onIntroDismiss, undefined, true, 14);
    }
    if (t.completeOpen) {
      this.scrim(); this.text('Tutorial: More Coming Soon', 195, 322, 25, PALE);
      this.text("You've completed every lesson built so far. More are on the way.", 195, 410, 16, PALE, 300);
      this.button('Back to Menu', 195, 670, 250, 58, t.onCompleteBackToMenu);
    }
    if (m.menuOpen) this.drawMenu();
    if (m.rulesOpen) this.drawRules();
    if (m.redistLogOpen) this.drawLog();
    if (m.endGameConfirmOpen) this.drawConfirm();
    if (m.victoryOpen) this.drawVictory();
    if (m.gameEndedOpen) this.drawGameEnded();
    if (this.keyboard) this.drawKeyboard();
  }
  private drawLobby(): void {
    const l = lobby();
    this.track(this.add.rectangle(195, 422, 390, 844, 0x071015, 0.92));
    if (l.screen === 'landing') {
      this.image('logo_suits_of_madness', 195, 160, 345, 180);
      this.text('PLAYER NAME (OPTIONAL)', 195, 263, 11, GOLD);
      this.button(this.name || 'Player', 195, 308, 335, 48, () => this.edit('Player name', this.name, (v) => { this.name = v.slice(0, DISPLAY_NAME_MAX_LENGTH); }), 'ui_landing_input');
      this.button('Create Room', 195, 390, 338, 76, () => l.onHost(this.name.trim()), 'ui_landing_button_primary', true, 24);
      this.button('Join Room', 195, 483, 338, 76, goToJoinScreen, 'ui_landing_button_primary', true, 24);
      this.text('Four players are needed to begin.', 195, 545, 13, TEAL);
      this.button('Single Player', 195, 614, 338, 65, l.onSinglePlayer, 'ui_landing_button_secondary', true, 21);
      this.button('Tutorial', 195, 696, 338, 65, l.onTutorial, 'ui_landing_button_tutorial', true, 21);
      return;
    }
    this.text(SUBTITLES[l.screen] || 'SUITS OF MADNESS', 195, 98, 22, GOLD);
    if (l.screen === 'join') {
      this.text(`Enter the ${LOBBY_CODE_LENGTH}-character Room Code`, 195, 282, 17);
      this.button(this.code || 'ROOM CODE', 195, 352, 315, 58, () => this.edit('Room code', this.code, (v) => { this.code = normalizeLobbyCode(v); }), 'ui_landing_input', true, 20);
      for (let i = 0; i < LOBBY_CODE_LENGTH; i++) this.rect(195 + (i - (LOBBY_CODE_LENGTH - 1) / 2) * 28, 403, 24, 2, i < this.code.length ? 0x9bcac4 : 0x36504e, 1, i < this.code.length ? 0x9bcac4 : 0x36504e);
      this.text(isValidLobbyCode(this.code) ? 'Room Code complete' : `${Math.max(0, LOBBY_CODE_LENGTH - this.code.length)} characters remain`, 195, 425, 11, TEAL);
      this.button('Join Room', 195, 510, 320, 70, () => l.onSubmitJoin(this.code, this.name.trim()), 'ui_landing_button_primary', isValidLobbyCode(this.code), 23);
      this.button('Back', 195, 602, 250, 55, goToLandingScreen);
      return;
    }
    if (l.screen === 'lobby') {
      this.text('ROOM CODE', 195, 185, 12, TEAL);
      this.text(l.roomCode, 195, 225, 38, GOLD);
      this.button('Copy Code', 76, 277, 100, 35, () => { void navigator.clipboard?.writeText(l.roomCode); this.showToast('Code copied.'); }, undefined, true, 12);
      this.button('Copy Link', 195, 277, 100, 35, () => { void navigator.clipboard?.writeText(lobbyInviteUrl(l.roomCode)); this.showToast('Summons copied.'); }, undefined, true, 12);
      this.button('Refresh', 314, 277, 100, 35, l.onRefreshCode, undefined, true, 12);
      if (this.toast) this.text(this.toast, 195, 307, 11, TEAL);
      seatModel(l.seats, l.onFillBot, l.onReleaseBot).forEach((seat, i) => {
        const y = 340 + i * 75;
        this.rect(195, y, 338, 65, seat.state === 'empty' ? 0x0b1519 : 0x182024);
        this.text(seat.numeral, 48, y, 20, GOLD, 40);
        this.text(seat.name, 155, y - 10, 18, PALE, 175);
        this.text(seat.role, 155, y + 13, 10, TEAL, 175);
        if (seat.canFill) this.button('+ Bot', 314, y, 76, 35, seat.fill, undefined, true, 13);
        if (seat.canRelease) this.button('Remove', 314, y, 76, 35, seat.release, undefined, true, 12);
      });
      this.button('Start Game', 195, 705, 320, 68, l.onStartGame, 'ui_landing_button_primary', l.seats.every((s) => s.occupancy !== null), 23);
      return;
    }
    if (l.screen === 'waiting') {
      this.text(l.hostLeft ? 'Host Disconnected' : 'Waiting for the Host', 195, 345, 27, GOLD);
      this.text(l.hostLeft ? 'The room has closed.' : `Room ${l.roomCode || ''}\nThe host will begin when all seats are ready.`, 195, 407, 16, PALE);
      this.button('Return to Main Menu', 195, 656, 310, 60, l.onBack);
      return;
    }
    if (l.screen === 'joining' || l.screen === 'reconnecting') {
      this.text(l.screen === 'joining' ? 'Opening the room…' : 'Reconnecting…', 195, 376, 23, GOLD);
      this.button('Cancel', 195, 654, 280, 56, l.onBack);
      return;
    }
    const error = ERRORS[l.screen as ErrorKind];
    if (error) {
      this.text(error.glyph, 195, 280, 50, GOLD);
      this.text(error.title, 195, 365, 27, PALE);
      this.text(error.detail, 195, 430, 16, TEAL, 320);
      this.button(error.primary, 195, 581, 310, 58, l.onRetry);
      this.button('Return to Main Menu', 195, 656, 310, 52, l.onBack);
    }
  }
  private edit(label: string, current: string, save: (value: string) => void): void {
    this.keyboard = { title: label, value: current, save };
    this.redraw();
  }
  private drawKeyboard(): void {
    const keyboard = this.keyboard;
    if (!keyboard) return;
    this.scrim();
    this.rect(195, 420, 364, 502, 0x0d151a, 1);
    this.text(keyboard.title, 195, 210, 22, GOLD);
    this.rect(195, 271, 310, 51, 0x111d23);
    this.text(keyboard.value || ' ', 195, 271, 21, PALE, 285);
    const rows = keyboard.title === 'Room code'
      ? [LOBBY_CODE_CHARS.slice(0, 8), LOBBY_CODE_CHARS.slice(8, 16), LOBBY_CODE_CHARS.slice(16, 24), LOBBY_CODE_CHARS.slice(24)]
      : ['QWERTYUI', 'OPASDFGH', 'JKLZXCVB', 'NM 12345', '67890'];
    rows.forEach((row, rowIndex) => {
      const chars = [...row];
      const gap = 3, keyW = Math.min(37, (335 - (chars.length - 1) * gap) / chars.length);
      const left = 195 - (chars.length * keyW + (chars.length - 1) * gap) / 2 + keyW / 2;
      chars.forEach((char, i) => this.button(char === ' ' ? 'Space' : char, left + i * (keyW + gap), 337 + rowIndex * 54, keyW, 45, () => {
        keyboard.value += char;
        keyboard.value = keyboard.title === 'Room code'
          ? normalizeLobbyCode(keyboard.value).slice(0, LOBBY_CODE_LENGTH)
          : keyboard.value.slice(0, DISPLAY_NAME_MAX_LENGTH);
        this.redraw();
      }, undefined, true, char === ' ' ? 9 : 16));
    });
    this.button('⌫', 78, 619, 100, 48, () => { keyboard.value = keyboard.value.slice(0, -1); this.redraw(); });
    this.button('Cancel', 195, 619, 100, 48, () => { this.keyboard = null; this.redraw(); }, undefined, true, 14);
    this.button('Done', 312, 619, 100, 48, () => { keyboard.save(keyboard.value); this.keyboard = null; this.redraw(); }, undefined, true, 16);
  }
  private drawGame(): void {
    const g = overlay();
    const order = ['top', 'right', 'bottom', 'left'] as const;
    const starter = order.indexOf(g.starterSeat ?? 'top');
    const angle = g.leadGodIndex === null ? 0 : (starter - g.leadGodIndex + 4) % 4 * Math.PI / 2;
    this.image('ui_suit_cycle_bezel', 195, 305, 168, 168)?.setRotation(angle);
    const gods = ['YogSothoth', 'Cthulhu', 'ShubNiggurath', 'Nyarlathotep'] as const;
    gods.forEach((god, i) => {
      const a = i * Math.PI / 2 - Math.PI / 2 + angle;
      const x = 195 + Math.cos(a) * 50.4, y = 305 + Math.sin(a) * 50.4;
      this.image(symbolArtFile(god), x, y, 168 * tune.suitCycleSymbolSizeFraction, 168 * tune.suitCycleSymbolSizeFraction);
      if (i === g.leadGodIndex) this.text('LEAD', x, y, 8, PALE, 45);
    });
    this.image('ui_current_turn_pointer', 195, 305, 98, 98)?.setRotation(order.indexOf(g.currentTurnSeat ?? 'top') * Math.PI / 2);
    const seats = [{ id: 'top', x: 195, y: 73 }, { id: 'left', x: 58, y: 382 }, { id: 'right', x: 332, y: 382 }] as const;
    seats.forEach(({ id, x, y }) => {
      const delegate = g.seatDelegate[id];
      const state = delegate.staged ? 'selected' : delegate.tappable ? 'eligible' : 'neutral';
      const width = tune.remoteNameplateWidth;
      this.image(`ui_remote_player_nameplate_${state}`, x, y, width, width / 2);
      this.text(g.seatLabels[id], x, y, id === 'top' ? 15 : 14, PALE, width - 12);
      if (delegate.tappable) this.track(this.add.zone(x, y, width, width / 2).setInteractive().on('pointerup', delegate.onPick));
    });
    this.nine('ui_player_nameplate', 195, 501 + tune.localNameplateHeight / 2, 260, tune.localNameplateHeight, [70, 95], [40, 76]);
    this.text(g.seatLabels.bottom, 145, 554, 17, PALE, 110);
    this.text(g.teamName, 268, 527, 11, GOLD, 105);
    [g.yourGodChip, g.teammateGodChip].forEach((chip, i) => {
      if (chip.god) this.image(symbolArtFile(chip.god), 246 + i * 47, 560, tune.localTeamSymbolSize, tune.localTeamSymbolSize);
      if (i === 0) this.text('YOU', 246, 578, 7, PALE, 35);
    });
    this.smallControl('☰', 'Menu', 36, 44, g.onOpenMenu);
    this.smallControl('⌘', 'Sort', 36, 802, g.onToggleSort);
    this.smallControl('☷', 'Log', 354, 802, g.onOpenRedistLog);
    const state = g.actionEnabled ? 'ready' : g.actionLabel.toLowerCase().startsWith('waiting') ? 'waiting' : 'disabled';
    this.button(g.actionLabel, 195, 844 - 16 - tune.actionButtonHeight / 2, tune.actionButtonWidth, tune.actionButtonHeight, g.onAction, `ui_action_slab_${state}`, g.actionEnabled, 20);
    this.text(g.actionHint, 195, 844 - 16 - tune.actionButtonHeight / 2 + 23, 9, GOLD, 220);
  }
  private smallControl(icon: string, label: string, x: number, y: number, click: () => void): void {
    this.image('ui_square_control', x, y, 52, 52);
    this.text(icon, x, y - 7, 15, GOLD, 40);
    this.text(label, x, y + 11, 10, GOLD, 40);
    this.track(this.add.zone(x, y, 52, 52).setInteractive().on('pointerup', click));
  }
  private drawMenu(): void {
    const m = modal(); this.scrim(); this.frame('Menu');
    this.button('Rules', 195, 306, 290, 60, m.onMenuRules);
    this.button('Previous Trick', 195, 390, 290, 60, m.onMenuPreviousTrick);
    this.button('Return to Menu', 195, 474, 290, 60, m.onMenuReturnToMenu);
    this.button('Close', 195, 663, 220, 50, () => { m.closeMenu(); closeMenu(); });
  }
  private drawRules(): void {
    const m = modal(), section = SECTIONS[this.rulesPage] ?? SECTIONS[0]; this.scrim(); this.frame('Rules', `${this.rulesPage + 1} / ${SECTIONS.length}`);
    this.text(section.title, 195, 163, 25, GOLD);
    if (section.isCycle) {
      (['YogSothoth', 'Cthulhu', 'ShubNiggurath', 'Nyarlathotep'] as const).forEach((god, i) => {
        const x = 65 + i * 87;
        this.image(symbolArtFile(god), x, 234, 56, 56);
        if (i < 3) this.text('›', x + 44, 234, 20, GOLD, 20);
      });
      this.text('SUIT CYCLE', 195, 283, 12, GOLD);
    }
    this.text(section.body.join('\n\n'), 195, section.isCycle ? 459 : 396, section.isCycle ? 14 : 16, PALE, 315);
    this.button('‹', 70, 692, 75, 48, () => { this.rulesPage = (this.rulesPage + SECTIONS.length - 1) % SECTIONS.length; this.redraw(); });
    this.button('Close', 195, 692, 140, 48, () => { m.closeRules(); closeRules(); });
    this.button('›', 320, 692, 75, 48, () => { this.rulesPage = (this.rulesPage + 1) % SECTIONS.length; this.redraw(); });
  }
  private drawLog(): void {
    const m = modal(), entries = m.redistLogEntries; this.scrim(); this.frame('Previous Tricks', entries.length ? `${this.logPage + 1} / ${entries.length}` : 'NO REDISTRIBUTIONS YET');
    const entry = entries[this.logPage];
    if (entry) {
      this.text(`Trick ${entry.trickNumber}${entry.wonByDouble ? ' · Double' : ''}`, 195, 190, 23, GOLD);
      this.text(`${entry.perspective === 'received' ? 'Received from' : 'Distributed by'} ${entry.fromPlayerLabel}`, 195, 244, 15, TEAL);
      this.text(entry.groups.map((group) => `${group.toPlayerLabel}: ${group.cards.join(', ')}`).join('\n\n'), 195, 410, 16, PALE, 315);
      this.button('‹', 70, 692, 75, 48, () => { this.logPage = (this.logPage + entries.length - 1) % entries.length; this.redraw(); });
      this.button('›', 320, 692, 75, 48, () => { this.logPage = (this.logPage + 1) % entries.length; this.redraw(); });
    }
    this.button('Close', 195, 692, 140, 48, () => { m.closeRedistLog(); closeRedistLog(); });
  }
  private drawConfirm(): void {
    const m = modal(); this.scrim(); this.rect(195, 422, 350, 360, 0x1a0c0c, 0.99, 0x9b5350);
    this.text('⚠', 195, 298, 32, '#d58f82');
    this.text(m.endGameConfirmIsMultiplayer ? 'End the Game?' : 'Quit to Menu?', 195, 348, 23, '#e6b4a8');
    this.text(m.endGameConfirmIsMultiplayer ? 'This ends the game for every player, not just you. This cannot be undone.' : 'Are you sure you want to quit? Your progress in this session will be lost.', 195, 422, 15, PALE, 290);
    this.button('Cancel', 110, 538, 135, 54, () => { m.onEndGameCancel(); closeEndGameConfirm(); }, undefined, true, 16);
    this.button(m.endGameConfirmIsMultiplayer ? 'End for Everyone' : 'Quit', 280, 538, 135, 54, m.onEndGameConfirm, undefined, true, 15);
  }
  private showToast(message: string): void {
    this.toast = message; this.redraw();
    this.time.delayedCall(2200, () => { if (this.toast === message) { this.toast = ''; this.redraw(); } });
  }
  private drawVictory(): void {
    const m = modal();
    // The victory scene draws the deity art behind this text; keep it visible.
    this.text(m.victoryTeamHeadline, 195, 63, 30, PALE);
    this.text(`After ${m.victoryTrickNumber} tricks`, 195, 98, 12, PALE);
    m.victoryIdentities.forEach((identity, i) => this.text(`${identity.label} — ${identity.godDisplayName}`, 195, 634 + i * 23, 13, PALE));
    this.button('Back to Menu', 195, 781, 280, 54, m.onVictoryBackToMenu);
  }
  private drawGameEnded(): void {
    const m = modal(); this.scrim(); this.frame('Game Ended');
    this.text(`The game has been ended by ${m.gameEndedQuitterLabel}.`, 195, 377, 18);
    this.button('Back to Menu', 195, 682, 280, 60, m.onGameEndedBackToMenu);
  }
  private drawTutorialBar(): void {
    const t = tutorial();
    t.scenes.forEach((marker, i) => {
      const x = 34 + i * 45; this.rect(x, 28, 34, 34, marker.status === 'current' ? 0x695529 : 0x1b2022);
      this.text(marker.status === 'completed' ? '✓' : String(marker.sceneNumber), x, 28, 14, marker.status === 'locked' ? '#6b7472' : PALE, 28);
      if (marker.status !== 'locked') this.track(this.add.zone(x, 28, 34, 34).setInteractive().on('pointerup', () => t.onSelectScene(marker.sceneNumber)));
    });
    this.button('Quit', 342, 28, 67, 35, t.onQuit, undefined, true, 13);
  }
}


