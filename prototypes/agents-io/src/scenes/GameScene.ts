import Phaser from 'phaser';
import { PIXEL_RATIO, mix } from 'dig-kit';
import { AGENT_CELLS, BOARD_H, BOARD_W, CELL, COLS, ROWS, anchorAround, anchorNear, clamp } from '../game/board';
import { LEVELS, type Kind, MODEL_INFO, type ModelId, type NodeRef, type WordId } from '../game/content';
import { Game, type GameEvent } from '../game/game';
import { type BatchResult, canPlace, estimate, nodeCost, nodeRect, skillOf } from '../game/sim';
import { type BlueprintApi, type BoardHit, type Feedback, type Intent, IntentBus, bindBlueprintPointer, bindDesktopKeys, bindTap } from '../input/intents';
import { HEIGHT, WIDTH } from '../pixelRatio';
import { tune } from '../tune';
import { VERSION_STAMP } from '../version.generated';

// Landscape layout, 1280x720 logical. Top bar, then three columns:
// left = the task and its goals, centre = the square blueprint (a zoomable, snap-to-grid board),
// right = inspector, words, Run.
//
// Three cameras share the screen. The main camera draws the panels, the board camera draws the
// blueprint through a viewport you can zoom and pan, and the top camera draws controls over it.
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

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.2;
const TOOLBAR = { x: BX + BS - 16 - 176, y: BODY_Y + 12, w: 176, h: 28 };
const CLEAR_BTN = { x: BX + BS - 16 - 76, y: BODY_Y + BS - 16 - 28, w: 76, h: 28 };

type V2 = Phaser.Math.Vector2;
type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Path {
  pts: V2[];
  /** Cumulative length at each point. */
  len: number[];
}

export class GameScene extends Phaser.Scene {
  private bus = new IntentBus<Intent>();
  private game_!: Game;
  private camMain!: Phaser.Cameras.Scene2D.Camera;
  private camBoard!: Phaser.Cameras.Scene2D.Camera;
  private camTop!: Phaser.Cameras.Scene2D.Camera;
  /** Panels (main camera), the board (board camera), controls over the board (top camera). */
  private ui!: Phaser.GameObjects.Container;
  private board!: Phaser.GameObjects.Container;
  private top!: Phaser.GameObjects.Container;
  private cur!: Phaser.GameObjects.Container;
  private fx!: Phaser.GameObjects.Container;
  private draft!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer: Phaser.Time.TimerEvent | null = null;
  private deliveredText!: Phaser.GameObjects.Text;
  private zoomLabel: Phaser.GameObjects.Text | null = null;
  private view = { cx: BOARD_W / 2, cy: BOARD_H / 2, zoom: 0.7 };
  private fb: Feedback = null;
  private dirty = true;
  private targets: Record<string, { x: number; y: number }> = {};

  constructor() {
    super('game');
  }

