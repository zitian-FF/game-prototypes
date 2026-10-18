import Phaser from 'phaser';
import { PIXEL_RATIO, mix } from 'dig-kit';
import { LEVELS, type Kind, MODEL_INFO, type ModelId, type NodeRef, SLOTS, SLOT_COLS, type SlotId, type WordId } from '../game/content';
import { Game, type GameEvent } from '../game/game';
import { type BatchResult, estimate, nodeCost, skillOf } from '../game/sim';
import { type Intent, IntentBus, bindDesktopKeys, bindNetworkPointer, bindTap } from '../input/intents';
import { HEIGHT, WIDTH } from '../pixelRatio';
import { tune } from '../tune';
import { VERSION_STAMP } from '../version.generated';

// Landscape layout, 1280x720 logical. Top bar, then three columns:
// left = the task and its goals, centre = the square blueprint, right = inspector, words, Run.
const FONT = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const C = {
  bg: 0x07080b,
  panel: 0x0d0f14,
  raised: 0x13161d,
  line: 0x20242e,
  text: 0xeef1f7,
  dim: 0x8b93a5,
  faint: 0x555d70,
  gold: 0xe3c27a,
  good: 0x66e0a3,
  bad: 0xff7a7a,
  wire: 0xcfd6e6,
  grid: 0x6f8cff,
};
const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

const TOP_H = 64;
const BODY_Y = 76;
const BODY_B = 708;
const LX = 16;
const LW = 280;
const BX = 310;
const BS = 632;
const RX = 956;
const RW = 308;

