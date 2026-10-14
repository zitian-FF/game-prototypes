import Phaser from 'phaser';
import { PIXEL_RATIO, Sfx, mulberry32, type Rng } from 'dig-kit';
import { canSwap, findRuns, findValidMove, generateBoard, swapCells } from '../game/board';
import { resolveBoard } from '../game/resolve';
import { Terrain } from '../game/terrain';
import type { Board, Resolution, Step } from '../game/types';
import { type BoardGeometry, type Intent, IntentBus, bindBoardPointer, bindKeyboard } from '../input/intents';
import { HEIGHT, WIDTH } from '../pixelRatio';
import { BLOCK_COLORS, BlockView, bakeBlockTextures } from '../render/blocks';
import { STRATA, TerrainView, bakeTerrainTextures } from '../render/terrain';
import { tune } from '../tune';
import { VERSION_STAMP } from '../version.generated';

const BOARD_X = 16;
const BOARD_W = WIDTH - 32;

// Top: the shaft (terrain being dug). Bottom: the ore board that digs it.
const SHAFT_X = 16;
const SHAFT_Y = 104;
const SHAFT_W = WIDTH - 32;
const ROW_H = 62;
const GEM_X = 318;
const GEM_Y = 38;

// Backdrop bands by depth: the sky changes colour as the player digs down.
const BANDS: [number, number][] = [
  [0x2f9bff, 0x8ad8ff],
  [0x7b4dff, 0xc9a8ff],
  [0x14a58a, 0x7fe8c9],
  [0xe2575b, 0xffb38a],
  [0xe0a31a, 0xffe07a],
];

export const runtime = { newBoard: false };