  create(): void {
    const PR = PIXEL_RATIO;
    this.camMain = this.cameras.main;
    this.camMain.setZoom(PR).centerOn(WIDTH / 2, HEIGHT / 2);
    this.camBoard = this.cameras.add(BX * PR, BODY_Y * PR, BS * PR, BS * PR).setBackgroundColor(0x05060a);
    this.camTop = this.cameras.add(0, 0, WIDTH * PR, HEIGHT * PR);
    this.camTop.setZoom(PR).centerOn(WIDTH / 2, HEIGHT / 2);
    this.game_ = new Game();

    const bg = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, C.bg).setDepth(-10);
    const stamp = this.add.text(5, 3, VERSION_STAMP, { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', resolution: PR }).setAlpha(0.28).setDepth(250);
    for (const o of [bg, stamp]) this.mainOnly(o);

    this.ui = this.add.container(0, 0);
    this.board = this.add.container(0, 0);
    this.top = this.add.container(0, 0);
    this.cur = this.ui;
    this.fx = this.add.container(0, 0);
    this.draft = this.add.graphics();
    this.boardOnly(this.draft);
    this.toastText = this.txt(BX + BS / 2, BODY_Y + BS - 64, '', 12, hex(C.bad), true).setOrigin(0.5, 0).setAlpha(0);
    this.deliveredText = this.txt(BX + BS / 2, BODY_Y + BS - 38, '', 12, hex(C.good), true).setOrigin(0.5, 0).setAlpha(0);
    for (const o of [this.toastText, this.deliveredText]) this.topOnly(o);

    this.bus.on((i) => this.onIntent(i));
    this.game_.on((e) => this.onGame(e));
    bindDesktopKeys(this, this.bus);
    bindBlueprintPointer(this, this.bus, this.api());
    window.addEventListener('pagehide', () => this.game_.save());
    this.game.events.on(Phaser.Core.Events.HIDDEN, () => this.game_.save());

    this.fit();
    if (new URLSearchParams(location.search).get('test') === '1') this.installTestHook();
  }

  update(): void {
    if (this.dirty) {
      this.dirty = false;
      this.rebuild();
    }
  }

  // ------------------------------------------------------------ cameras and layers

  private mainOnly(o: Phaser.GameObjects.GameObject): void {
    this.camBoard.ignore(o);
    this.camTop.ignore(o);
  }

  private boardOnly(o: Phaser.GameObjects.GameObject): void {
    this.camMain.ignore(o);
    this.camTop.ignore(o);
  }

  private topOnly(o: Phaser.GameObjects.GameObject): void {
    this.camMain.ignore(o);
    this.camBoard.ignore(o);
  }

  private applyView(): void {
    this.camBoard.setZoom(PIXEL_RATIO * this.view.zoom);
    this.camBoard.centerOn(this.view.cx, this.view.cy);
    this.zoomLabel?.setText(`${Math.round(this.view.zoom * 100)}%`);
  }

  private toBoard(sx: number, sy: number): { x: number; y: number } {
    const v = this.view;
    return { x: v.cx + (sx - (BX + BS / 2)) / v.zoom, y: v.cy + (sy - (BODY_Y + BS / 2)) / v.zoom };
  }

  private toScreen(bx: number, by: number): { x: number; y: number } {
    const v = this.view;
    return { x: BX + BS / 2 + (bx - v.cx) * v.zoom, y: BODY_Y + BS / 2 + (by - v.cy) * v.zoom };
  }

  private clampView(): void {
    this.view.cx = clamp(this.view.cx, 0, BOARD_W);
    this.view.cy = clamp(this.view.cy, 0, BOARD_H);
  }

  private zoomAt(factor: number, sx: number, sy: number): void {
    const v = this.view;
    const before = this.toBoard(sx, sy);
    v.zoom = clamp(v.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    v.cx = before.x - (sx - (BX + BS / 2)) / v.zoom;
    v.cy = before.y - (sy - (BODY_Y + BS / 2)) / v.zoom;
    this.clampView();
    this.applyView();
  }

  /** Frame INPUT, DELIVER and every agent. */
  private fit(): void {
    const layout = this.game_.layout;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const ref of ['in', 'out', ...Object.keys(layout.nodes)]) {
      const r = nodeRect(layout, ref);
      x0 = Math.min(x0, r.x * CELL);
      y0 = Math.min(y0, r.y * CELL);
      x1 = Math.max(x1, (r.x + r.w) * CELL);
      y1 = Math.max(y1, (r.y + r.h) * CELL);
    }
    const m = 2 * CELL;
    this.view.zoom = clamp(Math.min(BS / (x1 - x0 + 2 * m), BS / (y1 - y0 + 2 * m)), 0.5, 1.3);
    this.view.cx = (x0 + x1) / 2;
    this.view.cy = (y0 + y1) / 2;
    this.clampView();
    this.applyView();
  }

  // ------------------------------------------------------------ intents and events

  private onIntent(i: Intent): void {
    switch (i.type) {
      case 'zoom':
        this.zoomAt(i.factor, i.sx, i.sy);
        return;
      case 'zoomStep':
        this.zoomAt(i.dir > 0 ? 1.25 : 0.8, BX + BS / 2, BODY_Y + BS / 2);
        return;
      case 'pan':
        this.view.cx -= i.dx / this.view.zoom;
        this.view.cy -= i.dy / this.view.zoom;
        this.clampView();
        this.applyView();
        return;
      case 'fit':
        this.fit();
        return;
      default:
        this.game_.handle(i);
    }
  }

  private overlayOpen(): boolean {
    return this.game_.running || !!this.game_.result;
  }

  private onGame(e: GameEvent): void {
    if (e.type === 'changed') this.dirty = true;
    else if (e.type === 'toast') this.say(e.text, e.bad);
    else if (e.type === 'level') this.fit();
    else this.playRun(e.result);
  }

  private say(text: string, bad = true): void {
    this.toastText.setText(text).setColor(bad ? hex(C.bad) : hex(C.good)).setAlpha(1);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(2600, () => this.toastText.setAlpha(0));
  }

  // ------------------------------------------------------------ board geometry

  private rectPx(ref: NodeRef): { x: number; y: number; w: number; h: number } {
    const r = nodeRect(this.game_.layout, ref);
    return { x: r.x * CELL, y: r.y * CELL, w: r.w * CELL, h: r.h * CELL };
  }

  private portOut(ref: NodeRef): V2 {
    const r = this.rectPx(ref);
    return new Phaser.Math.Vector2(r.x + r.w / 2, r.y + r.h);
  }

  private portIn(ref: NodeRef): V2 {
    const r = this.rectPx(ref);
    return new Phaser.Math.Vector2(r.x + r.w / 2, r.y);
  }

  private modelColor(ref: NodeRef): number {
    const cfg = this.game_.cfgOf(ref);
    return cfg ? MODEL_INFO[cfg.model].color : C.wire;
  }

  private kindOf(ref: NodeRef): Kind {
    return ref === 'in' ? this.game_.level.inKind : (this.game_.cfgOf(ref)?.out ?? 'text');
  }

  private nodeName(ref: NodeRef): string {
    return ref === 'in' ? 'INPUT' : ref === 'out' ? 'DELIVER' : MODEL_INFO[this.game_.cfgOf(ref)?.model ?? 'nano'].label;
  }

  /** Orthogonal route from an output port to an input port, corners on grid lines, then rounded. */
  private route(a: NodeRef, b: NodeRef): Path {
    const p = this.portOut(a);
    const q = this.portIn(b);
    const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
    const s = p.y + CELL;
    const t = q.y - CELL;
    let pts: V2[];
    if (p.x === q.x && q.y > p.y) pts = [p, q];
    else if (t >= s) {
      const ym = Math.round((s + t) / 2 / CELL) * CELL;
      pts = [p, V(p.x, ym), V(q.x, ym), q];
    } else {
      // Target is above or too close: leave the source downward, loop round the side, enter from above.
      const right = Math.max(p.x, q.x) + 6 * CELL;
      const xm = right <= BOARD_W - CELL ? right : Math.min(p.x, q.x) - 6 * CELL;
      pts = [p, V(p.x, s), V(xm, s), V(xm, t), V(q.x, t), q];
    }
    return this.smooth(pts, 10);
  }

  private smooth(pts: V2[], r: number): Path {
    const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
    const clean = pts.filter((pt, i) => i === 0 || Phaser.Math.Distance.Between(pt.x, pt.y, pts[i - 1].x, pts[i - 1].y) > 0.5);
    const out: V2[] = [clean[0]];
    for (let i = 1; i < clean.length - 1; i++) {
      const a = clean[i - 1];
      const b = clean[i];
      const c = clean[i + 1];
      const l1 = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const l2 = Phaser.Math.Distance.Between(b.x, b.y, c.x, c.y);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      const e1 = V(b.x - ((b.x - a.x) / l1) * rr, b.y - ((b.y - a.y) / l1) * rr);
      const e2 = V(b.x + ((c.x - b.x) / l2) * rr, b.y + ((c.y - b.y) / l2) * rr);
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const u = 1 - t;
        out.push(V(u * u * e1.x + 2 * u * t * b.x + t * t * e2.x, u * u * e1.y + 2 * u * t * b.y + t * t * e2.y));
      }
    }
    out.push(clean[clean.length - 1]);
    const len = [0];
    for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Phaser.Math.Distance.Between(out[i].x, out[i].y, out[i - 1].x, out[i - 1].y));
    return { pts: out, len };
  }

  private pointAt(path: Path, t: number): V2 {
    const total = path.len[path.len.length - 1];
    const d = clamp(t, 0, 1) * total;
    let i = 1;
    while (i < path.len.length - 1 && path.len[i] < d) i++;
    const seg = path.len[i] - path.len[i - 1] || 1;
    const k = (d - path.len[i - 1]) / seg;
    return new Phaser.Math.Vector2(Phaser.Math.Linear(path.pts[i - 1].x, path.pts[i].x, k), Phaser.Math.Linear(path.pts[i - 1].y, path.pts[i].y, k));
  }

  private hitBoard(bx: number, by: number): BoardHit {
    const z = this.view.zoom;
    const layout = this.game_.layout;
    const R = clamp(12 / z, 10, 24);
    const withPorts: NodeRef[] = ['in', ...Object.keys(layout.nodes)];
    for (const ref of withPorts) {
      const p = this.portOut(ref);
      if (Phaser.Math.Distance.Between(bx, by, p.x, p.y) <= R) return { kind: 'port', ref };
    }
    const order = [...Object.keys(layout.nodes).reverse(), 'in', 'out'];
    for (const ref of order) {
      const r = this.rectPx(ref);
      if (bx >= r.x && bx <= r.x + r.w && by >= r.y && by <= r.y + r.h) return { kind: 'node', ref };
    }
    const thr = clamp(7 / z, 5, 14);
    for (let i = 0; i < layout.edges.length; i++) {
      const pts = this.route(layout.edges[i][0], layout.edges[i][1]).pts;
      for (let k = 1; k < pts.length; k++) {
        if (this.segDist(bx, by, pts[k - 1], pts[k]) <= thr) return { kind: 'wire', index: i };
      }
    }
    const cx = Math.floor(bx / CELL);
    const cy = Math.floor(by / CELL);
    return { kind: 'empty', inBoard: cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS };
  }

  private segDist(px: number, py: number, a: V2, b: V2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : clamp(((px - a.x) * dx + (py - a.y) * dy) / l2, 0, 1);
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  private api(): BlueprintApi {
    return {
      over: (sx, sy) => {
        if (this.overlayOpen()) return false;
        if (sx < BX || sx > BX + BS || sy < BODY_Y || sy > BODY_Y + BS) return false;
        const inRect = (r: { x: number; y: number; w: number; h: number }) => sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 4 && sy <= r.y + r.h + 4;
        return !inRect(TOOLBAR) && !inRect(CLEAR_BTN);
      },
      toBoard: (sx, sy) => this.toBoard(sx, sy),
      hit: (bx, by) => this.hitBoard(bx, by),
      originOf: (ref) => {
        const r = this.rectPx(ref);
        return { x: r.x, y: r.y };
      },
      feedback: (f) => {
        this.fb = f;
        this.drawDraft();
      },
    };
  }

  // ------------------------------------------------------------ drawing helpers

  private txt(x: number, y: number, s: string, size: number, color: string, bold = false, spacing = 0, hi = false): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      letterSpacing: spacing,
      resolution: PIXEL_RATIO * (hi ? 2 : 1),
    });
  }

  private put<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.cur.add(obj);
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
    if (fill !== 0x000000) {
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x, y, w, h, h / 2);
    }
    g.lineStyle(1, color, 0.85);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
    this.cur.bringToTop(t);
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
      g.fillStyle(0xffffff, 0.18);
      g.fillRoundedRect(x + 2, y + 2, w - 4, h * 0.38, 8);
    }
    const tc = primary ? hex(0x14110a) : kind === 'danger' ? hex(C.bad) : enabled ? hex(C.text) : hex(C.faint);
    this.put(this.txt(x + w / 2, y + (sub ? h * 0.36 : h / 2), label, size, tc, true, kind === 'primary' ? 1 : 0.2)).setOrigin(0.5);
    if (sub) this.put(this.txt(x + w / 2, y + h * 0.72, sub, 10.5, primary ? hex(0x4a3f20) : hex(C.dim))).setOrigin(0.5);
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

  /** Dashed or solid polyline. */
  private stroke(g: Phaser.GameObjects.Graphics, pts: V2[], color: number, alpha: number, width: number, dashed: boolean): void {
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
      if (acc >= (draw ? 10 : 7)) {
        acc = 0;
        draw = !draw;
      }
    }
  }

  // ------------------------------------------------------------ rebuild

  private rebuild(): void {
    this.ui.destroy(true);
    this.board.destroy(true);
    this.top.destroy(true);
    this.ui = this.add.container(0, 0);
    this.board = this.add.container(0, 0);
    this.top = this.add.container(0, 0);
    this.targets = {};
    this.zoomLabel = null;

    this.cur = this.ui;
    this.drawTop();
    this.drawLeft();
    this.drawRight();
    this.cur = this.board;
    this.drawBoard();
    this.cur = this.top;
    this.drawOverlay();
    if (this.game_.result && !this.game_.running) this.drawResult(this.game_.result);

    // Camera ignore only flags the children a container has right now, so apply it last.
    this.camBoard.ignore(this.ui);
    this.camTop.ignore(this.ui);
    this.camMain.ignore(this.board);
    this.camTop.ignore(this.board);
    this.camMain.ignore(this.top);
    this.camBoard.ignore(this.top);
    this.fx.setDepth(5);
    this.applyView();
    this.drawDraft();
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

    const nav = (key: string, x: number, glyph: string, idx: number) => {
      const ok = idx >= 0 && idx < LEVELS.length && idx <= g.unlocked;
      const bgr = this.gfx();
      bgr.fillStyle(ok ? C.raised : C.panel, 1);
      bgr.fillRoundedRect(x, 18, 28, 28, 8);
      bgr.lineStyle(1, ok ? 0x3a4152 : C.line, 1);
      bgr.strokeRoundedRect(x + 0.5, 18.5, 27, 27, 8);
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

    const ly = gy + 188;
    this.card(LX, ly, LW, BODY_B - ly);
    this.label(x0, ly + 14, 'Last run');
    if (!last) {
      this.put(this.txt(x0, ly + 40, 'No runs yet.\nBuild a network, then press Run.', 11.5, hex(C.dim))).setLineSpacing(4);
    } else {
      this.put(this.txt(x0, ly + 32, `${last.delivered}/${last.tasks.length}`, 26, hex(last.successRate >= lv.goals.success ? C.good : C.bad), true));
      this.put(this.txt(x0 + 72, ly + 44, 'delivered', 11.5, hex(C.dim)));
      this.stars(LX + LW - 56, ly + 46, last.stars, 8);
      this.label(x0, ly + 84, 'Required words landed');
      lv.needs.forEach((w, i) => this.rateBar(x0, ly + 104 + i * 22, iw, w, last.wordRates[w] ?? 0));
    }
  }

  // ------------------------------------------------------------ blueprint (board camera)

  private drawBoard(): void {
    const g = this.game_;
    const layout = g.layout;
    const est = estimate(layout);

    const bg = this.gfx();
    bg.fillStyle(0x090b10, 1);
    bg.fillRect(0, 0, BOARD_W, BOARD_H);
    for (let i = 1; i < COLS; i++) {
      const major = i % 5 === 0;
      bg.lineStyle(1, C.grid, major ? 0.11 : 0.045);
      bg.lineBetween(i * CELL, 0, i * CELL, BOARD_H);
    }
    for (let j = 1; j < ROWS; j++) {
      const major = j % 5 === 0;
      bg.lineStyle(1, C.grid, major ? 0.11 : 0.045);
      bg.lineBetween(0, j * CELL, BOARD_W, j * CELL);
    }
    bg.lineStyle(2, 0x2b3142, 1);
    bg.strokeRect(0, 0, BOARD_W, BOARD_H);

    // Wires under the nodes
    const wires = this.gfx();
    layout.edges.forEach(([a, b], i) => {
      const live = est.active.has(a) && est.active.has(b);
      const sel = g.selectedWire === i;
      const color = this.modelColor(a);
      const path = this.route(a, b);
      const dashed = this.kindOf(a) === 'image';
      this.stroke(wires, path.pts, sel ? 0xffffff : color, sel ? 0.25 : live ? 0.16 : 0.05, 11, false);
      this.stroke(wires, path.pts, sel ? 0xffffff : color, live || sel ? 1 : 0.32, sel ? 3.5 : 2.5, dashed);
      const e = path.pts[path.pts.length - 1];
      wires.fillStyle(sel ? 0xffffff : color, live || sel ? 1 : 0.32);
      wires.fillTriangle(e.x - 6, e.y - 10, e.x + 6, e.y - 10, e.x, e.y);
    });

    // Chosen spot for a new agent
    if (g.pending) {
      const p = g.pending;
      const pg = this.gfx();
      const x = p.x * CELL;
      const y = p.y * CELL;
      const w = AGENT_CELLS.w * CELL;
      const h = AGENT_CELLS.h * CELL;
      pg.fillStyle(C.gold, 0.07);
      pg.fillRoundedRect(x, y, w, h, 14);
      this.stroke(
        pg,
        [new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2(x + w, y), new Phaser.Math.Vector2(x + w, y + h), new Phaser.Math.Vector2(x, y + h), new Phaser.Math.Vector2(x, y)],
        C.gold,
        0.9,
        1.5,
        true,
      );
      this.put(this.txt(x + w / 2, y + h / 2, 'pick an agent  >', 12, hex(C.gold), true, 0.4, true)).setOrigin(0.5);
    }

    for (const ref of ['in', 'out', ...Object.keys(layout.nodes)]) this.drawNode(ref, est.active.has(ref));
  }

  private drawNode(ref: NodeRef, active: boolean): void {
    const g = this.game_;
    const b = this.rectPx(ref);
    const gr = this.gfx();
    const selected = g.selected === ref;
    this.targets[ref] = { x: b.x + b.w / 2, y: b.y + b.h / 2 };

    if (ref === 'in' || ref === 'out') {
      const kind = ref === 'in' ? g.level.inKind : g.level.outKind;
      if (selected) {
        gr.lineStyle(7, 0xffffff, 0.12);
        gr.strokeRoundedRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 17);
      }
      gr.fillStyle(C.raised, 1);
      gr.fillRoundedRect(b.x, b.y, b.w, b.h, 14);
      gr.lineStyle(selected ? 2 : 1, selected ? 0xffffff : 0x3a4152, 1);
      gr.strokeRoundedRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 14);
      this.put(this.txt(b.x + 18, b.y + b.h / 2 - 8, ref === 'in' ? 'INPUT' : 'DELIVER', 13, hex(C.text), true, 1.4, true));
      this.badge(b.x + b.w - 18, b.y + b.h / 2 - 9, kind, C.dim, 1);
      if (ref === 'in') this.port(this.portOut('in'), 'out', kind, C.wire, 1);
      else this.port(this.portIn('out'), 'in', kind, C.wire, 1);
      return;
    }

    const cfg = g.cfgOf(ref);
    if (!cfg) return;
    const info = MODEL_INFO[cfg.model];
    const alpha = active ? 1 : 0.55;
    if (selected) {
      gr.lineStyle(9, info.color, 0.17);
      gr.strokeRoundedRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 18);
    }
    gr.fillStyle(mix(C.raised, info.color, 0.13), 1);
    gr.fillRoundedRect(b.x, b.y, b.w, b.h, 14);
    gr.fillStyle(info.color, active ? 1 : 0.55);
    gr.fillRoundedRect(b.x, b.y + 12, 4, b.h - 24, 2);
    gr.lineStyle(selected ? 2.5 : 1.5, selected ? mix(info.color, 0xffffff, 0.35) : info.color, active ? 0.95 : 0.4);
    gr.strokeRoundedRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 14);

    this.put(this.txt(b.x + 16, b.y + 9, info.label, 15, hex(info.color), true, 0, true)).setAlpha(alpha);
    this.put(this.txt(b.x + 16, b.y + 29, active ? `${nodeCost(cfg)} tok   ${tune.models[cfg.model].latency} s` : 'not on a path', 10, hex(C.dim), false, 0, true)).setAlpha(alpha);
    this.badge(b.x + b.w - 14, b.y + 12, cfg.out, info.color, alpha);

    let px = b.x + 16;
    let py = b.y + 52;
    if (!cfg.words.length) this.put(this.txt(px, py + 3, 'no words yet', 10, hex(C.faint), false, 0, true)).setAlpha(alpha);
    for (const w of cfg.words) {
      const t = this.txt(0, 0, w, 10, '#000', true, 0.4);
      const pw = Math.ceil(t.width) + 14;
      t.destroy();
      if (px + pw > b.x + b.w - 12) {
        px = b.x + 16;
        py += 19;
      }
      const pg = this.gfx();
      pg.fillStyle(mix(C.panel, info.color, 0.28), alpha);
      pg.fillRoundedRect(px, py, pw, 17, 8.5);
      this.put(this.txt(px + 7, py + 3, w, 10, hex(C.text), true, 0.4, true)).setAlpha(alpha);
      px += pw + 5;
    }
    this.port(this.portIn(ref), 'in', cfg.out, info.color, alpha);
    this.port(this.portOut(ref), 'out', cfg.out, info.color, alpha);
  }

  /** Outlined type badge, right-aligned at x. */
  private badge(xRight: number, y: number, kind: Kind, color: number, alpha: number): void {
    const t = this.put(this.txt(0, 0, kind.toUpperCase(), 8.5, hex(color), true, 0.8, true)).setAlpha(alpha);
    const w = Math.ceil(t.width) + 14;
    const g = this.gfx();
    g.lineStyle(1, color, 0.7 * alpha);
    g.strokeRoundedRect(xRight - w + 0.5, y + 0.5, w - 1, 17, 8.5);
    this.cur.bringToTop(t);
    t.setPosition(xRight - w + 7, y + 4);
  }

  /** A connector: output ports are filled (circle for text, diamond for image), input ports are rings. */
  private port(at: V2, dir: 'in' | 'out', kind: Kind, color: number, alpha: number): void {
    const g = this.gfx();
    g.setAlpha(alpha);
    g.fillStyle(0x07080b, 1);
    g.fillCircle(at.x, at.y, 9);
    if (dir === 'in') {
      g.lineStyle(2.5, color, 1);
      g.strokeCircle(at.x, at.y, 6);
    } else if (kind === 'image') {
      g.fillStyle(color, 1);
      g.fillPoints([new Phaser.Math.Vector2(at.x, at.y - 7.5), new Phaser.Math.Vector2(at.x + 7.5, at.y), new Phaser.Math.Vector2(at.x, at.y + 7.5), new Phaser.Math.Vector2(at.x - 7.5, at.y)], true);
    } else {
      g.fillStyle(color, 1);
      g.fillCircle(at.x, at.y, 6);
    }
  }

  /** Live feedback for the gesture in progress (hover footprint, drag ghost, wire in hand). */
  private drawDraft(): void {
    const g = this.draft;
    g.clear();
    const f = this.fb;
    if (!f || this.overlayOpen()) return;
    const layout = this.game_.layout;
    const box = (cx: number, cy: number, color: number, fillA: number, lineA: number) => {
      const x = cx * CELL;
      const y = cy * CELL;
      g.fillStyle(color, fillA);
      g.fillRoundedRect(x, y, AGENT_CELLS.w * CELL, AGENT_CELLS.h * CELL, 14);
      g.lineStyle(1.5, color, lineA);
      g.strokeRoundedRect(x + 0.5, y + 0.5, AGENT_CELLS.w * CELL - 1, AGENT_CELLS.h * CELL - 1, 14);
    };
    if (f.kind === 'hover') {
      if (this.game_.pending) return;
      if (this.hitBoard(f.bx, f.by).kind !== 'empty') return;
      const a = anchorAround(f.bx, f.by);
      if (canPlace(layout, a.x, a.y) && f.bx >= 0 && f.by >= 0 && f.bx <= BOARD_W && f.by <= BOARD_H) box(a.x, a.y, 0xffffff, 0.03, 0.22);
    } else if (f.kind === 'move') {
      const a = anchorNear(f.bx, f.by);
      const ok = canPlace(layout, a.x, a.y, f.id);
      box(a.x, a.y, ok ? this.modelColor(f.id) : C.bad, 0.12, 0.9);
    } else {
      const p = this.portOut(f.from);
      g.lineStyle(2.5, 0xffffff, 0.85);
      g.lineBetween(p.x, p.y, f.bx, f.by);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(f.bx, f.by, 5);
      for (const ref of ['out', ...Object.keys(layout.nodes)]) {
        if (ref === f.from) continue;
        const q = this.portIn(ref);
        const ok = this.game_.wireOk(f.from, ref);
        g.lineStyle(ok ? 3 : 1.5, ok ? C.good : C.bad, ok ? 0.95 : 0.35);
        g.strokeCircle(q.x, q.y, ok ? 13 : 11);
      }
    }
  }

  // ------------------------------------------------------------ controls over the blueprint (top camera)

  private drawOverlay(): void {
    const g = this.game_;
    const fr = this.gfx();
    fr.lineStyle(1, C.line, 1);
    fr.strokeRect(BX + 0.5, BODY_Y + 0.5, BS - 1, BS - 1);
    const m = 12;
    const len = 14;
    fr.lineStyle(1.5, C.faint, 0.9);
    for (const [cx, cy, sx, sy] of [
      [BX + m, BODY_Y + m, 1, 1],
      [BX + BS - m, BODY_Y + m, -1, 1],
      [BX + m, BODY_Y + BS - m, 1, -1],
      [BX + BS - m, BODY_Y + BS - m, -1, -1],
    ] as const) {
      fr.lineBetween(cx, cy, cx + sx * len, cy);
      fr.lineBetween(cx, cy, cx, cy + sy * len);
    }
    this.label(BX + 26, BODY_Y + 24, 'Blueprint');

    // Model colour legend
    g.level.models.forEach((id, i) => {
      const y = BODY_Y + 48 + i * 18;
      const dot = this.gfx();
      dot.fillStyle(MODEL_INFO[id].color, 1);
      dot.fillCircle(BX + 32, y + 6, 4);
      this.put(this.txt(BX + 44, y, MODEL_INFO[id].label, 11, hex(C.dim)));
    });

    // Zoom toolbar
    const tb = this.gfx();
    tb.fillStyle(C.panel, 0.92);
    tb.fillRoundedRect(TOOLBAR.x, TOOLBAR.y, TOOLBAR.w, TOOLBAR.h, 9);
    tb.lineStyle(1, C.line, 1);
    tb.strokeRoundedRect(TOOLBAR.x + 0.5, TOOLBAR.y + 0.5, TOOLBAR.w - 1, TOOLBAR.h - 1, 9);
    const cell = (key: string, x: number, w: number, glyph: string, intent: Intent) => {
      this.put(this.txt(x + w / 2, TOOLBAR.y + TOOLBAR.h / 2, glyph, 13, hex(C.text), true)).setOrigin(0.5);
      this.hot(key, x, TOOLBAR.y + 2, w, TOOLBAR.h - 4, intent, 7);
    };
    cell('zoomOut', TOOLBAR.x + 4, 28, '-', { type: 'zoomStep', dir: -1 });
    this.zoomLabel = this.put(this.txt(TOOLBAR.x + 34 + 28, TOOLBAR.y + TOOLBAR.h / 2, `${Math.round(this.view.zoom * 100)}%`, 11, hex(C.dim), true)).setOrigin(0.5);
    cell('zoomIn', TOOLBAR.x + 94, 28, '+', { type: 'zoomStep', dir: 1 });
    tb.lineStyle(1, C.line, 1);
    tb.lineBetween(TOOLBAR.x + 126, TOOLBAR.y + 6, TOOLBAR.x + 126, TOOLBAR.y + TOOLBAR.h - 6);
    cell('fit', TOOLBAR.x + 128, 46, 'Fit', { type: 'fit' });

    this.button('clear', CLEAR_BTN.x, CLEAR_BTN.y, CLEAR_BTN.w, CLEAR_BTN.h, 'Clear', null, 'ghost', true, { type: 'clear' }, 11.5);

    // Key to wire styles and controls
    const lg = this.gfx();
    lg.lineStyle(2, C.dim, 1);
    lg.lineBetween(BX + 32, BODY_Y + BS - 70, BX + 54, BODY_Y + BS - 70);
    this.put(this.txt(BX + 62, BODY_Y + BS - 77, 'text wire', 10, hex(C.dim)));
    this.stroke(lg, [new Phaser.Math.Vector2(BX + 32, BODY_Y + BS - 52), new Phaser.Math.Vector2(BX + 54, BODY_Y + BS - 52)], C.dim, 1, 2, true);
    this.put(this.txt(BX + 62, BODY_Y + BS - 59, 'image wire', 10, hex(C.dim)));
    this.put(this.txt(BX + 32, BODY_Y + BS - 36, 'wheel: zoom   drag space: pan   F: fit', 9.5, hex(C.faint)));
  }

  // ------------------------------------------------------------ right: inspector, words, run

  private drawRight(): void {
    const g = this.game_;
    const ix = RX + 16;
    const iw = RW - 32;
    const IH = 360;
    this.card(RX, BODY_Y, RW, IH);
    const sel = g.selected;

    if (g.pending) this.drawPicker(ix, iw);
    else if (g.selectedWire !== null && g.layout.edges[g.selectedWire]) this.drawWireInfo(ix, iw, g.layout.edges[g.selectedWire]);
    else if (!sel) {
      this.label(ix, BODY_Y + 14, 'Inspector');
      const tips: [string, string][] = [
        ['Add an agent', 'Click an empty spot on the blueprint grid.'],
        ['Give it words', 'Select an agent, then click words below.'],
        ['Wire it up', 'Drag from an output port (bottom) onto the next agent or DELIVER.'],
        ['Move around', 'Drag agents to reposition. Wheel zooms, drag empty space pans.'],
      ];
      tips.forEach(([h, b], i) => {
        const y = BODY_Y + 44 + i * 74;
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
          ? `Tasks arrive as ${lv.inKind}.\n\nDrag from the port under INPUT to an agent whose model can read ${lv.inKind}.`
          : `A task counts as delivered when the result is ${lv.outKind} and carries ${lv.needs.join(' and ')}.\n\nDrag from an agent that outputs ${lv.outKind} onto here.`;
      this.put(this.txt(ix, BODY_Y + 74, body, 12, hex(C.dim))).setWordWrapWidth(iw).setLineSpacing(3);
    } else this.drawAgent(sel, ix, iw);

    // Word basket
    const wy = BODY_Y + IH + 10;
    this.card(RX, wy, RW, 182);
    this.label(ix, wy + 14, 'Word basket');
    this.put(this.txt(RX + RW - 16, wy + 13, 'click to give or take', 9.5, hex(C.faint))).setOrigin(1, 0);
    const cfg = g.cfgOf(sel);
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

  private drawPicker(ix: number, iw: number): void {
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
      this.hot(`model:${m}`, ix, y, iw, 57, { type: 'place', model: m as ModelId }, 11);
    });
  }

  private drawWireInfo(ix: number, iw: number, edge: [NodeRef, NodeRef]): void {
    const [a, b] = edge;
    this.label(ix, BODY_Y + 14, 'Inspector');
    this.put(this.txt(ix, BODY_Y + 34, 'WIRE', 19, hex(C.text), true, 1));
    this.put(this.txt(ix, BODY_Y + 72, this.nodeName(a), 15, hex(this.modelColor(a)), true));
    this.put(this.txt(ix + 110, BODY_Y + 74, '>', 13, hex(C.faint), true));
    this.put(this.txt(ix + 132, BODY_Y + 72, this.nodeName(b), 15, hex(b === 'out' ? C.text : this.modelColor(b)), true));
    this.label(ix, BODY_Y + 112, 'Carries');
    this.kindBadge(ix, BODY_Y + 128, this.kindOf(a));
    this.put(this.txt(ix, BODY_Y + 162, `${this.kindOf(a) === 'image' ? 'Image wires are dashed.' : 'Text wires are solid.'}\nPress Delete or the button to remove it.`, 11.5, hex(C.dim))).setWordWrapWidth(iw).setLineSpacing(3);
    this.button('removeWire', ix + iw - 110, BODY_Y + 296, 110, 30, 'Remove wire', null, 'danger', true, { type: 'delete' }, 11.5);
  }

  private drawAgent(id: NodeRef, ix: number, iw: number): void {
    const cfg = this.game_.cfgOf(id);
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
    this.button('remove', ix + iw - 80, BODY_Y + 296, 80, 28, 'Remove', null, 'danger', true, { type: 'remove', id }, 11.5);
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
    const paths = new Map<string, Path>();
    for (const [a, b] of res.edges) paths.set(`${a}>${b}`, this.route(a, b));
    res.tasks.forEach((task, ti) => {
      for (const [a, b] of res.edges) {
        const start = ti * tune.anim.taskStaggerSeconds + (res.finish[a] ?? 0) * secs;
        const path = paths.get(`${a}>${b}`) as Path;
        const p0 = path.pts[0];
        const dot = this.add.circle(p0.x, p0.y, tune.anim.dotRadius, this.modelColor(a), 1).setAlpha(0);
        this.fx.add(dot);
        this.boardOnly(dot);
        const end = start + tune.anim.edgeSeconds;
        this.tweens.addCounter({
          from: 0,
          to: 1,
          delay: start * 1000,
          duration: tune.anim.edgeSeconds * 1000,
          onStart: () => dot.setAlpha(1),
          onUpdate: (tw) => {
            const p = this.pointAt(path, tw.getValue() ?? 0);
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

  // ------------------------------------------------------------ result (top camera, over everything)

  private drawResult(res: BatchResult): void {
    const lv = this.game_.level;
    const dim = this.put(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.8));
    dim.setInteractive();
    const pw = 680;
    const ph = 440;
    const px = (WIDTH - pw) / 2;
    const py = (HEIGHT - ph) / 2;
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
  }

  // ------------------------------------------------------------ test hook

  private installTestHook(): void {
    (window as unknown as Record<string, unknown>).__agents = {
      /**
       * Logical position of a named control: 'run', 'word:x', 'model:x', 'fit', ...; a node id
       * ('in', 'out', 'n1'); 'port:out:n1' or 'port:in:n1'; or 'cell:12,10' (centre of a grid cell).
       */
      at: (name: string) => {
        if (name.startsWith('cell:')) {
          const [cx, cy] = name.slice(5).split(',').map(Number);
          return this.toScreen((cx + 0.5) * CELL, (cy + 0.5) * CELL);
        }
        if (name.startsWith('port:')) {
          const [, dir, ref] = name.split(':');
          const p = dir === 'out' ? this.portOut(ref) : this.portIn(ref);
          return this.toScreen(p.x, p.y);
        }
        if (name === 'in' || name === 'out' || this.game_.layout.nodes[name]) {
          const r = this.rectPx(name);
          return this.toScreen(r.x + r.w / 2, r.y + r.h / 2);
        }
        return this.targets[name] ?? null;
      },
      send: (i: Intent) => this.bus.emit(i),
      view: () => ({ ...this.view }),
      state: () => ({
        level: this.game_.levelIdx,
        unlocked: this.game_.unlocked,
        selected: this.game_.selected,
        selectedWire: this.game_.selectedWire,
        pending: this.game_.pending,
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