const COL_X = [BX + 116, BX + 316, BX + 516];
const ROW_Y = [BODY_Y + 186, BODY_Y + 316, BODY_Y + 446];
const IN_BOX = { x: BX + BS / 2, y: BODY_Y + 52, w: 224, h: 46 };
const OUT_BOX = { x: BX + BS / 2, y: BODY_Y + BS - 52, w: 224, h: 46 };
const NODE_W = 176;
const NODE_H = 86;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export class GameScene extends Phaser.Scene {
  private bus = new IntentBus<Intent>();
  private game_!: Game;
  private ui!: Phaser.GameObjects.Container;
  private fx!: Phaser.GameObjects.Container;
  private rubberGfx!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer: Phaser.Time.TimerEvent | null = null;
  private deliveredText!: Phaser.GameObjects.Text;
  private dirty = true;
  private targets: Record<string, { x: number; y: number }> = {};

  constructor() {
    super('game');
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setZoom(PIXEL_RATIO);
    cam.centerOn(WIDTH / 2, HEIGHT / 2);
    this.game_ = new Game();
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, C.bg).setDepth(-10);

    this.add.text(5, 3, VERSION_STAMP, { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', resolution: PIXEL_RATIO }).setAlpha(0.28).setDepth(250);
    this.ui = this.add.container(0, 0).setDepth(10);
    this.fx = this.add.container(0, 0).setDepth(30);
    this.rubberGfx = this.add.graphics().setDepth(31);
    this.toastText = this.txt(BX + BS / 2, BODY_Y + 14, '', 12, hex(C.bad), true).setOrigin(0.5, 0).setDepth(32).setAlpha(0);
    this.deliveredText = this.txt(BX + BS / 2, BODY_Y + BS - 18, '', 12, hex(C.good), true).setOrigin(0.5, 0).setDepth(32).setAlpha(0);

    this.bus.on((i) => this.game_.handle(i));
    this.game_.on((e) => this.onGame(e));
    bindDesktopKeys(this, this.bus);
    bindNetworkPointer(
      this,
      this.bus,
      (x, y) => this.locate(x, y),
      (ref) => ref === 'in' || (ref !== 'out' && !!this.game_.cfgOf(ref)),
      (x, y) => x >= BX && x <= BX + BS && y >= BODY_Y && y <= BODY_Y + BS && !this.overlayOpen(),
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
  }

  private overlayOpen(): boolean {
    return this.game_.running || !!this.game_.result;
  }

  private onGame(e: GameEvent): void {
    if (e.type === 'changed') this.dirty = true;
    else if (e.type === 'toast') this.say(e.text, e.bad);
    else this.playRun(e.result);
  }

  private say(text: string, bad = true): void {
    this.toastText.setText(text).setColor(bad ? hex(C.bad) : hex(C.good)).setAlpha(1);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(2600, () => this.toastText.setAlpha(0));
  }

  // ------------------------------------------------------------ geometry

  private box(ref: NodeRef): Box {
    if (ref === 'in') return IN_BOX;
    if (ref === 'out') return OUT_BOX;
    const i = SLOTS.indexOf(ref);
    return { x: COL_X[i % SLOT_COLS], y: ROW_Y[Math.floor(i / SLOT_COLS)], w: NODE_W, h: NODE_H };
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
    g.lineStyle(2, 0xffffff, 0.85);
    g.lineBetween(b.x, b.y + b.h / 2, x, y);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(x, y, 5);
  }

  private modelColor(ref: NodeRef): number {
    const cfg = this.game_.cfgOf(ref);
    return cfg ? MODEL_INFO[cfg.model].color : C.wire;
  }

  private kindOf(ref: NodeRef): Kind {
    return ref === 'in' ? this.game_.level.inKind : (this.game_.cfgOf(ref)?.out ?? 'text');
  }

  private curve(a: NodeRef, b: NodeRef): Phaser.Curves.CubicBezier {
    const A = this.box(a);
    const B = this.box(b);
    const x1 = A.x;
    const y1 = A.y + A.h / 2;
    const x2 = B.x;
    const y2 = B.y - B.h / 2 - 7;
    const k = Math.max(30, (y2 - y1) * 0.5);
    return new Phaser.Curves.CubicBezier(new Phaser.Math.Vector2(x1, y1), new Phaser.Math.Vector2(x1, y1 + k), new Phaser.Math.Vector2(x2, y2 - k), new Phaser.Math.Vector2(x2, y2));
  }

  // ------------------------------------------------------------ drawing helpers

  private txt(x: number, y: number, s: string, size: number, color: string, bold = false, spacing = 0): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color, letterSpacing: spacing, resolution: PIXEL_RATIO });
  }

  private put<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.ui.add(obj);
    return obj;
  }

  private gfx(): Phaser.GameObjects.Graphics {
    return this.put(this.add.graphics());
  }

  /** Small uppercase section label. */
  private label(x: number, y: number, s: string, color = C.faint): Phaser.GameObjects.Text {
    return this.put(this.txt(x, y, s.toUpperCase(), 9, hex(color), true, 1.6));
  }

  private card(x: number, y: number, w: number, h: number): void {
    const g = this.gfx();
    g.fillStyle(C.panel, 1);
    g.fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(1, C.line, 1);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 12);
    g.lineStyle(1, 0xffffff, 0.05);
    g.lineBetween(x + 12, y + 1.5, x + w - 12, y + 1.5);
  }

  private pill(x: number, y: number, s: string, color: number, fill = 0x000000, textColor = color, size = 10): number {
    const t = this.put(this.txt(0, 0, s, size, hex(textColor), true, 0.6));
    const w = Math.ceil(t.width) + 16;
    const h = size + 10;
    const g = this.gfx();
    g.fillStyle(fill, fill === 0x000000 ? 0 : 1);
    if (fill !== 0x000000) g.fillRoundedRect(x, y, w, h, h / 2);
    g.lineStyle(1, color, 0.85);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
    this.ui.bringToTop(t);
    t.setPosition(x + 8, y + 4.5);
    return w;
  }

  private kindBadge(x: number, y: number, kind: Kind): number {
    return this.pill(x, y, kind.toUpperCase(), C.dim, 0x000000, C.dim, 9);
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

  private stars(cx: number, cy: number, got: number, r: number, gap = 2.5): void {
    const g = this.gfx();
    for (let i = 0; i < 3; i++) {
      g.fillStyle(i < got ? C.gold : 0x262a35, 1);
      this.star(g, cx + (i - 1) * (r * gap), cy, r);
    }
  }

  /** Invisible hit area with a hover highlight; emits an intent on press. */
  private hot(key: string | null, x: number, y: number, w: number, h: number, intent: Intent, radius = 10): void {
    const hov = this.gfx().setVisible(false);
    hov.fillStyle(0xffffff, 0.07);
    hov.fillRoundedRect(x, y, w, h, radius);
    const hit = this.put(this.add.rectangle(x + w / 2, y + h / 2, w, h, 0xffffff, 0.001));
    bindTap(hit, this.bus, intent);
    hit.on('pointerover', () => hov.setVisible(true));
    hit.on('pointerout', () => hov.setVisible(false));
    if (key) this.targets[key] = { x: x + w / 2, y: y + h / 2 };
  }

  private button(key: string, x: number, y: number, w: number, h: number, label: string, sub: string | null, kind: BtnKind, enabled: boolean, intent: Intent, size = 14): void {
    const g = this.gfx();
    const primary = kind === 'primary' && enabled;
    const edge = kind === 'danger' ? C.bad : primary ? C.gold : enabled ? 0x3a4152 : C.line;
    const fill = primary ? C.gold : kind === 'danger' ? mix(C.raised, C.bad, 0.12) : kind === 'ghost' ? C.panel : C.raised;
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1, edge, 1);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 10);
    if (primary) {
      g.fillStyle(0xffffff, 0.22);
      g.fillRoundedRect(x + 2, y + 2, w - 4, h * 0.38, 8);
    }
    const tc = primary ? hex(0x14110a) : kind === 'danger' ? hex(C.bad) : enabled ? hex(C.text) : hex(C.faint);
    const t = this.put(this.txt(x + w / 2, y + (sub ? h * 0.36 : h / 2), label, size, tc, true, kind === 'primary' ? 1 : 0.2)).setOrigin(0.5);
    if (sub) this.put(this.txt(x + w / 2, y + h * 0.72, sub, 10.5, primary ? hex(0x4a3f20) : hex(C.dim))).setOrigin(0.5);
    void t;
    if (enabled) this.hot(key, x, y, w, h, intent);
    else this.targets[key] = { x: x + w / 2, y: y + h / 2 };
  }

  private rateBar(x: number, y: number, w: number, name: string, rate: number): void {
    this.put(this.txt(x, y - 1, name, 12, hex(C.text)));
    const g = this.gfx();
    const bx = x + 100;
    const bw = w - 150;
    g.fillStyle(0x1b1f29, 1);
    g.fillRoundedRect(bx, y + 3, bw, 8, 4);
    g.fillStyle(rate >= 0.8 ? C.good : rate >= 0.55 ? C.gold : C.bad, 1);
    g.fillRoundedRect(bx, y + 3, Math.max(4, bw * rate), 8, 4);
    this.put(this.txt(x + w, y - 1, `${Math.round(rate * 100)}%`, 12, hex(C.text), true)).setOrigin(1, 0);
  }

  // ------------------------------------------------------------ rebuild

  private rebuild(): void {
    this.ui.destroy(true);
    this.ui = this.add.container(0, 0).setDepth(10);
    this.targets = {};
    this.drawTop();
    this.drawLeft();
    this.drawBlueprint();
    this.drawRight();
    if (this.game_.result && !this.game_.running) this.drawResult(this.game_.result);
  }

  // ------------------------------------------------------------ top bar

  private drawTop(): void {
    const g = this.game_;
    const lv = g.level;
    const est = estimate(g.layout);
    const bar = this.gfx();
    bar.fillStyle(C.panel, 1);
    bar.fillRect(0, 0, WIDTH, TOP_H);
    bar.lineStyle(1, C.line, 1);
    bar.lineBetween(0, TOP_H - 0.5, WIDTH, TOP_H - 0.5);

    this.put(this.txt(24, 17, 'agents.io', 21, hex(C.text), true, -0.3));
    this.put(this.txt(25, 43, 'TOKENMAXXING', 8.5, hex(C.faint), true, 2.2));
    bar.lineStyle(1, C.line, 1);
    bar.lineBetween(196, 14, 196, TOP_H - 14);

    // Level switcher
    const nav = (key: string, x: number, glyph: string, idx: number) => {
      const ok = idx >= 0 && idx < LEVELS.length && idx <= g.unlocked;
      const bg = this.gfx();
      bg.fillStyle(ok ? C.raised : C.panel, 1);
      bg.fillRoundedRect(x, 18, 28, 28, 8);
      bg.lineStyle(1, ok ? 0x3a4152 : C.line, 1);
      bg.strokeRoundedRect(x + 0.5, 18.5, 27, 27, 8);
      this.put(this.txt(x + 14, 32, glyph, 16, hex(ok ? C.text : C.faint), true)).setOrigin(0.5);
      if (ok) this.hot(key, x, 18, 28, 28, { type: 'level', index: idx }, 8);
    };
    nav('nav<', 214, '<', g.levelIdx - 1);
    this.label(256, 13, `Level ${g.levelIdx + 1} of ${LEVELS.length}`);
    this.put(this.txt(256, 27, lv.title, 17, hex(C.text), true));
    nav('nav>', 434, '>', g.levelIdx + 1);
    const pips = this.gfx();
    LEVELS.forEach((_, i) => {
      const cx = 520 + i * 20;
      if (i === g.levelIdx) {
        pips.fillStyle(C.gold, 1);
        pips.fillCircle(cx, 32, 5);
      } else {
        pips.lineStyle(1.5, i <= g.unlocked ? C.dim : C.line, 1);
        pips.strokeCircle(cx, 32, 4.5);
      }
    });

    // Resource gauges against the goals
    const goals = lv.goals;
    const metric = (x: number, name: string, value: number | null, unit: string, goal: number) => {
      const ok = value !== null && value <= goal;
      this.label(x, 10, name);
      const v = this.put(this.txt(x, 21, value === null ? '-' : String(value), 22, hex(value === null ? C.faint : ok ? C.good : C.bad), true));
      this.put(this.txt(x + v.width + 6, 31, `${unit}   goal <= ${goal}`, 10.5, hex(C.dim)));
      const gg = this.gfx();
      const w = 170;
      gg.fillStyle(0x1b1f29, 1);
      gg.fillRoundedRect(x, 52, w, 3, 1.5);
      if (value !== null) {
        gg.fillStyle(ok ? C.good : C.bad, 1);
        gg.fillRoundedRect(x, 52, Math.max(3, Math.min(w, (w * value) / (goal * 1.5))), 3, 1.5);
      }
      gg.fillStyle(C.text, 0.9);
      gg.fillRect(x + w / 1.5 - 0.5, 49, 1.5, 9);
    };
    metric(714, 'Tokens per task', est.valid ? est.costPerTask : null, 'tok', goals.cost);
    metric(900, 'Time per task', est.valid ? est.time : null, 's', goals.time);
    this.label(1086, 10, 'Best result');
    this.stars(1086 + 33, 36, g.best[lv.id]?.stars ?? 0, 10, 2.3);
    this.put(this.txt(1086 + 78, 31, g.best[lv.id] ? `${Math.round(g.best[lv.id].successRate * 100)}% delivered` : 'not played', 10.5, hex(C.dim)));
  }

  // ------------------------------------------------------------ left: task, goals, last run

  private drawLeft(): void {
    const g = this.game_;
    const lv = g.level;
    const est = estimate(g.layout);
    const best = g.best[lv.id];
    const x0 = LX + 16;
    const iw = LW - 32;

    this.card(LX, BODY_Y, LW, 224);
    this.label(x0, BODY_Y + 14, 'Task');
    this.put(this.txt(x0, BODY_Y + 30, lv.title, 20, hex(C.text), true));
    const tip = this.put(this.txt(x0, BODY_Y + 58, lv.hint, 11, hex(C.gold)));
    tip.setWordWrapWidth(iw).setAlpha(0.85);
    this.label(x0, BODY_Y + 102, 'Task flow');
    const inW = this.kindBadge(x0, BODY_Y + 118, lv.inKind);
    const ag = this.gfx();
    ag.lineStyle(1.5, C.faint, 1);
    ag.lineBetween(x0 + inW + 8, BODY_Y + 129, x0 + inW + 40, BODY_Y + 129);
    ag.fillStyle(C.faint, 1);
    ag.fillTriangle(x0 + inW + 40, BODY_Y + 125, x0 + inW + 40, BODY_Y + 133, x0 + inW + 46, BODY_Y + 129);
    this.kindBadge(x0 + inW + 54, BODY_Y + 118, lv.outKind);
    this.label(x0, BODY_Y + 152, 'Result must carry');
    let cx = x0;
    let cy = BODY_Y + 170;
    for (const w of lv.needs) {
      const t = this.txt(0, 0, w, 11, '#000', true, 0.6);
      const pw = Math.ceil(t.width) + 18;
      t.destroy();
      if (cx + pw > x0 + iw) {
        cx = x0;
        cy += 28;
      }
      cx += this.pill(cx, cy, w, C.gold, mix(C.panel, C.gold, 0.1), C.text, 11) + 6;
    }

    // Goals
    const gy = BODY_Y + 236;
    this.card(LX, gy, LW, 176);
    this.label(x0, gy + 14, 'Goals');
    const last = g.lastRuns[lv.id];
    const rows: { n: number; text: string; now: string; ok: boolean | null }[] = [
      { n: 1, text: `${Math.round(lv.goals.success * 100)}% delivered`, now: last ? `${Math.round(last.successRate * 100)}% last run` : 'run to test', ok: last ? last.successRate >= lv.goals.success : null },
      { n: 2, text: `<= ${lv.goals.cost} tok per task`, now: est.valid ? `${est.costPerTask} now` : '-', ok: est.valid ? est.costPerTask <= lv.goals.cost : null },
      { n: 3, text: `<= ${lv.goals.time} s per task`, now: est.valid ? `${est.time} s now` : '-', ok: est.valid ? est.time <= lv.goals.time : null },
    ];
    rows.forEach((r, i) => {
      const y = gy + 36 + i * 44;
      const earned = (best?.stars ?? 0) >= r.n;
      const sg = this.gfx();
      for (let s = 0; s < r.n; s++) {
        sg.fillStyle(earned ? C.gold : 0x2c313e, 1);
        this.star(sg, x0 + 6 + s * 12, y + 8, 5);
      }
      this.put(this.txt(x0 + 44, y, r.text, 12.5, hex(C.text), true));
      this.put(this.txt(x0 + 44, y + 18, r.now, 10.5, hex(r.ok === null ? C.faint : r.ok ? C.good : C.bad)));
    });

    // Last run
    const ly = gy + 188;
    this.card(LX, ly, LW, BODY_B - ly);
    this.label(x0, ly + 14, 'Last run');
    if (!last) {
      const t = this.put(this.txt(x0, ly + 40, 'No runs yet.\nBuild a network, then press Run.', 11.5, hex(C.dim)));
      t.setLineSpacing(4);
    } else {
      this.put(this.txt(x0, ly + 32, `${last.delivered}/${last.tasks.length}`, 26, hex(last.successRate >= lv.goals.success ? C.good : C.bad), true));
      this.put(this.txt(x0 + 72, ly + 44, 'delivered', 11.5, hex(C.dim)));
      this.stars(LX + LW - 56, ly + 46, last.stars, 8);
      this.label(x0, ly + 84, 'Required words landed');
      lv.needs.forEach((w, i) => this.rateBar(x0, ly + 104 + i * 22, iw, w, last.wordRates[w] ?? 0));
    }
  }

  // ------------------------------------------------------------ blueprint

  private drawBlueprint(): void {
    const g = this.game_;
    const layout = g.layout;
    const est = estimate(layout);
    const bg = this.gfx();
    bg.fillStyle(0x090b10, 1);
    bg.fillRoundedRect(BX, BODY_Y, BS, BS, 14);
    const cells = 20;
    const step = BS / cells;
    for (let i = 1; i < cells; i++) {
      const major = i % 5 === 0;
      bg.lineStyle(1, C.grid, major ? 0.1 : 0.04);
      bg.lineBetween(BX + i * step, BODY_Y + 8, BX + i * step, BODY_Y + BS - 8);
      bg.lineBetween(BX + 8, BODY_Y + i * step, BX + BS - 8, BODY_Y + i * step);
    }
    bg.lineStyle(1, C.line, 1);
    bg.strokeRoundedRect(BX + 0.5, BODY_Y + 0.5, BS - 1, BS - 1, 14);
    const m = 12;
    const len = 14;
    bg.lineStyle(1.5, C.faint, 0.9);
    for (const [cx, cy, sx, sy] of [
      [BX + m, BODY_Y + m, 1, 1],
      [BX + BS - m, BODY_Y + m, -1, 1],
      [BX + m, BODY_Y + BS - m, 1, -1],
      [BX + BS - m, BODY_Y + BS - m, -1, -1],
    ] as const) {
      bg.lineBetween(cx, cy, cx + sx * len, cy);
      bg.lineBetween(cx, cy, cx, cy + sy * len);
    }
    this.label(BX + 26, BODY_Y + 24, 'Blueprint');
    this.put(this.txt(BX + BS - 26, BODY_Y + 24, 'drag from one node to another to wire', 9.5, hex(C.faint))).setOrigin(1, 0);

    // Model colour legend
    g.level.models.forEach((id, i) => {
      const y = BODY_Y + 52 + i * 18;
      const dot = this.gfx();
      dot.fillStyle(MODEL_INFO[id].color, 1);
      dot.fillCircle(BX + 32, y + 6, 4);
      this.put(this.txt(BX + 44, y, MODEL_INFO[id].label, 11, hex(C.dim)));
    });

    // Empty slots first, then wires, then agents on top
    for (const ref of SLOTS.filter((r) => !g.cfgOf(r))) this.drawNode(ref, false);
    const wires = this.gfx();
    for (const [a, b] of layout.edges) {
      const live = est.active.has(a) && est.active.has(b);
      const color = this.modelColor(a);
      const pts = this.curve(a, b).getPoints(48);
      this.stroke(wires, pts, color, live ? 0.16 : 0.05, 9, false);
      this.stroke(wires, pts, color, live ? 1 : 0.32, 2.5, this.kindOf(a) === 'image');
      const e = pts[pts.length - 1];
      wires.fillStyle(color, live ? 1 : 0.32);
      wires.fillTriangle(e.x - 6, e.y - 9, e.x + 6, e.y - 9, e.x, e.y + 1);
    }
    for (const ref of ['in', 'out', ...SLOTS.filter((r) => g.cfgOf(r))] as NodeRef[]) this.drawNode(ref, est.active.has(ref));

    this.button('clear', BX + BS - 26 - 76, BODY_Y + BS - 26 - 28, 76, 28, 'Clear', null, 'ghost', true, { type: 'clear' }, 11.5);
    // Legend for wire styles
    const lg = this.gfx();
    lg.lineStyle(2, C.dim, 1);
    lg.lineBetween(BX + 32, BODY_Y + BS - 52, BX + 54, BODY_Y + BS - 52);
    this.put(this.txt(BX + 62, BODY_Y + BS - 59, 'text', 10, hex(C.dim)));
    this.stroke(lg, [new Phaser.Math.Vector2(BX + 32, BODY_Y + BS - 34), new Phaser.Math.Vector2(BX + 54, BODY_Y + BS - 34)], C.dim, 1, 2, true);
    this.put(this.txt(BX + 62, BODY_Y + BS - 41, 'image (dashed)', 10, hex(C.dim)));
  }

  private stroke(g: Phaser.GameObjects.Graphics, pts: Phaser.Math.Vector2[], color: number, alpha: number, width: number, dashed: boolean): void {
    g.lineStyle(width, color, alpha);
    if (!dashed) {
      g.strokePoints(pts, false, false);
      return;
    }
    let draw = true;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (draw) g.lineBetween(a.x, a.y, b.x, b.y);
      acc += Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (acc >= (draw ? 9 : 6)) {
        acc = 0;
        draw = !draw;
      }
    }
  }

  private drawNode(ref: NodeRef, active: boolean): void {
    const g = this.game_;
    const b = this.box(ref);
    const left = b.x - b.w / 2;
    const top = b.y - b.h / 2;
    const gr = this.gfx();
    const selected = g.selected === ref;
    this.targets[ref] = { x: b.x, y: b.y };

    if (ref === 'in' || ref === 'out') {
      const kind = ref === 'in' ? g.level.inKind : g.level.outKind;
      if (selected) {
        gr.lineStyle(6, 0xffffff, 0.12);
        gr.strokeRoundedRect(left - 3, top - 3, b.w + 6, b.h + 6, 17);
      }
      gr.fillStyle(C.raised, 1);
      gr.fillRoundedRect(left, top, b.w, b.h, 14);
      gr.lineStyle(selected ? 2 : 1, selected ? 0xffffff : 0x3a4152, 1);
      gr.strokeRoundedRect(left + 0.5, top + 0.5, b.w - 1, b.h - 1, 14);
      this.put(this.txt(left + 18, b.y - 7, ref === 'in' ? 'INPUT' : 'DELIVER', 13, hex(C.text), true, 1.4));
      this.kindBadge(left + b.w - 18 - 50, b.y - 10, kind);
      return;
    }

    const cfg = g.cfgOf(ref);
    if (!cfg) {
      gr.fillStyle(0x0c0e13, 0.9);
      gr.fillRoundedRect(left, top, b.w, b.h, 14);
      gr.lineStyle(selected ? 2 : 1, selected ? 0xffffff : 0x2b303c, 1);
      gr.strokeRoundedRect(left + 0.5, top + 0.5, b.w - 1, b.h - 1, 14);
      this.put(this.txt(b.x, b.y, '+', 26, hex(selected ? C.text : C.faint))).setOrigin(0.5);
      return;
    }

    const info = MODEL_INFO[cfg.model];
    const alpha = active ? 1 : 0.55;
    if (selected) {
      gr.lineStyle(8, info.color, 0.16);
      gr.strokeRoundedRect(left - 3, top - 3, b.w + 6, b.h + 6, 18);
    }
    gr.fillStyle(mix(C.raised, info.color, 0.13), 1);
    gr.fillRoundedRect(left, top, b.w, b.h, 14);
    gr.fillStyle(info.color, active ? 1 : 0.55);
    gr.fillRoundedRect(left, top + 12, 4, b.h - 24, 2);
    gr.lineStyle(selected ? 2.5 : 1.5, selected ? mix(info.color, 0xffffff, 0.35) : info.color, active ? 0.95 : 0.4);
    gr.strokeRoundedRect(left + 0.5, top + 0.5, b.w - 1, b.h - 1, 14);

    this.put(this.txt(left + 16, top + 9, info.label, 15, hex(info.color), true)).setAlpha(alpha);
    this.put(this.txt(left + 16, top + 29, active ? `${nodeCost(cfg)} tok   ${tune.models[cfg.model].latency} s` : 'not on a path', 10, hex(C.dim))).setAlpha(alpha);
    const kw = cfg.out.length * 6.6 + 16;
    this.put(this.pillText(left + b.w - 12 - kw, top + 9, cfg.out.toUpperCase(), kw, info.color, alpha));

    // Word pills, wrapped
    let px = left + 16;
    let py = top + 48;
    if (!cfg.words.length) this.put(this.txt(px, py + 3, 'no words yet', 10, hex(C.faint))).setAlpha(alpha);
    for (const w of cfg.words) {
      const t = this.txt(0, 0, w, 10, '#000', true, 0.4);
      const pw = Math.ceil(t.width) + 14;
      t.destroy();
      if (px + pw > left + b.w - 12) {
        px = left + 16;
        py += 19;
      }
      const pg = this.gfx();
      pg.fillStyle(mix(C.panel, info.color, 0.28), alpha);
      pg.fillRoundedRect(px, py, pw, 17, 8.5);
      this.put(this.txt(px + 7, py + 3, w, 10, hex(C.text), true, 0.4)).setAlpha(alpha);
      px += pw + 5;
    }
  }

  private pillText(x: number, y: number, s: string, w: number, color: number, alpha: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.lineStyle(1, color, 0.7 * alpha);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, 15, 7.5);
    c.add(g);
    c.add(this.txt(x + w / 2, y + 8, s, 8.5, hex(color), true, 0.8).setOrigin(0.5).setAlpha(alpha));
    return c;
  }

  // ------------------------------------------------------------ right: inspector, words, run

  private drawRight(): void {
    const g = this.game_;
    const ix = RX + 16;
    const iw = RW - 32;
    const IH = 360;
    this.card(RX, BODY_Y, RW, IH);
    const sel = g.selected;

    if (!sel) {
      this.label(ix, BODY_Y + 14, 'Inspector');
      const tips: [string, string][] = [
        ['Add an agent', 'Click an empty slot in the blueprint.'],
        ['Give it words', 'Select an agent, then click words below.'],
        ['Wire it up', 'Drag from INPUT to an agent, then on to DELIVER.'],
        ['Mind the types', 'A node only accepts what its model can read.'],
      ];
      tips.forEach(([h, b], i) => {
        const y = BODY_Y + 44 + i * 70;
        const dot = this.gfx();
        dot.fillStyle(C.gold, 1);
        dot.fillCircle(ix + 4, y + 8, 3);
        this.put(this.txt(ix + 18, y, h, 13, hex(C.text), true));
        this.put(this.txt(ix + 18, y + 20, b, 11.5, hex(C.dim))).setWordWrapWidth(iw - 20);
      });
    } else if (sel === 'in' || sel === 'out') {
      const lv = g.level;
      this.label(ix, BODY_Y + 14, 'Inspector');
      this.put(this.txt(ix, BODY_Y + 34, sel === 'in' ? 'INPUT' : 'DELIVER', 19, hex(C.text), true, 1));
      const body =
        sel === 'in'
          ? `Tasks arrive as ${lv.inKind}.\n\nDrag from here to an agent whose model can read ${lv.inKind}.`
          : `A task counts as delivered when the result is ${lv.outKind} and carries ${lv.needs.join(' and ')}.\n\nDrag from an agent that outputs ${lv.outKind} to here.`;
      this.put(this.txt(ix, BODY_Y + 74, body, 12, hex(C.dim))).setWordWrapWidth(iw).setLineSpacing(3);
    } else {
      const cfg = g.cfgOf(sel);
      if (!cfg) this.drawPicker(sel as SlotId, ix, iw);
      else this.drawAgent(sel as SlotId, ix, iw);
    }

    // Word basket
    const wy = BODY_Y + IH + 10;
    this.card(RX, wy, RW, 182);
    this.label(ix, wy + 14, 'Word basket');
    this.put(this.txt(RX + RW - 16, wy + 13, 'click to give or take', 9.5, hex(C.faint))).setOrigin(1, 0);
    const cfg = sel ? g.cfgOf(sel) : null;
    g.level.basket.forEach((w, i) => {
      const x = ix + (i % 2) * 140;
      const y = wy + 38 + Math.floor(i / 2) * 54;
      this.chip(w, x, y, 134, 46, cfg ? cfg.words.includes(w) : false, cfg ? skillOf(cfg.model, w) : null, cfg ? MODEL_INFO[cfg.model].color : C.gold);
    });

    // Run
    const block = g.runBlock();
    const est = estimate(g.layout);
    const n = tune.run.batchSize;
    this.button('run', RX, BODY_B - 68, RW, 68, g.running ? 'RUNNING' : `RUN ${n} TASKS`, block && !g.running ? block : g.running ? null : `about ${g.runCost()} tokens, ${est.time} s per task`, 'primary', !block, { type: 'run' }, 17);
  }

  private chip(word: WordId, x: number, y: number, w: number, h: number, has: boolean, skill: number | null, accent: number): void {
    const needed = this.game_.level.needs.includes(word);
    const g = this.gfx();
    g.fillStyle(has ? mix(C.raised, accent, 0.22) : C.raised, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(has ? 1.5 : 1, has ? accent : C.line, 1);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 10);
    this.put(this.txt(x + 12, y + 8, word, 12.5, hex(needed ? C.text : C.dim), true));
    this.put(this.txt(x + 12, y + 27, `${tune.words[word].cost} tok${needed ? '  needed' : ''}`, 10, hex(needed ? C.gold : C.faint)));
    if (skill !== null) this.put(this.txt(x + w - 12, y + h / 2, `${skill}%`, 15, hex(skill >= 80 ? C.good : skill >= 55 ? C.gold : C.bad), true)).setOrigin(1, 0.5);
    this.hot(`word:${word}`, x, y, w, h, { type: 'word', word });
  }

  private drawPicker(slot: SlotId, ix: number, iw: number): void {
    this.label(ix, BODY_Y + 14, 'Choose an agent');
    this.game_.level.models.forEach((m, i) => {
      const info = MODEL_INFO[m];
      const t = tune.models[m];
      const y = BODY_Y + 36 + i * 63;
      const g = this.gfx();
      g.fillStyle(mix(C.raised, info.color, 0.1), 1);
      g.fillRoundedRect(ix, y, iw, 57, 11);
      g.fillStyle(info.color, 1);
      g.fillRoundedRect(ix, y + 10, 4, 37, 2);
      g.lineStyle(1, mix(C.line, info.color, 0.45), 1);
      g.strokeRoundedRect(ix + 0.5, y + 0.5, iw - 1, 56, 11);
      this.put(this.txt(ix + 16, y + 7, info.label, 14.5, hex(info.color), true));
      this.put(this.txt(ix + 16 + 78, y + 10, info.role, 10, hex(C.dim)));
      this.put(this.txt(ix + iw - 12, y + 9, `price ${t.price}   ${t.latency} s`, 10.5, hex(C.text), true)).setOrigin(1, 0);
      const best = this.game_.level.basket
        .map((w) => ({ w, s: skillOf(m, w) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 2)
        .filter((e) => e.s >= 50)
        .map((e) => `${e.w} ${e.s}`)
        .join(', ');
      this.put(this.txt(ix + 16, y + 28, `reads ${info.in.join('/')}  writes ${info.out.join('/')}`, 10, hex(C.dim)));
      this.put(this.txt(ix + 16, y + 42, `${t.slots} words   best: ${best || 'none here'}`, 10, hex(C.faint)));
      this.hot(`model:${m}`, ix, y, iw, 57, { type: 'place', slot, model: m as ModelId }, 11);
    });
  }

  private drawAgent(slot: SlotId, ix: number, iw: number): void {
    const cfg = this.game_.cfgOf(slot);
    if (!cfg) return;
    const info = MODEL_INFO[cfg.model];
    const t = tune.models[cfg.model];
    this.label(ix, BODY_Y + 14, 'Inspector');
    const dot = this.gfx();
    dot.fillStyle(info.color, 1);
    dot.fillCircle(ix + 7, BODY_Y + 46, 7);
    this.put(this.txt(ix + 22, BODY_Y + 33, info.label, 21, hex(info.color), true));
    this.put(this.txt(ix + 22, BODY_Y + 60, info.role, 11, hex(C.dim)));

    const stat = (y: number, name: string, valueText: string, ratio: number) => {
      this.put(this.txt(ix, y, name.toUpperCase(), 9, hex(C.faint), true, 1.4));
      const g = this.gfx();
      const bx = ix + 78;
      const bw = iw - 78 - 56;
      g.fillStyle(0x1b1f29, 1);
      g.fillRoundedRect(bx, y + 3, bw, 6, 3);
      g.fillStyle(info.color, 1);
      g.fillRoundedRect(bx, y + 3, Math.max(4, bw * Math.min(1, ratio)), 6, 3);
      this.put(this.txt(ix + iw, y - 1, valueText, 11.5, hex(C.text), true)).setOrigin(1, 0);
    };
    stat(BODY_Y + 92, 'Price', `${t.price} / unit`, t.price / 5);
    stat(BODY_Y + 114, 'Latency', `${t.latency} s`, t.latency / 4);
    stat(BODY_Y + 136, 'Error', `${Math.round(t.error * 100)}%`, t.error / 0.12);
    stat(BODY_Y + 158, 'Words', `${cfg.words.length} / ${t.slots}`, cfg.words.length / t.slots);

    this.label(ix, BODY_Y + 188, 'Reads');
    let bx = ix;
    for (const k of info.in) bx += this.kindBadge(bx, BODY_Y + 204, k) + 6;

    this.label(ix, BODY_Y + 238, 'Output');
    info.out.forEach((k, i) => {
      const w = 92;
      const x = ix + i * (w + 6);
      const y = BODY_Y + 254;
      const on = cfg.out === k;
      const g = this.gfx();
      g.fillStyle(on ? mix(C.raised, info.color, 0.3) : C.raised, 1);
      g.fillRoundedRect(x, y, w, 28, 9);
      g.lineStyle(on ? 1.5 : 1, on ? info.color : C.line, 1);
      g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, 27, 9);
      this.put(this.txt(x + w / 2, y + 14, k.toUpperCase(), 10.5, hex(on ? C.text : C.dim), true, 1)).setOrigin(0.5);
      if (!on) this.hot('cycleOut', x, y, w, 28, { type: 'cycleOut' }, 9);
    });
    this.put(this.txt(ix, BODY_Y + 304, `Costs ${nodeCost(cfg)} tokens per task.`, 11, hex(C.dim)));
    this.put(this.txt(ix, BODY_Y + 322, `Each extra word weakens the rest by ${Math.round(t.dilute * 100)}%.`, 11, hex(C.faint)));
    this.button('remove', ix + iw - 80, BODY_Y + 296, 80, 28, 'Remove', null, 'danger', true, { type: 'remove', slot }, 11.5);
  }

  // ------------------------------------------------------------ run animation

  private playRun(res: BatchResult): void {
    const secs = tune.anim.secondsPerLatency;
    const n = res.tasks.length;
    let delivered = 0;
    let fails = 0;
    this.deliveredText.setText(`Delivered 0/${n}`).setColor(hex(C.good)).setAlpha(1);
    let last = 0;
    const arrive = new Map<number, number>();
    res.tasks.forEach((task, ti) => {
      for (const [a, b] of res.edges) {
        const start = ti * tune.anim.taskStaggerSeconds + (res.finish[a] ?? 0) * secs;
        const curve = this.curve(a, b);
        const p0 = curve.getPoint(0);
        const color = this.modelColor(a);
        const dot = this.add.circle(p0.x, p0.y, tune.anim.dotRadius, color, 1).setAlpha(0);
        this.fx.add(dot);
        const end = start + tune.anim.edgeSeconds;
        this.tweens.addCounter({
          from: 0,
          to: 1,
          delay: start * 1000,
          duration: tune.anim.edgeSeconds * 1000,
          onStart: () => dot.setAlpha(1),
          onUpdate: (tw) => {
            const p = curve.getPoint(tw.getValue() ?? 0);
            dot.setPosition(p.x, p.y);
          },
          onComplete: () => {
            if (b === 'out') dot.setFillStyle(task.passed ? C.good : C.bad);
            this.tweens.add({ targets: dot, alpha: 0, scale: b === 'out' ? 2.6 : 1, duration: 200, onComplete: () => dot.destroy() });
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
        this.deliveredText.setText(`Delivered ${delivered}/${n}${fails ? `    missed ${fails}` : ''}`);
      });
    }
    this.time.delayedCall((last + tune.anim.resultDelaySeconds) * 1000, () => {
      this.deliveredText.setAlpha(0);
      this.game_.finishRun(res);
    });
  }

  // ------------------------------------------------------------ result

  private drawResult(res: BatchResult): void {
    const lv = this.game_.level;
    const dim = this.put(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.8).setDepth(40));
    dim.setInteractive();
    const pw = 680;
    const ph = 440;
    const px = (WIDTH - pw) / 2;
    const py = (HEIGHT - ph) / 2;
    const prev = this.ui;
    const layer = this.add.container(0, 0).setDepth(41);
    prev.add(layer);
    // Draw the modal into its own container so it sits above the dimmer.
    this.ui = layer;
    this.card(px, py, pw, ph);
    const g = lv.goals;
    this.put(this.txt(WIDTH / 2, py + 22, res.stars ? 'Batch complete' : 'Not there yet', 24, hex(C.text), true)).setOrigin(0.5, 0);
    this.stars(WIDTH / 2, py + 84, res.stars, 17, 2.6);
    const tiles: { name: string; value: string; unit: string; goal: string; ok: boolean }[] = [
      { name: 'Delivered', value: `${res.delivered}/${res.tasks.length}`, unit: `${Math.round(res.successRate * 100)}%`, goal: `goal ${Math.round(g.success * 100)}%`, ok: res.successRate >= g.success },
      { name: 'Tokens per task', value: String(res.costPerTask), unit: 'tok', goal: `goal <= ${g.cost}`, ok: res.costPerTask <= g.cost },
      { name: 'Time per task', value: String(res.time), unit: 's', goal: `goal <= ${g.time}`, ok: res.time <= g.time },
    ];
    tiles.forEach((t, i) => {
      const x = px + 28 + i * 212;
      const y = py + 126;
      const tg = this.gfx();
      tg.fillStyle(C.raised, 1);
      tg.fillRoundedRect(x, y, 200, 98, 12);
      tg.lineStyle(1, t.ok ? mix(C.line, C.good, 0.5) : mix(C.line, C.bad, 0.5), 1);
      tg.strokeRoundedRect(x + 0.5, y + 0.5, 199, 97, 12);
      this.label(x + 16, y + 14, t.name);
      const v = this.put(this.txt(x + 16, y + 32, t.value, 30, hex(t.ok ? C.good : C.bad), true));
      this.put(this.txt(x + 16 + v.width + 8, y + 49, t.unit, 12, hex(C.dim)));
      this.put(this.txt(x + 16, y + 74, t.goal, 10.5, hex(C.dim)));
    });
    this.label(px + 28, py + 246, 'Required words landed');
    lv.needs.forEach((w, i) => this.rateBar(px + 28, py + 268 + i * 24, pw - 56, w, res.wordRates[w] ?? 0));
    this.put(this.txt(WIDTH / 2, py + ph - 94, `Spent ${res.totalCost} tokens on this batch`, 11, hex(C.faint))).setOrigin(0.5);
    const hasNext = res.stars > 0 && this.game_.levelIdx < LEVELS.length - 1;
    const by = py + ph - 64;
    if (hasNext) {
      this.button('tweak', WIDTH / 2 - 156, by, 148, 44, 'Keep tweaking', null, 'secondary', true, { type: 'closeResult' }, 13);
      this.button('next', WIDTH / 2 + 8, by, 148, 44, 'Next level', null, 'primary', true, { type: 'level', index: this.game_.levelIdx + 1 }, 13);
    } else {
      this.button('tweak', WIDTH / 2 - 74, by, 148, 44, 'Keep tweaking', null, 'primary', true, { type: 'closeResult' }, 13);
    }
    this.ui = prev;
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
        running: this.game_.running,
        result: this.game_.result && { delivered: this.game_.result.delivered, stars: this.game_.result.stars, cost: this.game_.result.costPerTask, time: this.game_.result.time },
        block: this.game_.runBlock(),
      }),
      rect: () => this.game.canvas.getBoundingClientRect().toJSON(),
      size: () => ({ w: WIDTH, h: HEIGHT }),
    };
  }
}