const lerpColor = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export class GameScene extends Phaser.Scene {
  private bus = new IntentBus<Intent>();
  private sfx!: Sfx;
  private rng: Rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  private board!: Board;
  private geo!: BoardGeometry;
  private bw = 0;
  private views = new Map<number, BlockView>();
  private layer!: Phaser.GameObjects.Container;
  private busy = false;
  private selected = -1;
  private cursor = -1;
  private bestChain = 0;
  private terrain!: Terrain;
  private terrainViews = new Map<string, TerrainView>();
  private terrainLayer!: Phaser.GameObjects.Container;
  private shownTop = 0;
  private colW = 0;
  private tw = 0;
  private th = 0;
  private digCombo = 0;
  private gems = 0;
  private shownGems = 0;
  private hudGems!: Phaser.GameObjects.Text;
  private gemIcon!: Phaser.GameObjects.Image;
  private collars: Phaser.GameObjects.Image[] = [];
  private oreY = 0;

  private gBackdrop!: Phaser.GameObjects.Graphics;
  private gSel!: Phaser.GameObjects.Graphics;
  private hudDepth!: Phaser.GameObjects.Text;
  private hudSub!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private shownMeters = 0;
  private drawnMeters = -1;

  constructor() {
    super('game');
  }

  create(): void {
    const seed = new URLSearchParams(location.search).get('seed');
    if (seed) this.rng = mulberry32(Number(seed) || 1);

    const cam = this.cameras.main;
    cam.setZoom(PIXEL_RATIO);
    cam.centerOn(WIDTH / 2, HEIGHT / 2);

    this.sfx = new Sfx(this, {
      volume: () => tune.feel.volume,
      pitchStep: () => tune.feel.pitchStepPerHit,
      pitchStepMax: () => tune.feel.pitchStepMax,
    });

    this.gBackdrop = this.add.graphics().setDepth(-10);
    this.gSel = this.add.graphics().setDepth(50);

    const px = this.make.graphics({ x: 0, y: 0 }, false);
    px.fillStyle(0xffffff, 1);
    px.fillRect(0, 0, 4, 4);
    px.generateTexture('px', 4, 4);
    px.destroy();
    this.sparks = this.add
      .particles(0, 0, 'px', {
        emitting: false,
        lifespan: { min: tune.feel.particleLifeMs * 0.6, max: tune.feel.particleLifeMs },
        speed: { min: tune.feel.particleSpeedMin, max: tune.feel.particleSpeedMax },
        angle: { min: 0, max: 360 },
        gravityY: tune.feel.particleGravity,
        scale: { start: 1.6, end: 0 },
        alpha: { start: 1, end: 0.2 },
        rotate: { min: 0, max: 360 },
      })
      .setDepth(220);

    this.add
      .text(5, 4, VERSION_STAMP, { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', resolution: PIXEL_RATIO })
      .setAlpha(0.28)
      .setDepth(250);
    this.hudDepth = this.hudText(WIDTH / 2, 38, 26, '#ffffff');
    this.hudSub = this.hudText(WIDTH / 2, 70, 13, '#f1e9ff');
    this.banner = this.hudText(WIDTH / 2, 330, 34, '#ffe27a').setDepth(230).setAlpha(0);
    this.hudGems = this.hudText(GEM_X + 22, GEM_Y, 22, '#ffffff').setOrigin(0, 0.5);

    this.bus.on((intent) => this.onIntent(intent));
    bindKeyboard(this, this.bus);

    this.newBoard();
    bindBoardPointer(this, this.geo, this.bus, () => tune.feel.dragThresholdPx);

    // Test hook for the Playwright screenshot script, only with ?test=1.
    if (new URLSearchParams(location.search).get('test') === '1') {
      (window as unknown as Record<string, unknown>).__digMatch = {
        validMove: () => {
          const m = findValidMove(this.board);
          return m ? { a: { x: this.cellX(m[0]), y: this.cellY(m[0]) }, b: { x: this.cellX(m[1]), y: this.cellY(m[1]) } } : null;
        },
        busy: () => this.busy,
        cleared: () => this.board.cleared,
        gems: () => this.gems,
        front: () => [...this.terrain.front],
      };
    }
  }

  private hudText(x: number, y: number, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, '', {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        fontSize: `${size}px`,
        color,
        stroke: '#1f4f8f',
        strokeThickness: Math.max(2, size / 6),
        align: 'center',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(240);
  }

  // ------------------------------------------------------------ board setup

  newBoard(): void {
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    for (const v of this.terrainViews.values()) v.destroy();
    this.terrainViews.clear();
    this.layer?.destroy();
    this.terrainLayer?.destroy();
    this.panels?.forEach((g) => g.destroy());
    this.collars.forEach((c) => c.destroy());
    this.collars = [];
    this.panels = [];

    this.board = generateBoard(this.rng);
    this.terrain = new Terrain(Math.floor(this.rng() * 2 ** 31));
    const { cols, rows } = this.board;

    // ---- shaft (terrain)
    const tcols = tune.terrain.cols;
    this.colW = SHAFT_W / tcols;
    this.tw = this.colW - 6;
    this.th = ROW_H - 6;
    const shaftH = ROW_H * tune.terrain.rowsVisible;
    bakeTerrainTextures(this, { bw: this.tw, bh: this.th });
    this.gemIcon?.destroy();
    this.gemIcon = this.add.image(GEM_X, GEM_Y, 'dm_gem').setDisplaySize(26, 26).setDepth(240);
    const shaft = this.add.graphics().setDepth(-5);
    shaft.fillStyle(0x24123a, 0.78);
    shaft.fillRoundedRect(SHAFT_X - 6, SHAFT_Y - 6, SHAFT_W + 12, shaftH + 12, 18);
    shaft.lineStyle(3, 0xffffff, 0.12);
    shaft.strokeRoundedRect(SHAFT_X - 6, SHAFT_Y - 6, SHAFT_W + 12, shaftH + 12, 18);
    this.panels.push(shaft);
    this.terrainLayer = this.add.container(0, 0).setDepth(8);
    const tmask = this.make.graphics({ x: 0, y: 0 }, false);
    tmask.fillStyle(0xffffff, 1);
    tmask.fillRoundedRect(SHAFT_X - 6, SHAFT_Y - 6, SHAFT_W + 12, shaftH + 12, 18);
    this.terrainLayer.setMask(tmask.createGeometryMask());
    this.shownTop = this.terrain.minFront() - tune.terrain.tunnelRows;

    // ---- ore board
    this.oreY = SHAFT_Y + shaftH + 26;
    const cw = BOARD_W / cols;
    this.geo = { x: BOARD_X, y: this.oreY, cw, ch: cw, cols, rows };
    this.bw = cw - tune.block.gap;
    bakeBlockTextures(this, { bw: this.bw, bh: this.bw });
    // Collars show which ore colour digs which column.
    for (let c = 0; c < tcols; c++) {
      const collar = this.add
        .image(SHAFT_X + c * this.colW + this.colW / 2, SHAFT_Y - 18, `dm_blk_${c % BLOCK_COLORS.length}`)
        .setDisplaySize(this.colW * 0.5, 13)
        .setDepth(12);
      this.collars.push(collar);
    }

    this.gBackdrop.clear();
    this.drawnMeters = -1;
    const panel = this.add.graphics().setDepth(-5);
    panel.fillStyle(0x10305f, 0.32);
    panel.fillRoundedRect(BOARD_X - 6, this.oreY - 6, BOARD_W + 12, cw * rows + 12, 18);
    this.panels.push(panel);
    this.layer = this.add.container(0, 0).setDepth(10);
    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(BOARD_X - 6, this.oreY - 6, BOARD_W + 12, cw * rows + 12);
    this.layer.setMask(maskG.createGeometryMask());

    for (const b of this.board.cells) {
      if (!b) continue;
      this.addView(b, this.board.cells.indexOf(b));
    }
    this.busy = false;
    this.selected = -1;
    this.bestChain = 0;
    this.shownMeters = 0;
    this.digCombo = 0;
    this.gems = 0;
    this.shownGems = 0;
    this.updateHud();
    this.drawSelection();
  }

  private panels: Phaser.GameObjects.Graphics[] = [];

  private cellX = (i: number): number => this.geo.x + (i % this.geo.cols) * this.geo.cw + this.geo.cw / 2;
  private cellY = (i: number): number => this.geo.y + Math.floor(i / this.geo.cols) * this.geo.ch + this.geo.ch / 2;

  private addView(block: Board['cells'][number] & object, i: number, fromRow?: number): BlockView {
    const y = fromRow === undefined ? this.cellY(i) : this.geo.y + fromRow * this.geo.ch + this.geo.ch / 2;
    const v = new BlockView(this, block, this.cellX(i), y, { bw: this.bw, bh: this.bw });
    this.layer.add(v.container);
    this.views.set(block.id, v);
    return v;
  }

  // ---------------------------------------------------------------- intents

  private onIntent(intent: Intent): void {
    if (intent.type === 'swap') void this.trySwap(intent.from, intent.to);
    else if (intent.type === 'tap') this.onTap(intent.idx);
    else if (intent.type === 'cursor') this.onCursor(intent.dc, intent.dr);
    else if (this.cursor >= 0) this.onTap(this.cursor);
  }

  private onTap(i: number): void {
    if (this.busy) return;
    const { board } = this;
    if (this.selected < 0) {
      if (board.cells[i] && !board.cells[i]!.rock) this.select(i);
      else this.rejectShake(i);
      return;
    }
    if (this.selected === i) return this.select(-1);
    if (canSwap(board, this.selected, i)) {
      const from = this.selected;
      this.select(-1);
      void this.trySwap(from, i);
    } else if (board.cells[i] && !board.cells[i]!.rock) this.select(i);
    else this.rejectShake(i);
  }

  private onCursor(dc: number, dr: number): void {
    if (this.busy) return;
    if (this.cursor < 0) this.cursor = Math.floor(this.board.rows / 2) * this.board.cols + Math.floor(this.board.cols / 2);
    const c = this.cursor % this.board.cols;
    const r = Math.floor(this.cursor / this.board.cols);
    const nc = Phaser.Math.Clamp(c + dc, 0, this.board.cols - 1);
    const nr = Phaser.Math.Clamp(r + dr, 0, this.board.rows - 1);
    const next = nr * this.board.cols + nc;
    if (this.selected >= 0 && next !== this.cursor) {
      const from = this.selected;
      this.select(-1);
      this.cursor = next;
      void this.trySwap(from, next);
      return;
    }
    this.cursor = next;
    this.drawSelection();
  }

  private select(i: number): void {
    this.selected = i;
    if (i >= 0) this.sfx.uiTap();
    this.drawSelection();
  }

  private drawSelection(): void {
    const g = this.gSel;
    g.clear();
    const mark = (i: number, color: number, a: number) => {
      if (i < 0) return;
      g.lineStyle(3.5, color, a);
      g.strokeRoundedRect(this.cellX(i) - this.bw / 2 - 1, this.cellY(i) - this.bw / 2 - 1, this.bw + 2, this.bw + 2, this.bw * tune.block.cornerRadius);
    };
    mark(this.cursor, 0xffffff, 0.55);
    mark(this.selected, 0xffffff, 1);
  }

  private rejectShake(i: number): void {
    this.sfx.miss();
    const v = this.views.get(this.board.cells[i]?.id ?? -1);
    if (!v) return;
    const x = this.cellX(i);
    this.tweens.add({ targets: v.container, x: x + 4, duration: 45, yoyo: true, repeat: 2, onComplete: () => (v.container.x = x) });
  }

  // ------------------------------------------------------------------- play

  private tweenP(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(Math.max(1, ms), resolve));
  }

  private moveViews(a: number, b: number, ms: number): Promise<void[]> {
    return Promise.all(
      [a, b].map((i) => {
        const v = this.views.get(this.board.cells[i]!.id)!;
        return this.tweenP({ targets: v.container, x: this.cellX(i), y: this.cellY(i), duration: ms, ease: 'Sine.InOut' });
      }),
    );
  }

  private async trySwap(a: number, b: number): Promise<void> {
    if (this.busy) return;
    if (!canSwap(this.board, a, b)) {
      this.rejectShake(a);
      return;
    }
    this.busy = true;
    this.cursor = b;
    swapCells(this.board, a, b);
    const valid = findRuns(this.board).length > 0;
    this.sfx.uiTap();
    await this.moveViews(a, b, tune.feel.swapMs);
    if (!valid) {
      this.sfx.miss();
      swapCells(this.board, a, b);
      await this.moveViews(a, b, tune.feel.invalidMs);
      this.busy = false;
      this.drawSelection();
      return;
    }
    const res = resolveBoard(this.board, this.rng);
    await this.play(res);
    this.busy = false;
    this.drawSelection();
  }

  private async play(res: Resolution): Promise<void> {
    for (const step of res.steps) {
      await this.playStep(step);
      this.bestChain = Math.max(this.bestChain, step.chain);
      await this.wait(tune.feel.cascadeDelayMs);
    }
    if (res.reshuffle) await this.playReshuffle(res.reshuffle);
    this.updateHud();
  }

  private async playStep(step: Step): Promise<void> {
    const f = tune.feel;
    const total = step.cleared.length;
    const big = total >= f.bigClearCount || step.chain >= f.bigChainSteps;
    let cx = 0;
    let cy = 0;

    // Chips first, so a rock that breaks pops with the rest.
    for (const chip of step.chips) {
      const v = this.views.get(chip.id);
      if (!v) continue;
      v.block.hp = chip.hp;
      v.refresh();
      const x = this.cellX(chip.idx);
      this.tweens.add({ targets: v.container, x: x + f.chipShakePx, duration: 40, yoyo: true, repeat: 3, onComplete: () => (v.container.x = x) });
      this.sparks.particleTint = 0xc8d4f0;
      this.sparks.explode(4, x, this.cellY(chip.idx));
    }
    if (step.chips.length) this.sfx.hit(step.chain + 1, true);

    const pops: Promise<void>[] = [];
    for (const c of step.cleared) {
      const v = this.views.get(c.block.id);
      if (!v) continue;
      const x = this.cellX(c.idx);
      const y = this.cellY(c.idx);
      cx += x;
      cy += y;
      this.sparks.particleTint = v.tint;
      this.sparks.explode(c.block.rock ? f.particlesPerBlock * 2 : f.particlesPerBlock, x, y);
      v.container.setDepth(5);
      pops.push(
        this.tweenP({ targets: v.container, scale: f.popScale, alpha: 0, duration: f.popMs, ease: 'Cubic.Out' }).then(() => {
          v.destroy();
          this.views.delete(c.block.id);
        }),
      );
    }
    cx /= Math.max(1, total);
    cy /= Math.max(1, total);

    this.sfx.hit(step.chain, false);
    this.sfx.strikeBreak(step.chain);
    if (big) {
      this.sfx.critical();
      this.cameras.main.shake(f.shakeMs, f.shakeIntensity);
      this.punchZoom(f.punchZoom);
      if (navigator.vibrate && f.vibrate) navigator.vibrate(15);
    }
    if (step.chain >= 4) this.sfx.lucky();
    this.floatText(cx, cy, step.chain > 1 ? `CHAIN x${step.chain}` : `+${total}`, step.chain > 1 ? 24 : 20, step.chain > 1 ? '#ffe27a' : '#ffffff');
    await Promise.all(pops);

    // Rise: survivors float up, new blocks come in from below the board, with a little overshoot.
    const rises: Promise<void>[] = [];
    for (const m of step.moves) {
      const v = this.views.get(m.id);
      if (!v) continue;
      const delay = (m.to % this.geo.cols) * f.spawnStaggerMs * 0.3;
      rises.push(this.rise(v, m.to, delay));
    }
    for (const s of step.spawns) {
      const v = this.addView(s.block, s.to, s.fromRow);
      rises.push(this.rise(v, s.to, (s.fromRow - this.geo.rows) * f.spawnStaggerMs));
    }
    rises.push(this.digStep(step));
    await Promise.all(rises);
  }

  // ----------------------------------------------------------------- digging

  /** Each match fires bolts into the shaft column of its ore colour. */
  private async digStep(step: Step): Promise<void> {
    const d = tune.dig;
    const blockOf = new Map(step.cleared.map((c) => [c.idx, c.block]));
    const launches: { col: number; fx: number; fy: number; color: number }[] = [];
    const cols = tune.terrain.cols;
    for (const run of step.runs) {
      const first = blockOf.get(run[0]);
      if (!first) continue;
      const len = run.length;
      let hits = len >= 5 ? d.five : len === 4 ? d.four : d.three;
      hits += (step.chain - 1) * d.chainBonus;
      if (run.some((i) => blockOf.get(i)?.weak)) hits += d.weakBonus;
      const col = first.color % cols;
      const fx = run.reduce((a, i) => a + this.cellX(i), 0) / len;
      const fy = run.reduce((a, i) => a + this.cellY(i), 0) / len;
      const color = BLOCK_COLORS[first.color % BLOCK_COLORS.length];
      const add = (c: number, n: number) => {
        if (c < 0 || c >= cols) return;
        for (let k = 0; k < n; k++) launches.push({ col: c, fx, fy, color });
      };
      add(col, hits);
      if (len === 4) {
        add(col - 1, d.fourSplash);
        add(col + 1, d.fourSplash);
      } else if (len >= 5) {
        add(col - 1, d.fiveSplashNear);
        add(col + 1, d.fiveSplashNear);
        add(col - 2, d.fiveSplashFar);
        add(col + 2, d.fiveSplashFar);
      }
      this.pulseCollar(col);
    }
    const stagger = Math.min(d.boltStaggerMs, d.boltMaxTotalMs / Math.max(1, launches.length));
    await Promise.all(launches.map((l, k) => this.bolt(l, k * stagger)));
  }

  private pulseCollar(col: number): void {
    const c = this.collars[col];
    if (!c) return;
    this.tweens.add({ targets: c, scaleX: c.scaleX * 1.5, scaleY: c.scaleY * 1.8, duration: 120, yoyo: true });
  }

  private colX = (c: number): number => SHAFT_X + c * this.colW + this.colW / 2;
  private rowY = (r: number): number => SHAFT_Y + (r - this.shownTop) * ROW_H + ROW_H / 2;

  private async bolt(l: { col: number; fx: number; fy: number; color: number }, delay: number): Promise<void> {
    await this.wait(delay);
    const target = this.terrain.targetColumn(l.col);
    const orb = this.add.image(l.fx, l.fy, 'dm_orb').setTint(l.color).setDepth(210).setScale(1.3);
    await this.tweenP({
      targets: orb,
      x: this.colX(target),
      y: this.rowY(this.terrain.front[target]),
      scale: 0.8,
      duration: tune.dig.boltMs,
      ease: 'Cubic.In',
      onUpdate: () => {
        this.sparks.particleTint = l.color;
        this.sparks.explode(1, orb.x, orb.y);
      },
    });
    orb.destroy();
    this.impact(l.col);
  }

  private impact(col: number): void {
    const f = tune.feel;
    const res = this.terrain.hit(col);
    const view = this.terrainViews.get(`${res.row}:${res.col}`);
    const x = this.colX(res.col);
    const y = this.rowY(res.row);
    const strata = STRATA[this.terrain.strataOf(res.row)];
    this.sfx.hit(this.digCombo++, false);
    this.sparks.particleTint = strata;
    this.sparks.explode(res.broke ? f.dustPerBreak : f.dustPerHit, x, y);
    if (view) {
      view.shake = 1;
      view.flash = 1;
      view.redrawCracks();
    }
    if (!res.broke) return;
    this.sfx.strikeBreak(this.digCombo);
    if (navigator.vibrate && f.vibrate) navigator.vibrate(8);
    if (view) {
      this.terrainViews.delete(`${res.row}:${res.col}`);
      this.tweens.add({
        targets: view.container,
        scale: 1.2,
        alpha: 0,
        angle: (Math.random() - 0.5) * 18,
        duration: f.popMs + 40,
        ease: 'Cubic.Out',
        onComplete: () => view.destroy(),
      });
    }
    if (res.gem > 0) void this.flyGem(x, y, res.gem);
  }

  /** A gem pops out of a broken block, hangs for a beat, then arcs to the counter in a sparkling trail. */
  private async flyGem(x: number, y: number, value: number): Promise<void> {
    const f = tune.feel;
    const gem = this.add.image(x, y, 'dm_gem').setDepth(215).setScale(0.1);
    this.ring(x, y, 0xffe066, 40);
    this.sfx.lucky();
    await this.tweenP({ targets: gem, scale: 1.6, duration: f.gemPopMs, ease: 'Back.Out' });
    await this.wait(f.gemHoldMs);
    const sx = gem.x;
    const sy = gem.y;
    const cx = (sx + GEM_X) / 2 + (sx < WIDTH / 2 ? f.gemArcPx : -f.gemArcPx);
    const cy = Math.min(sy, GEM_Y) - f.gemArcPx * 0.6;
    const prog = { t: 0 };
    await this.tweenP({
      targets: prog,
      t: 1,
      duration: f.gemFlyMs,
      ease: 'Cubic.In',
      onUpdate: () => {
        const t = prog.t;
        const u = 1 - t;
        gem.x = u * u * sx + 2 * u * t * cx + t * t * GEM_X;
        gem.y = u * u * sy + 2 * u * t * cy + t * t * GEM_Y;
        gem.rotation += 0.35;
        gem.setScale(1.6 - 0.9 * t);
        this.sparks.particleTint = Math.random() < 0.5 ? 0xffe066 : 0x6ff0ff;
        this.sparks.explode(f.gemTrailPerFrame, gem.x, gem.y);
      },
    });
    gem.destroy();
    this.gems += value;
    this.sfx.treasure();
    this.ring(GEM_X, GEM_Y, 0x6ff0ff, 30);
    this.sparks.particleTint = 0xffe066;
    this.sparks.explode(12, GEM_X, GEM_Y);
    this.tweens.add({ targets: this.hudGems, scale: 1.4, duration: 90, yoyo: true });
  }

  private ring(x: number, y: number, color: number, r: number): void {
    const g = this.add.graphics({ x, y }).setDepth(219);
    g.lineStyle(4, color, 1);
    g.strokeCircle(0, 0, r * 0.4);
    this.tweens.add({ targets: g, scale: 2.4, alpha: 0, duration: 340, ease: 'Cubic.Out', onComplete: () => g.destroy() });
  }

  private syncTerrainViews(dt: number): void {
    const first = Math.floor(this.shownTop) - 1;
    const last = Math.ceil(this.shownTop) + tune.terrain.rowsVisible + 1;
    const wanted = new Set<string>();
    for (let r = Math.max(0, first); r <= last; r++) {
      for (let c = 0; c < tune.terrain.cols; c++) {
        const cell = this.terrain.cell(r, c);
        if (cell.broken) continue;
        const key = `${r}:${c}`;
        wanted.add(key);
        let v = this.terrainViews.get(key);
        if (!v) {
          v = new TerrainView(this, cell, { bw: this.tw, bh: this.th }, r * 31 + c + 1);
          this.terrainViews.set(key, v);
          this.terrainLayer.add(v.container);
        }
        const jitter = tune.feel.impactShakePx * v.shake;
        v.container.setPosition(this.colX(c) + (Math.random() - 0.5) * 2 * jitter, this.rowY(r) + (Math.random() - 0.5) * 2 * jitter);
        v.update(dt);
      }
    }
    for (const [key, v] of this.terrainViews) {
      if (!wanted.has(key) && !v.cell.broken) {
        v.destroy();
        this.terrainViews.delete(key);
      }
    }
  }

  private rise(v: BlockView, to: number, delay: number): Promise<void> {
    return this.tweenP({
      targets: v.container,
      x: this.cellX(to),
      y: this.cellY(to),
      duration: tune.feel.riseMs,
      delay: Math.max(0, delay),
      ease: 'Back.Out',
      easeParams: [tune.feel.riseOvershoot],
    });
  }

  private async playReshuffle(changes: { id: number; color: number }[]): Promise<void> {
    this.sfx.wild();
    this.banner.setText('SHUFFLE!').setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, alpha: 0, duration: 800, ease: 'Cubic.Out' });
    const spins: Promise<void>[] = [];
    for (const ch of changes) {
      const v = this.views.get(ch.id);
      if (!v) continue;
      v.block.color = ch.color;
      spins.push(
        this.tweenP({ targets: v.container, scale: 0.2, duration: 160, yoyo: true, onYoyo: () => v.refresh(), ease: 'Sine.In' }).then(() => {
          v.container.setScale(1);
        }),
      );
    }
    await Promise.all(spins);
  }

  // -------------------------------------------------------------------- fx

  private punchZoom(mult: number): void {
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    cam.setZoom(PIXEL_RATIO);
    this.tweens.add({ targets: cam, zoom: PIXEL_RATIO * mult, duration: 70, yoyo: true, ease: 'Sine.Out' });
  }

  private floatText(x: number, y: number, text: string, size: number, color: string): void {
    x = Phaser.Math.Clamp(x, 56, WIDTH - 56);
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        fontSize: `${size}px`,
        color,
        stroke: '#1f4f8f',
        strokeThickness: 5,
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(225)
      .setScale(0.5);
    this.tweens.add({ targets: t, scale: 1.15, duration: 110, ease: 'Back.Out' });
    this.tweens.add({
      targets: t,
      y: y - tune.feel.numberRisePx,
      alpha: 0,
      delay: 160,
      duration: tune.feel.numberRiseMs,
      ease: 'Cubic.In',
      onComplete: () => t.destroy(),
    });
  }

  // ------------------------------------------------------------------- hud

  private updateHud(): void {
    this.hudDepth.setText(`DEPTH ${Math.floor(this.terrain.depthMeters())} m`);
    this.hudSub.setText(`Blocks dug ${this.terrain.blocksDug}   |   Best chain x${this.bestChain || 1}`);
  }

  update(_time: number, delta: number): void {
    if (runtime.newBoard) {
      runtime.newBoard = false;
      this.newBoard();
    }
    const dt = Math.min(delta, 50) / 1000;

    // Camera: slide down so the shallowest column's face sits near the top, with a bit of tunnel above.
    const target = this.terrain.minFront() - tune.terrain.tunnelRows;
    this.shownTop += (target - this.shownTop) * (1 - Math.exp(-dt * tune.feel.cameraFollow));
    this.syncTerrainViews(dt);

    this.shownGems += (this.gems - this.shownGems) * Math.min(1, dt * 10);
    this.hudGems.setText(String(Math.round(this.shownGems)));
    this.updateHud();

    const meters = this.terrain.depthMeters();
    this.shownMeters += (meters - this.shownMeters) * Math.min(1, dt * 3);
    if (Math.abs(this.shownMeters - this.drawnMeters) > 0.002) {
      this.drawnMeters = this.shownMeters;
      const t = this.shownMeters / tune.depth.bandMeters;
      const band = Math.floor(t);
      const frac = Math.max(0, (t - band - 0.7) / 0.3);
      const a = BANDS[band % BANDS.length];
      const b = BANDS[(band + 1) % BANDS.length];
      const top = lerpColor(a[0], b[0], frac);
      const bottom = lerpColor(a[1], b[1], frac);
      this.gBackdrop.clear();
      this.gBackdrop.fillGradientStyle(top, top, bottom, bottom, 1);
      this.gBackdrop.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }
}
