import Phaser from 'phaser';
import { Button, PIXEL_RATIO } from 'dig-kit';
import {
  KIND_COLOR,
  type Kind,
  LEVELS,
  MODEL_INFO,
  type ModelId,
  type NodeRef,
  SLOTS,
  SLOT_ROWS,
  type SlotId,
  type WordId,
} from '../game/content';
import { Game, type GameEvent } from '../game/game';
import { type BatchResult, estimate, nodeCost, skillOf } from '../game/sim';
import { type Intent, IntentBus, bindDesktopKeys, bindNetworkPointer, bindTap } from '../input/intents';
import { HEIGHT, WIDTH } from '../pixelRatio';
import { tune } from '../tune';
import { VERSION_STAMP } from '../version.generated';

const FONT = 'Arial, sans-serif';
const BG = 0x0e1119;
const PANEL = 0x181d2b;
const NET_TOP = 146;
const NET_BOTTOM = 505;
const COL_X = [108, 282];
const ROW_Y = [244, 322, 400];
const IN_POS = { x: 195, y: 176 };
const OUT_POS = { x: 195, y: 474 };
const SLOT_W = 150;
const SLOT_H = 56;
const END_W = 124;
const END_H = 34;
const INSPECT = { x: 16, y: 512, w: 358, h: 172 };

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');
const kindText = (k: Kind): string => k.toUpperCase();

export class GameScene extends Phaser.Scene {
  private bus = new IntentBus<Intent>();
  private game_!: Game;
  private ui!: Phaser.GameObjects.Container;
  private bar!: Phaser.GameObjects.Container;
  private fx!: Phaser.GameObjects.Container;
  private rubberGfx!: Phaser.GameObjects.Graphics;
  private walletText!: Phaser.GameObjects.Text;
  private walletGfx!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer: Phaser.Time.TimerEvent | null = null;
  private deliveredText!: Phaser.GameObjects.Text;
  private dirty = true;
  private barKey = '';
  private lastWallet = -1;
  private targets: Record<string, { x: number; y: number }> = {};

  constructor() {
    super('game');
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setZoom(PIXEL_RATIO);
    cam.centerOn(WIDTH / 2, HEIGHT / 2);
    this.game_ = new Game();
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, BG).setDepth(-10);

