import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FighterView } from '../render/FighterView';
import { lookFor, mainLook } from '../render/characterLook';
import { createSimState } from '../sim/sim';
import { charTune, CHARACTER_IDS, CHARACTER_INFO, isCharId, type CharId } from '../sim/character';
import { loadCharPrefs, saveCharPrefs } from '../sim/charPrefs';
import { BOT_LEVELS, type BotLevel } from '../sim/bot';
import { applyTuneJson, snapshotTune, tune } from '../sim/tune';
import type { InputSource } from '../input/devices';
import type { LocalInputs } from '../input/localSetup';
import type { NetSession } from '../net/session';
import type { MatchData } from './LobbyScene';
import { artImage, backdrop } from '../render/art';

// Character select. UI chrome only: it never touches the sim except to hand
// the chosen ids to the fight scene.
//
// Two sides (left = fighter 0, right = fighter 1). Each picks a card and
// locks it; FIGHT! starts once both are locked.
//   vsai:    one player picks both (theirs, then the AI's).
//   localvs: each side is driven by its own input device.
//   online:  each phone picks only its own side; the opponent's pick shows
//            as READY until the host starts the match.

type Mode = 'vsai' | 'localvs' | 'online';

export interface CharSelectData {
  mode: Mode;
  inputs?: LocalInputs; // localvs
  session?: NetSession; // online
  localIdx?: 0 | 1; // online
  delay?: number; // online, host only (measured in the lobby)
}

const COLORS = [0x3a78d0, 0xd04a4a];

// Bar fill per stat: today's base tune sits at 80%.
function stats(id: CharId): [string, number][] {
  const c = charTune(id);
  const types = ['jab', 'cross', 'hook'] as const;
  const power = types.reduce((n, t) => n + c[t].damage, 0) / types.length;
  // Hand speed vs the unmodified base frames (Marco carries no frame deltas).
  let frames = 0;
  let base = 0;
  for (const t of types) {
    const p = tune.punches[t];
    base += p.startup + p.recovery;
    frames += Math.max(1, p.startup + c[t].startup) + Math.max(1, p.recovery + c[t].recovery);
  }
  return [
    ['HP', c.hp],
    ['STAMINA', c.stamina],
    ['STUN RESIST', c.stun],
    ['SPEED', c.speed],
    ['POWER', power],
    ['HAND SPEED', base / frames],
  ];
}

interface Side {
  sel: number;
  locked: boolean;
  label: string;
  src: InputSource | 'any' | 'remote';
}

export class CharSelectScene extends Phaser.Scene {
  private data0!: CharSelectData;
  private sides: Side[] = [];
  private active = 0;
  // Single Player: the bot's difficulty (shown under the AI label).
  private level: BotLevel = 'easy';
  private levelText: Phaser.GameObjects.Text | null = null;
  private g!: Phaser.GameObjects.Graphics;
  private views: FighterView[] = [];
  private texts: { name: Phaser.GameObjects.Text; style: Phaser.GameObjects.Text; status: Phaser.GameObjects.Text; stats: Phaser.GameObjects.Text[] }[] = [];
  private fightBtn!: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
  private remotePick: CharId | null = null;
  // Online: the opponent has reached this screen (heard from them here).
  private peerHere = false;
  private handedOff = false;
  private prevPad: boolean[] = [];
  private stickAt = [0, 0];

  constructor() {
    super('CharSelect');
  }