    this.add
      .text(5, 4, VERSION_STAMP, { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', resolution: PIXEL_RATIO })
      .setAlpha(0.28)
      .setDepth(250);
    this.ui = this.add.container(0, 0).setDepth(10);
    this.bar = this.add.container(0, 0).setDepth(9);
    this.fx = this.add.container(0, 0).setDepth(30);
    this.rubberGfx = this.add.graphics().setDepth(31);
    this.walletGfx = this.add.graphics().setDepth(9);
    this.walletText = this.txt(16, 112, '', 10, '#9fb0d0').setDepth(9);
    this.toastText = this.txt(WIDTH / 2, 497, '', 11, '#ff8f8f').setOrigin(0.5).setDepth(12).setAlpha(0);
    this.deliveredText = this.txt(WIDTH / 2, 497, '', 12, '#9dffb8').setOrigin(0.5).setDepth(12).setAlpha(0);

    this.bus.on((i) => this.game_.handle(i));
    this.game_.on((e) => this.onGame(e));
    bindDesktopKeys(this, this.bus);
    bindNetworkPointer(
      this,
      this.bus,
      (x, y) => this.locate(x, y),
      (ref) => ref === 'in' || (ref !== 'out' && !!this.game_.cfgOf(ref)),
      (x, y) => y >= NET_TOP && y <= NET_BOTTOM && !this.overlayOpen() && x >= 0,
      (from, x, y) => this.drawRubber(from, x, y),
    );
    window.addEventListener('pagehide', () => this.game_.save());
    this.game.events.on(Phaser.Core.Events.HIDDEN, () => this.game_.save());

    if (new URLSearchParams(location.search).get('test') === '1') this.installTestHook();
  }

  update(): void {
    if (this.dirty) {
      this.dirty = false;
      this.rebuild();
    }
    const wallet = Math.floor(this.game_.walletNow());
    if (wallet !== this.lastWallet) {
      this.lastWallet = wallet;
      this.drawWallet(wallet);
    }
    const key = this.runBarKey();
    if (key !== this.barKey) this.rebuildBar();
  }

  private overlayOpen(): boolean {
    return this.game_.running || !!this.game_.result;
  }

  // ------------------------------------------------------------ events

  private onGame(e: GameEvent): void {
    if (e.type === 'changed') this.dirty = true;
    else if (e.type === 'toast') this.say(e.text, e.bad);
    else this.playRun(e.result);
  }

  private say(text: string, bad = true): void {
    this.toastText.setText(text).setColor(bad ? '#ff8f8f' : '#9dffb8').setAlpha(1);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(2400, () => this.toastText.setAlpha(0));
  }

  // ------------------------------------------------------------ geometry

  private box(ref: NodeRef): Box {
    if (ref === 'in') return { ...IN_POS, w: END_W, h: END_H };
    if (ref === 'out') return { ...OUT_POS, w: END_W, h: END_H };
    const i = SLOTS.indexOf(ref);
    return { x: COL_X[i % 2], y: ROW_Y[Math.floor(i / 2)], w: SLOT_W, h: SLOT_H };
  }

  private locate(x: number, y: number): NodeRef | null {
    if (this.overlayOpen()) return null;
    for (const ref of ['in', 'out', ...SLOTS] as NodeRef[]) {
      const b = this.box(ref);
      if (Math.abs(x - b.x) <= b.w / 2 + 4 && Math.abs(y - b.y) <= b.h / 2 + 4) return ref;
    }
    return null;
  }

  private drawRubber(from: NodeRef | null, x: number, y: number): void {
    const g = this.rubberGfx;
    g.clear();
    if (!from) return;
    const b = this.box(from);
    g.lineStyle(3, 0xffffff, 0.8);
    g.lineBetween(b.x, b.y + b.h / 2, x, y);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(x, y, 5);
  }

  // ------------------------------------------------------------ helpers

  private txt(x: number, y: number, s: string, size: number, color: string, bold = false): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      resolution: PIXEL_RATIO,
    });
  }

  private put<T extends Phaser.GameObjects.GameObject>(parent: Phaser.GameObjects.Container, obj: T): T {
    parent.add(obj);
    return obj;
  }

  private gfx(parent: Phaser.GameObjects.Container): Phaser.GameObjects.Graphics {
    return this.put(parent, this.add.graphics());
  }

  private badge(parent: Phaser.GameObjects.Container, x: number, y: number, kind: Kind): void {
    const g = this.gfx(parent);
    g.fillStyle(KIND_COLOR[kind], 1);
    g.fillRoundedRect(x, y, 44, 16, 8);
    this.put(parent, this.txt(x + 22, y + 8, kindText(kind), 9, '#0e1119', true).setOrigin(0.5));
  }

  private star(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad));
    }
    g.fillPoints(pts, true);
  }

  private stars(parent: Phaser.GameObjects.Container, cx: number, cy: number, got: number, r = 9): void {
    const g = this.gfx(parent);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(i < got ? 0xffd75e : 0x333a4d, 1);
      this.star(g, cx + (i - 1) * (r * 2.4), cy, r);
    }
  }

  // ------------------------------------------------------------ rebuild

  private rebuild(): void {
    this.ui.destroy(true);
    this.ui = this.add.container(0, 0).setDepth(10);
    this.targets = {};
    this.drawHeader();
    this.drawNetwork();
    this.drawInspector();
    this.drawBasket();
    this.rebuildBar();
    if (this.game_.result && !this.game_.running) this.drawResult(this.game_.result);
  }

  private drawHeader(): void {
    const g = this.game_;
    const lv = g.level;
    const ui = this.ui;
    this.put(ui, this.txt(16, 14, `${g.levelIdx + 1}. ${lv.title}`, 17, '#ffffff', true));
    const best = g.best[lv.id];
    this.stars(ui, 262, 24, best?.stars ?? 0, 6);
    const nav = (x: number, label: string, idx: number) => {
      const ok = idx >= 0 && idx < LEVELS.length && idx <= g.unlocked;
      const b = new Button(this, x, 24, 34, 28, label, null, { fill: ok ? 0x2b3550 : 0x1c2130, edge: ok ? 0x6f9cff : 0x2b3550 }, () => this.bus.emit({ type: 'level', index: idx }), 16);
      ui.add(b.container);
      this.targets[`nav${label}`] = { x, y: 24 };
    };
    nav(328, '<', g.levelIdx - 1);
    nav(364, '>', g.levelIdx + 1);

    this.put(ui, this.txt(16, 50, 'IN', 10, '#8896b5', true));
    this.badge(ui, 32, 48, lv.inKind);
    this.put(ui, this.txt(84, 50, 'OUT', 10, '#8896b5', true));
    this.badge(ui, 112, 48, lv.outKind);
    this.put(ui, this.txt(170, 50, 'NEEDS', 10, '#8896b5', true));
    let x = 210;
    for (const w of lv.needs) {
      const wd = w.length * 6 + 14;
      const gr = this.gfx(ui);
      gr.fillStyle(0x3a2f66, 1);
      gr.fillRoundedRect(x, 47, wd, 18, 9);
      gr.lineStyle(1, 0xb69cff, 1);
      gr.strokeRoundedRect(x, 47, wd, 18, 9);
      this.put(ui, this.txt(x + wd / 2, 56, w, 10, '#e6dcff', true).setOrigin(0.5));
      x += wd + 5;
    }
    const goals = lv.goals;
    this.put(ui, this.txt(16, 76, `1 star: ${Math.round(goals.success * 100)}% delivered`, 11, '#c9d3ea'));
    this.put(ui, this.txt(150, 76, `2: <=${goals.cost} tok/task`, 11, '#c9d3ea'));
    this.put(ui, this.txt(262, 76, `3: <=${goals.time}s/task`, 11, '#c9d3ea'));
    this.put(ui, this.txt(16, 96, lv.hint, 11, '#ffd98a'));
  }

  private drawWallet(wallet: number): void {
    this.walletText.setText(`TOKENS ${wallet}/${tune.wallet.max}   refills +${tune.wallet.refillPerSec}/s, even while you are away`);
    const g = this.walletGfx;
    g.clear();
    g.fillStyle(0x232a3d, 1);
    g.fillRoundedRect(16, 130, 358, 6, 3);
    g.fillStyle(0x5fe0c0, 1);
    g.fillRoundedRect(16, 130, Math.max(6, 358 * (wallet / tune.wallet.max)), 6, 3);
  }

  private drawNetwork(): void {
    const g = this.game_;
    const ui = this.ui;
    const layout = g.layout;
    const est = estimate(layout);
    const gr = this.gfx(ui);
    gr.fillStyle(0x121724, 1);
    gr.fillRoundedRect(8, NET_TOP, WIDTH - 16, NET_BOTTOM - NET_TOP - 8, 14);

    const empty = SLOTS.filter((r) => !g.cfgOf(r));
    for (const ref of empty) this.drawNode(ref, false);
    const wires = this.gfx(ui);
    const kindFrom = (ref: NodeRef): Kind => (ref === 'in' ? g.level.inKind : (g.cfgOf(ref)?.out ?? 'text'));
    for (const [a, b] of layout.edges) {
      const A = this.box(a);
      const B = this.box(b);
      const live = est.active.has(a) && est.active.has(b);
      const kind = kindFrom(a);
      const x1 = A.x;
      const y1 = A.y + A.h / 2;
      const x2 = B.x;
      const y2 = B.y - B.h / 2;
      wires.lineStyle(3, KIND_COLOR[kind], live ? 1 : 0.3);
      wires.lineBetween(x1, y1, x2, y2 - 6);
      wires.fillStyle(KIND_COLOR[kind], live ? 1 : 0.3);
      wires.fillTriangle(x2 - 6, y2 - 8, x2 + 6, y2 - 8, x2, y2);
    }

    for (const ref of ['in', 'out', ...SLOTS.filter((r) => g.cfgOf(r))] as NodeRef[]) this.drawNode(ref, est.active.has(ref));
    this.put(ui, this.txt(16, NET_TOP + 8, 'NETWORK', 9, '#4d5b7c', true));
    const clear = new Button(this, 340, 474, 56, 26, 'Clear', null, { fill: 0x3a2a30, edge: 0xff6f91 }, () => this.bus.emit({ type: 'clear' }), 11);
    ui.add(clear.container);
    this.targets.clear = { x: 340, y: 474 };
  }

  private drawNode(ref: NodeRef, active: boolean): void {
    const g = this.game_;
    const ui = this.ui;
    const b = this.box(ref);
    const left = b.x - b.w / 2;
    const top = b.y - b.h / 2;
    const gr = this.gfx(ui);
    const selected = g.selected === ref;
    this.targets[ref] = { x: b.x, y: b.y };
    if (ref === 'in' || ref === 'out') {
      const kind = ref === 'in' ? g.level.inKind : g.level.outKind;
      gr.fillStyle(KIND_COLOR[kind], 1);
      gr.fillRoundedRect(left, top, b.w, b.h, 10);
      gr.lineStyle(selected ? 3 : 1, 0xffffff, selected ? 1 : 0.4);
      gr.strokeRoundedRect(left, top, b.w, b.h, 10);
      this.put(ui, this.txt(b.x, b.y, `${ref === 'in' ? 'INPUT' : 'DELIVER'}  ${kindText(kind)}`, 12, '#0e1119', true).setOrigin(0.5));
      return;
    }
    const cfg = g.cfgOf(ref);
    if (!cfg) {
      gr.lineStyle(selected ? 3 : 1.5, selected ? 0xffffff : 0x4d5b7c, 1);
      gr.strokeRoundedRect(left, top, b.w, b.h, 10);
      gr.fillStyle(0x1a2133, 1);
      gr.fillRoundedRect(left, top, b.w, b.h, 10);
      gr.strokeRoundedRect(left, top, b.w, b.h, 10);
      this.put(ui, this.txt(b.x, b.y, '+ agent', 12, '#6b7a9c').setOrigin(0.5));
      return;
    }
    const info = MODEL_INFO[cfg.model];
    gr.setAlpha(active ? 1 : 0.5);
    gr.fillStyle(info.color, 1);
    gr.fillRoundedRect(left, top, b.w, b.h, 10);
    gr.fillStyle(0xffffff, 0.12);
    gr.fillRoundedRect(left + 3, top + 3, b.w - 6, 16, 8);
    gr.lineStyle(selected ? 3 : 1.5, 0xffffff, selected ? 1 : 0.35);
    gr.strokeRoundedRect(left, top, b.w, b.h, 10);
    gr.fillStyle(KIND_COLOR[cfg.out], 1);
    gr.fillCircle(left + b.w - 12, top + 12, 5);
    const t = this.put(ui, this.txt(left + 10, top + 5, info.label, 13, '#ffffff', true));
    const words = this.put(ui, this.txt(left + 10, top + 24, cfg.words.length ? cfg.words.join(', ') : 'no words', 10, cfg.words.length ? '#e9eeff' : '#8d9ab8'));
    words.setWordWrapWidth(b.w - 20);
    const cost = this.put(ui, this.txt(left + 10, top + 39, `${nodeCost(cfg)} tok  ${tune.models[cfg.model].latency}s`, 9, '#cfd8f2'));
    for (const o of [t, words, cost]) o.setAlpha(active ? 1 : 0.55);
    if (!active) this.put(ui, this.txt(left + b.w - 10, top + 42, 'idle', 9, '#c9d3ea').setOrigin(1, 0.5));
  }

  // ------------------------------------------------------------ inspector

  private panel(): void {
    const gr = this.gfx(this.ui);
    gr.fillStyle(PANEL, 1);
    gr.fillRoundedRect(INSPECT.x, INSPECT.y, INSPECT.w, INSPECT.h, 12);
  }

  private drawInspector(): void {
    const g = this.game_;
    const ui = this.ui;
    this.panel();
    const x0 = INSPECT.x + 12;
    const sel = g.selected;
    if (!sel) {
      const lines = [
        'Tap an empty slot to add an agent.',
        'Drag from one node to another to wire them.',
        'Select an agent, then tap words to give it work.',
        'Wires are typed: a node only accepts what its model can read.',
      ];
      lines.forEach((l, i) => this.put(ui, this.txt(x0, INSPECT.y + 14 + i * 22, l, 12, i === 3 ? '#8896b5' : '#d6def2')));
      return;
    }
    if (sel === 'in' || sel === 'out') {
      const lv = g.level;
      this.put(ui, this.txt(x0, INSPECT.y + 12, sel === 'in' ? 'INPUT' : 'DELIVER', 15, '#ffffff', true));
      const body =
        sel === 'in'
          ? `Tasks arrive as ${lv.inKind}.\nDrag from here to an agent that can read ${lv.inKind}.`
          : `A task is delivered when the result is ${lv.outKind}\nand carries: ${lv.needs.join(', ')}.\nDrag from an agent that outputs ${lv.outKind} to here.`;
      this.put(ui, this.txt(x0, INSPECT.y + 40, body, 12, '#d6def2').setLineSpacing(4));
      return;
    }
    const cfg = g.cfgOf(sel);
    if (!cfg) {
      this.put(ui, this.txt(x0, INSPECT.y + 8, 'Pick an agent', 13, '#ffffff', true));
      g.level.models.forEach((m, i) => this.modelRow(sel, m, i));
      return;
    }
    const info = MODEL_INFO[cfg.model];
    const t = tune.models[cfg.model];
    this.put(ui, this.txt(x0, INSPECT.y + 10, info.label, 16, '#ffffff', true));
    this.put(ui, this.txt(x0 + 90, INSPECT.y + 14, `price ${t.price}   speed ${t.latency}s   error ${Math.round(t.error * 100)}%`, 11, '#aebbd8'));
    this.put(ui, this.txt(x0, INSPECT.y + 42, `Reads: ${info.in.join(', ')}`, 12, '#d6def2'));
    this.put(ui, this.txt(x0, INSPECT.y + 62, 'Outputs:', 12, '#d6def2'));
    const outs = info.out;
    const ob = new Button(this, x0 + 100, INSPECT.y + 70, 70, 26, cfg.out.toUpperCase(), null, { fill: KIND_COLOR[cfg.out] & 0x7f7f7f, edge: KIND_COLOR[cfg.out] }, () => this.bus.emit({ type: 'cycleOut' }), 12);
    ui.add(ob.container);
    this.targets.cycleOut = { x: x0 + 100, y: INSPECT.y + 70 };
    this.put(ui, this.txt(x0 + 146, INSPECT.y + 63, outs.length > 1 ? '(tap to switch)' : '(only option)', 10, '#7d8bac'));
    this.put(ui, this.txt(x0, INSPECT.y + 92, `Words ${cfg.words.length}/${t.slots}. Each extra word dilutes the rest by ${Math.round(t.dilute * 100)}%.`, 11, '#aebbd8'));
    this.put(ui, this.txt(x0, INSPECT.y + 110, `Costs ${nodeCost(cfg)} tok per task.`, 11, '#aebbd8'));
    this.put(ui, this.txt(x0, INSPECT.y + 128, 'Tap words below to give or take them.', 11, '#ffd98a'));
    const rm = new Button(this, INSPECT.x + INSPECT.w - 56, INSPECT.y + INSPECT.h - 26, 90, 30, 'Remove', null, { fill: 0x3a2a30, edge: 0xff6f91 }, () => this.bus.emit({ type: 'remove', slot: sel as SlotId }), 12);
    ui.add(rm.container);
    this.targets.remove = { x: INSPECT.x + INSPECT.w - 56, y: INSPECT.y + INSPECT.h - 26 };
  }

  private modelRow(slot: NodeRef, m: ModelId, i: number): void {
    const ui = this.ui;
    const info = MODEL_INFO[m];
    const t = tune.models[m];
    const rowH = 30;
    const y = INSPECT.y + 28 + i * rowH;
    const x = INSPECT.x + 6;
    const w = INSPECT.w - 12;
    const gr = this.gfx(ui);
    gr.fillStyle(info.color, 0.55);
    gr.fillRoundedRect(x, y, w, rowH - 3, 8);
    this.put(ui, this.txt(x + 8, y + 2, info.label, 13, '#ffffff', true));
    this.put(ui, this.txt(x + w - 8, y + 3, `price ${t.price}  speed ${t.latency}s  words ${t.slots}`, 10, '#e3e9fa').setOrigin(1, 0));
    const best = this.g_basket()
      .map((w2) => ({ w: w2, s: skillOf(m, w2) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 2)
      .filter((e) => e.s >= 50)
      .map((e) => `${e.w} ${e.s}`)
      .join(', ');
    const io = `${info.in.join('/')} > ${info.out.join('/')}`;
    this.put(ui, this.txt(x + 8, y + 16, `${io}   best: ${best || 'none here'}`, 9, '#d3dcf3'));
    const hit = this.put(ui, this.add.rectangle(x + w / 2, y + (rowH - 3) / 2, w, rowH - 3, 0xffffff, 0.001));
    bindTap(hit, this.bus, { type: 'place', slot: slot as SlotId, model: m });
    this.targets[`model:${m}`] = { x: x + w / 2, y: y + (rowH - 3) / 2 };
  }

  private g_basket(): WordId[] {
    return this.game_.level.basket;
  }

  // ------------------------------------------------------------ basket

  private drawBasket(): void {
    const g = this.game_;
    const ui = this.ui;
    this.put(ui, this.txt(16, 686, 'WORD BASKET', 9, '#6b7a9c', true));
    const cfg = g.selected ? g.cfgOf(g.selected) : null;
    const lv = g.level;
    lv.basket.forEach((w, i) => {
      const cx = 73 + (i % 3) * 122;
      const cy = 716 + Math.floor(i / 3) * 38;
      const has = !!cfg?.words.includes(w);
      const gr = this.gfx(ui);
      gr.fillStyle(has ? 0x5a3fa8 : 0x232a3d, 1);
      gr.fillRoundedRect(cx - 57, cy - 17, 114, 34, 9);
      gr.lineStyle(has ? 2 : 1, has ? 0xd9c8ff : 0x3a4560, 1);
      gr.strokeRoundedRect(cx - 57, cy - 17, 114, 34, 9);
      const needed = lv.needs.includes(w);
      this.put(ui, this.txt(cx - 50, cy - 13, w, 12, needed ? '#e6dcff' : '#aeb9d4', true));
      this.put(ui, this.txt(cx - 50, cy + 3, `${tune.words[w].cost} tok`, 9, '#8d9ab8'));
      if (cfg) {
        const s = skillOf(cfg.model, w);
        this.put(ui, this.txt(cx + 50, cy, `${s}%`, 14, s >= 80 ? '#7dffb0' : s >= 55 ? '#ffd98a' : '#ff8f8f', true).setOrigin(1, 0.5));
      }
      const hit = this.put(ui, this.add.rectangle(cx, cy, 114, 34, 0xffffff, 0.001));
      bindTap(hit, this.bus, { type: 'word', word: w });
      this.targets[`word:${w}`] = { x: cx, y: cy };
    });
  }

  // ------------------------------------------------------------ run bar

  private runBarKey(): string {
    const g = this.game_;
    const est = estimate(g.layout);
    return `${g.runBlock()}|${est.costPerTask}|${est.time}|${est.valid}|${g.running}|${g.levelIdx}`;
  }

  private rebuildBar(): void {
    this.barKey = this.runBarKey();
    this.bar.destroy(true);
    this.bar = this.add.container(0, 0).setDepth(9);
    const g = this.game_;
    const est = estimate(g.layout);
    const block = g.runBlock();
    const lv = g.level;
    const cost = est.valid ? `${est.costPerTask} tok/task` : '-';
    const costOk = est.valid && est.costPerTask <= lv.goals.cost;
    const timeOk = est.valid && est.time <= lv.goals.time;
    this.put(this.bar, this.txt(16, 790, `Cost ${cost}`, 12, costOk ? '#7dffb0' : '#d6def2', true));
    this.put(this.bar, this.txt(16, 808, `Speed ${est.valid ? est.time + 's/task' : '-'}`, 12, timeOk ? '#7dffb0' : '#d6def2', true));
    if (block && !g.running) this.put(this.bar, this.txt(16, 825, block, 10, '#ff9f9f'));
    else this.put(this.bar, this.txt(16, 825, `Run = ${g.runCost()} tok for ${tune.run.batchSize} tasks`, 10, '#8896b5'));
    const ok = !block;
    const run = new Button(this, 288, 812, 172, 44, g.running ? 'Running...' : `RUN ${tune.run.batchSize} TASKS`, null, ok ? { fill: 0x2f9e6a, edge: 0x7dffb0 } : { fill: 0x2a3042, edge: 0x4a5572 }, () => this.bus.emit({ type: 'run' }), 15);
    this.bar.add(run.container);
    this.targets.run = { x: 288, y: 812 };
  }

  // ------------------------------------------------------------ run animation

  private playRun(res: BatchResult): void {
    const secs = tune.anim.secondsPerLatency;
    const n = res.tasks.length;
    let delivered = 0;
    let fails = 0;
    this.deliveredText.setText(`Delivered 0/${n}`).setColor('#9dffb8').setAlpha(1);
    let last = 0;
    const arrive = new Map<number, number>();
    res.tasks.forEach((task, ti) => {
      for (const [a, b] of res.edges) {
        const start = ti * tune.anim.taskStaggerSeconds + (res.finish[a] ?? 0) * secs;
        const A = this.box(a);
        const B = this.box(b);
        const dot = this.add.circle(A.x, A.y + A.h / 2, tune.anim.dotRadius, KIND_COLOR[this.edgeKind(a)], 1).setAlpha(0);
        this.fx.add(dot);
        const end = start + tune.anim.edgeSeconds;
        this.tweens.add({
          targets: dot,
          x: B.x,
          y: B.y - B.h / 2,
          delay: start * 1000,
          duration: tune.anim.edgeSeconds * 1000,
          onStart: () => dot.setAlpha(1),
          onComplete: () => {
            if (b === 'out') dot.setFillStyle(task.passed ? 0x7dffb0 : 0xff6f6f);
            this.tweens.add({ targets: dot, alpha: 0, scale: b === 'out' ? 2.4 : 1, duration: 180, onComplete: () => dot.destroy() });
          },
        });
        if (b === 'out') arrive.set(ti, Math.max(arrive.get(ti) ?? 0, end));
        last = Math.max(last, end);
      }
    });
    for (const [ti, t] of arrive) {
      this.time.delayedCall(t * 1000, () => {
        if (res.tasks[ti].passed) delivered++;
        else fails++;
        this.deliveredText.setText(`Delivered ${delivered}/${n}${fails ? `   missed ${fails}` : ''}`);
      });
    }
    this.time.delayedCall((last + tune.anim.resultDelaySeconds) * 1000, () => {
      this.deliveredText.setAlpha(0);
      this.game_.finishRun(res);
    });
  }

  private edgeKind(a: NodeRef): Kind {
    return a === 'in' ? this.game_.level.inKind : (this.game_.cfgOf(a)?.out ?? 'text');
  }

  // ------------------------------------------------------------ result

  private drawResult(res: BatchResult): void {
    const ui = this.ui;
    const lv = this.game_.level;
    const dim = this.put(ui, this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x05070c, 0.78).setDepth(40));
    dim.setInteractive();
    const px = 30;
    const py = 230;
    const pw = WIDTH - 60;
    const ph = 370;
    const gr = this.put(ui, this.add.graphics().setDepth(41));
    gr.fillStyle(PANEL, 1);
    gr.fillRoundedRect(px, py, pw, ph, 16);
    gr.lineStyle(2, res.stars ? 0xffd75e : 0x4a5572, 1);
    gr.strokeRoundedRect(px, py, pw, ph, 16);
    const cx = WIDTH / 2;
    const place = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth>(o: T): T => this.put(ui, o.setDepth(42));
    place(this.txt(cx, py + 28, res.stars ? 'Batch complete' : 'Not good enough yet', 18, '#ffffff', true).setOrigin(0.5));
    const sg = this.put(ui, this.add.graphics().setDepth(42));
    for (let i = 0; i < 3; i++) {
      sg.fillStyle(i < res.stars ? 0xffd75e : 0x333a4d, 1);
      this.star(sg, cx + (i - 1) * 40, py + 74, 17);
    }
    const g = lv.goals;
    const rows: [string, string, boolean][] = [
      ['Delivered', `${res.delivered}/${res.tasks.length}  (${Math.round(res.successRate * 100)}%, need ${Math.round(g.success * 100)}%)`, res.successRate >= g.success],
      ['Cost', `${res.costPerTask} tok/task  (goal <=${g.cost})`, res.costPerTask <= g.cost],
      ['Speed', `${res.time}s/task  (goal <=${g.time}s)`, res.time <= g.time],
    ];
    rows.forEach(([k, v, ok], i) => {
      const y = py + 118 + i * 30;
      place(this.txt(px + 20, y, k, 13, '#8896b5', true));
      place(this.txt(px + 100, y, v, 13, ok ? '#7dffb0' : '#ff9f9f', true));
    });
    place(this.txt(px + 20, py + 218, 'Required words that landed', 11, '#8896b5', true));
    lv.needs.forEach((w, i) => {
      const r = res.wordRates[w] ?? 0;
      const y = py + 238 + i * 20;
      place(this.txt(px + 20, y, w, 12, '#d6def2'));
      const bar = this.put(ui, this.add.graphics().setDepth(42));
      bar.fillStyle(0x232a3d, 1);
      bar.fillRoundedRect(px + 110, y + 3, 150, 8, 4);
      bar.fillStyle(r >= 0.8 ? 0x7dffb0 : r >= 0.55 ? 0xffd98a : 0xff8f8f, 1);
      bar.fillRoundedRect(px + 110, y + 3, Math.max(4, 150 * r), 8, 4);
      place(this.txt(px + pw - 20, y, `${Math.round(r * 100)}%`, 12, '#d6def2', true).setOrigin(1, 0));
    });
    place(this.txt(cx, py + ph - 70, `Spent ${res.totalCost} tokens`, 11, '#8896b5').setOrigin(0.5));
    const hasNext = res.stars > 0 && this.game_.levelIdx < LEVELS.length - 1;
    const b1 = new Button(this, hasNext ? cx - 70 : cx, py + ph - 34, 116, 40, 'Tweak', null, { fill: 0x2b3550, edge: 0x6f9cff }, () => this.bus.emit({ type: 'closeResult' }), 15);
    b1.container.setDepth(42);
    ui.add(b1.container);
    this.targets.tweak = { x: hasNext ? cx - 70 : cx, y: py + ph - 34 };
    if (hasNext) {
      const next = this.game_.levelIdx + 1;
      const b2 = new Button(this, cx + 70, py + ph - 34, 116, 40, 'Next level', null, { fill: 0x2f9e6a, edge: 0x7dffb0 }, () => this.bus.emit({ type: 'level', index: next }), 14);
      b2.container.setDepth(42);
      ui.add(b2.container);
      this.targets.next = { x: cx + 70, y: py + ph - 34 };
    }
  }

  // ------------------------------------------------------------ test hook

  private installTestHook(): void {
    (window as unknown as Record<string, unknown>).__agents = {
      /** Logical position of a named control (slot ids, 'in', 'out', 'word:x', 'model:x', 'run', ...). */
      at: (name: string) => this.targets[name] ?? null,
      send: (i: Intent) => this.bus.emit(i),
      state: () => ({
        level: this.game_.levelIdx,
        unlocked: this.game_.unlocked,
        selected: this.game_.selected,
        layout: this.game_.layout,
        best: this.game_.best,
        wallet: Math.floor(this.game_.walletNow()),
        running: this.game_.running,
        result: this.game_.result && { delivered: this.game_.result.delivered, stars: this.game_.result.stars, cost: this.game_.result.costPerTask, time: this.game_.result.time },
        block: this.game_.runBlock(),
      }),
      rect: () => this.game.canvas.getBoundingClientRect().toJSON(),
      size: () => ({ w: WIDTH, h: HEIGHT }),
    };
  }
}

export { hex, SLOT_ROWS };