  create(data: CharSelectData): void {
    applyCameraPixelRatio(this);
    backdrop(this, 0.84);
    this.data0 = data;
    this.handedOff = false;
    this.remotePick = null;
    this.peerHere = false;
    this.active = 0;
    this.levelText = null;
    this.cardViews = [];
    this.views = [];
    this.texts = [];
    this.prevPad = [];
    const prefs = loadCharPrefs();
    const idx = (id: CharId) => CHARACTER_IDS.indexOf(id);
    this.level = prefs.level;
    if (data.mode === 'vsai') {
      this.sides = [
        { sel: idx(prefs.p1), locked: false, label: 'YOU', src: 'any' },
        { sel: idx(prefs.ai), locked: false, label: 'AI', src: 'any' },
      ];
    } else if (data.mode === 'localvs') {
      const inp = data.inputs!;
      this.sides = [
        { sel: idx(prefs.p1), locked: false, label: 'P1', src: inp.p1 },
        { sel: idx(prefs.p2), locked: false, label: 'P2', src: inp.p2 },
      ];
    } else {
      const me = data.localIdx ?? 0;
      this.sides = [0, 1].map((i) =>
        i === me
          ? { sel: idx(prefs.p1), locked: false, label: 'YOU', src: 'any' as const }
          : { sel: 0, locked: false, label: 'OPPONENT', src: 'remote' as const },
      );
      this.active = me;
      this.setupNet();
    }

    this.add
      .text(VIEW.cx, VIEW.top + 22, 'CHOOSE YOUR BOXER', { fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#ffd24a', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    this.buildCards();
    this.buildPanels();
    // Above the panel backgrounds, below the text.
    this.g = this.add.graphics().setDepth(5);
    this.buildButtons();
    this.bindKeys();
    this.events.once('shutdown', () => {
      if (data.mode === 'online' && !this.handedOff) data.session?.leave();
    });
    addVersionStamp(this);
  }

  // ---- layout -----------------------------------------------------------

  private cardPos(i: number): { x: number; y: number } {
    return { x: VIEW.cx + (i - 1) * 92, y: VIEW.cy - 10 };
  }

  private buildCards(): void {
    CHARACTER_IDS.forEach((id, i) => {
      const { x, y } = this.cardPos(i);
      const bg = this.add.rectangle(x, y, 80, 104, 0x1c212b, 1).setStrokeStyle(1, 0x5a6378).setInteractive();
      bg.on('pointerdown', () => this.tapCard(i));
      artImage(this, 'ui_panel', x, y, 80, 104);
      const portrait = artImage(this, `portrait_${id}`, x, y - 12, 55, 67, 10);
      this.add
        .text(x, y + 38, CHARACTER_INFO[id].name.split(' ')[0].toUpperCase(), { fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO })
        .setOrigin(0.5);
      const v = new FighterView(this, 0xb8bcc8);
      if (!portrait) this.cardViews.push({ v, id, x, y: y - 8 });
    });
  }
  private cardViews: { v: FighterView; id: CharId; x: number; y: number }[] = [];

  private panelX(side: number): number {
    return side === 0 ? VIEW.left + 112 : VIEW.right - 112;
  }

  private buildPanels(): void {
    const style = (size: number, color = '#ffffff') => ({ fontFamily: 'monospace', fontSize: `${size}px`, color, resolution: PIXEL_RATIO });
    for (let s = 0; s < 2; s++) {
      const x = this.panelX(s);
      const bg = this.add.rectangle(x, VIEW.cy + 8, 196, 300, 0x151922, 1).setInteractive();
      bg.on('pointerdown', () => this.tapPanel(s));
      artImage(this, 'ui_panel', x, VIEW.cy + 8, 196, 300);
      this.add.text(x, VIEW.cy - 130, this.sides[s].label, style(12, s === 0 ? '#7fb3ff' : '#ff8a7a')).setOrigin(0.5);
      if (this.data0.mode === 'vsai' && s === 1) {
        // Tap (or Up / Down, D-pad up / down) to change the bot's level.
        this.levelText = this.add
          .text(x, VIEW.cy - 114, '', { fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#ffd24a', backgroundColor: '#2a3140', padding: { x: 6, y: 2 }, resolution: PIXEL_RATIO })
          .setOrigin(0.5)
          .setDepth(6)
          .setInteractive()
          .on('pointerdown', () => this.cycleLevel(1));
      }
      this.views.push(new FighterView(this, COLORS[s]));
      const name = this.add.text(x, VIEW.cy - 44, '', style(13)).setOrigin(0.5).setFontStyle('bold').setDepth(6);
      const st = this.add.text(x, VIEW.cy - 34, '', style(9, '#aab0bc')).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(184).setDepth(6);
      const status = this.add.text(x, VIEW.cy + 146, '', style(11, '#ffd24a')).setOrigin(0.5);
      const labels: Phaser.GameObjects.Text[] = [];
      for (let r = 0; r < 6; r++) labels.push(this.add.text(x - 88, VIEW.cy + 14 + r * 20, '', style(9, '#cccccc')).setOrigin(0, 0.5).setDepth(6));
      this.texts.push({ name, style: st, status, stats: labels });
    }
  }

  private buildButtons(): void {
    const mk = (x: number, label: string, fill: number, onTap: () => void) => {
      const bg = this.add.rectangle(x, VIEW.cy + 92, 110, 30, fill, 1).setStrokeStyle(1, 0x7fb3ff).setInteractive();
      bg.on('pointerdown', onTap);
      const t = this.add.text(x, VIEW.cy + 92, label, { fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO }).setOrigin(0.5);
      return { bg, label: t };
    };
    mk(VIEW.cx - 62, 'BACK', 0x3a2a2a, () => this.back(-1, true));
    this.fightBtn = mk(VIEW.cx + 62, this.data0.mode === 'online' ? 'READY' : 'FIGHT!', 0x2a4a34, () => this.fightButton());
    this.add
      .text(VIEW.cx, VIEW.cy + 126, this.hint(), { fontFamily: 'monospace', fontSize: '9px', color: '#8a90a0', align: 'center', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
  }

  private hint(): string {
    if (this.data0.mode === 'localvs') return 'Keys: move left/right, punch or Enter to lock\nEsc / B / Numpad0 to change';
    if (this.data0.mode === 'online') return 'Pick a boxer, then READY · starts when both are ready';
    return 'Tap a boxer · or arrows + Enter / D-pad + A\nEsc / B to change';
  }

  // ---- input --------------------------------------------------------------

  private bindKeys(): void {
    const onKey = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
  }

  // Which side a key belongs to: in Local VS each keyboard half drives its
  // own side; otherwise every key drives the active side.
  private keySide(code: string): number {
    if (this.data0.mode !== 'localvs') return this.active;
    const kb2 = code.startsWith('Arrow') || code.startsWith('Numpad') || code === 'Enter' || code === 'Backspace';
    const want: InputSource = kb2 ? 'kb2' : 'kb1';
    const s = this.sides.findIndex((x) => x.src === want);
    // A side on touch / a pad still takes the other keyboard half's keys
    // only if no side owns that half.
    return s;
  }

  private onKey(e: KeyboardEvent): void {
    const c = e.code;
    const s = this.keySide(c);
    if (s < 0) return;
    if (c === 'ArrowUp' || c === 'KeyW') this.cycleLevel(-1);
    else if (c === 'ArrowDown' || c === 'KeyS') this.cycleLevel(1);
    else if (c === 'ArrowLeft' || c === 'KeyA') this.move(s, -1);
    else if (c === 'ArrowRight' || c === 'KeyD') this.move(s, 1);
    else if (['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'Numpad1'].includes(c)) this.confirm(s);
    else if (['Escape', 'Backspace', 'Numpad0'].includes(c)) this.back(s);
  }

  private pollPads(): void {
    let pads: (Gamepad | null)[] = [];
    try {
      pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    } catch {
      return;
    }
    pads.slice(0, 2).forEach((p, i) => {
      if (!p) return;
      let s = this.active;
      if (this.data0.mode === 'localvs') s = this.sides.findIndex((x) => x.src === (i === 0 ? 'pad1' : 'pad2'));
      if (s < 0) return;
      const edge = (n: number) => {
        const k = i * 32 + n;
        const now = !!p.buttons[n]?.pressed;
        const was = this.prevPad[k];
        this.prevPad[k] = now;
        return now && !was;
      };
      if (edge(12)) this.cycleLevel(-1);
      if (edge(13)) this.cycleLevel(1);
      if (edge(14)) this.move(s, -1);
      if (edge(15)) this.move(s, 1);
      const ax = p.axes[0] ?? 0;
      if (Math.abs(ax) > 0.6 && this.time.now - this.stickAt[i] > 220) {
        this.stickAt[i] = this.time.now;
        this.move(s, Math.sign(ax));
      }
      if (edge(0) || edge(2)) this.confirm(s);
      if (edge(1)) this.back(s);
      if (edge(9)) this.confirm(s);
    });
  }

  private cycleLevel(d: number): void {
    if (this.data0.mode !== 'vsai') return;
    const i = (BOT_LEVELS.indexOf(this.level) + d + BOT_LEVELS.length) % BOT_LEVELS.length;
    this.level = BOT_LEVELS[i];
    saveCharPrefs({ level: this.level });
  }

  private editable(s: number): boolean {
    return this.sides[s].src !== 'remote';
  }

  private move(s: number, d: number): void {
    const side = this.sides[s];
    if (!this.editable(s) || side.locked) return;
    side.sel = (side.sel + d + CHARACTER_IDS.length) % CHARACTER_IDS.length;
  }

  private confirm(s: number): void {
    if (this.bothLocked()) {
      this.fight();
      return;
    }
    const side = this.sides[s];
    if (!this.editable(s)) return;
    if (side.locked) {
      // vsai: confirming on a locked side moves on to the other one.
      if (this.data0.mode === 'vsai') this.active = 1 - s;
      return;
    }
    side.locked = true;
    if (this.data0.mode === 'vsai' && !this.sides[1 - s].locked) this.active = 1 - s;
    if (this.data0.mode === 'online') this.sendPick();
  }

  // Unlock the side's pick; with nothing to unlock, leave the screen.
  private back(s: number, button = false): void {
    if (button && s < 0) {
      // BACK button: unlock the most recent editable lock, else leave.
      const locked = [1, 0].find((i) => this.editable(i) && this.sides[i].locked);
      if (locked === undefined) return this.leave();
      return this.back(locked);
    }
    const side = this.sides[s];
    if (!this.editable(s)) return;
    if (side.locked) {
      side.locked = false;
      if (this.data0.mode === 'vsai') this.active = s;
      if (this.data0.mode === 'online') this.sendPick();
      return;
    }
    if (this.data0.mode === 'vsai' && s === 1 && this.sides[0].locked) {
      this.sides[0].locked = false;
      this.active = 0;
      return;
    }
    this.leave();
  }

  private tapCard(i: number): void {
    // Touch drives the active side (vsai / online) or a touch player in
    // Local VS (only P1 can be on touch).
    let s = this.active;
    if (this.data0.mode === 'localvs') s = this.sides.findIndex((x) => x.src === 'touch');
    if (s < 0 || !this.editable(s)) return;
    const side = this.sides[s];
    if (side.locked) side.locked = false;
    side.sel = i;
    // Online: tapping only selects (and un-readies); READY locks it in.
    if (this.data0.mode === 'online') {
      this.sendPick();
      return;
    }
    this.confirm(s);
  }

  private tapPanel(s: number): void {
    if (this.data0.mode !== 'vsai' || !this.editable(s)) return;
    this.active = s;
    this.sides[s].locked = false;
  }

  private bothLocked(): boolean {
    if (this.data0.mode === 'online') {
      const me = this.data0.localIdx ?? 0;
      return this.sides[me].locked && this.remotePick !== null;
    }
    return this.sides[0].locked && this.sides[1].locked;
  }

  private picks(): [CharId, CharId] {
    return [CHARACTER_IDS[this.sides[0].sel], CHARACTER_IDS[this.sides[1].sel]];
  }

  private leave(): void {
    this.scene.start('Menu');
  }

  // Online: the button is READY / UNREADY for your own pick.
  private fightButton(): void {
    if (this.data0.mode !== 'online') return this.fight();
    const me = this.data0.localIdx ?? 0;
    if (this.sides[me].locked) this.back(me);
    else this.confirm(me);
  }

  private fight(): void {
    if (!this.bothLocked()) return;
    const [a, b] = this.picks();
    if (this.data0.mode === 'vsai') {
      saveCharPrefs({ p1: a, ai: b, level: this.level });
      this.scene.start('VsAI', { chars: [a, b], level: this.level });
    } else if (this.data0.mode === 'localvs') {
      saveCharPrefs({ p1: a, p2: b });
      this.scene.start('LocalVs', { ...this.data0.inputs!, chars: [a, b] });
    } else if (this.data0.localIdx === 0) {
      this.hostStart();
    }
  }

  // ---- online -------------------------------------------------------------

  private setupNet(): void {
    const s = this.data0.session!;
    s.onCtl = (m) => {
      if (m.k === 'ping') s.send({ k: 'pong', t: m.t });
      if (m.k === 'pick') {
        this.peerHere = true;
        this.remotePick = isCharId(m.char) ? m.char : null;
        const other = 1 - (this.data0.localIdx ?? 0);
        this.sides[other].locked = this.remotePick !== null;
        if (this.remotePick) this.sides[other].sel = CHARACTER_IDS.indexOf(this.remotePick);
        if (this.data0.localIdx === 0 && this.bothLocked()) this.hostStart();
      }
      if (m.k === 'start' && this.data0.localIdx === 1) {
        const restore = snapshotTune();
        applyTuneJson(m.tune);
        this.handOff({ session: s, localIdx: 1, delay: m.delay, round: m.round, restoreTune: restore, chars: m.chars });
      }
    };
    s.onPeerLeft = () => this.scene.start('Menu', { message: 'Opponent left' });
    // Heartbeat: keep re-sending our status, so a message sent while the
    // other phone was still in the lobby (measuring ping) is never lost.
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.sendPick() });
    this.sendPick();
  }

  private sendPick(): void {
    const me = this.data0.localIdx ?? 0;
    const side = this.sides[me];
    this.data0.session?.send({ k: 'pick', char: side.locked ? CHARACTER_IDS[side.sel] : null });
    if (side.locked) saveCharPrefs({ p1: CHARACTER_IDS[side.sel] });
    if (!this.peerHere) return;
    if (me === 0 && this.bothLocked()) this.hostStart();
  }

  private hostStart(): void {
    if (this.handedOff) return;
    const s = this.data0.session!;
    const chars = this.picks();
    const delay = this.data0.delay ?? tune.net.inputDelayFrames;
    s.send({ k: 'start', round: 1, delay, tune: JSON.stringify(tune), chars });
    this.handOff({ session: s, localIdx: 0, delay, round: 1, chars });
  }

  private handOff(data: MatchData): void {
    this.handedOff = true;
    this.scene.start('Match', data);
  }

  // ---- draw ---------------------------------------------------------------

  update(time: number): void {
    this.pollPads();
    this.levelText?.setText(`< ${this.level.toUpperCase()} >`);
    const g = this.g;
    g.clear();
    // Each side wears its character's colour (alt colour on a mirror pick).
    const chars = this.picks();
    const col = [lookFor(chars, 0), lookFor(chars, 1)].map((l, i) => (this.sides[i].src === 'remote' && !this.bothLocked() ? COLORS[i] : l.color));
    for (let s = 0; s < 2; s++) {
      const l = lookFor(chars, s);
      this.views[s].setLook(l.color, l.scale, l.ponytail);
      g.lineStyle(2, col[s], 1);
      g.strokeRect(this.panelX(s) - 98, VIEW.cy + 8 - 150, 196, 300);
    }
    // Cards and the cursors on them.
    CHARACTER_IDS.forEach((_, i) => {
      const { x, y } = this.cardPos(i);
      for (let s = 0; s < 2; s++) {
        const side = this.sides[s];
        if (side.src === 'remote' && !side.locked) continue;
        if (side.sel !== i) continue;
        const hide = this.data0.mode === 'online' && side.src === 'remote';
        if (hide) continue;
        const focus = this.data0.mode === 'vsai' ? this.active === s : true;
        g.lineStyle(side.locked ? 4 : 2, col[s], side.locked || focus ? 1 : 0.45);
        const o = s === 0 ? 0 : 5;
        g.strokeRect(x - 40 - o, y - 52 - o, 80 + o * 2, 104 + o * 2);
        g.fillStyle(col[s], 1);
        g.fillTriangle(x - 8 + (s ? 10 : -10), y + 60 + o, x + (s ? 10 : -10), y + 54 + o, x + 8 + (s ? 10 : -10), y + 60 + o);
      }
    });
    for (const c of this.cardViews) {
      const l = mainLook(c.id);
      c.v.setLook(l.color, l.scale, l.ponytail);
      this.drawBoxer(c.v, c.id, c.x, c.y, 1, time);
    }

    for (let s = 0; s < 2; s++) {
      const side = this.sides[s];
      const t = this.texts[s];
      const x = this.panelX(s);
      const hidden = side.src === 'remote';
      const id = CHARACTER_IDS[side.sel];
      if (hidden) {
        this.views[s].clear();
        t.name.setText('');
        t.style.setText('');
        t.stats.forEach((l) => l.setText(''));
        t.status.setText(!this.peerHere ? 'waiting for opponent...' : side.locked ? 'READY' : 'picking...');
        continue;
      }
      // Active-side glow (vsai).
      if (this.data0.mode === 'vsai' && this.active === s && !this.bothLocked()) {
        g.lineStyle(3, col[s], 0.35 + 0.25 * Math.sin(time / 160));
        g.strokeRect(x - 102, VIEW.cy + 8 - 154, 204, 308);
      }
      this.drawBoxer(this.views[s], id, x, VIEW.cy - 76, s === 0 ? 1 : -1, time);
      const info = CHARACTER_INFO[id];
      t.name.setText(`${info.name}`);
      t.style.setText(`"${info.nick}"\n${info.style}`);
      t.status.setText(side.locked ? 'LOCKED IN' : '');
      stats(id).forEach(([label, v], r) => {
        t.stats[r].setText(label);
        const by = VIEW.cy + 14 + r * 20;
        const bx = x - 12;
        const w = 96;
        g.fillStyle(0x000000, 0.6);
        g.fillRect(bx, by - 4, w, 8);
        g.fillStyle(col[s], 1);
        g.fillRect(bx, by - 4, w * Math.min(1, 0.8 * v), 8);
        g.lineStyle(1, 0xffffff, 0.3);
        g.strokeRect(bx, by - 4, w, 8);
        // 80% (base) tick.
        g.lineStyle(1, 0xffffff, 0.5);
        g.lineBetween(bx + w * 0.8, by - 6, bx + w * 0.8, by + 6);
      });
    }
    if (this.data0.mode === 'online') {
      const me = this.sides[this.data0.localIdx ?? 0];
      this.fightBtn.label.setText(me.locked ? 'UNREADY' : 'READY');
      this.fightBtn.bg.setAlpha(1);
      this.fightBtn.label.setAlpha(1);
    } else {
      const ready = this.bothLocked();
      this.fightBtn.bg.setAlpha(ready ? 1 : 0.35);
      this.fightBtn.label.setAlpha(ready ? 1 : 0.35);
    }
  }

  // Idle preview: the in-game boxer, gently bobbing, facing the centre.
  private drawBoxer(v: FighterView, id: CharId, x: number, y: number, face: number, time: number): void {
    const f = createSimState({ timed: false, fighters: [{ char: id }, {}] }).fighters[0];
    f.x = x;
    f.y = y + Math.sin(time / 300) * 1.5;
    f.fx = face;
    f.fy = 0;
    v.draw(f, time, false);
  }
}
