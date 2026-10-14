import Phaser from 'phaser';
import { PIXEL_RATIO, Sfx, mulberry32, type Rng } from 'dig-kit';
import { canSwap, depthMeters, findRuns, findValidMove, generateBoard, swapCells } from '../game/board';
import { resolveBoard } from '../game/resolve';
import type { Board, Resolution, Step } from '../game/types';
import { type BoardGeometry, type Intent, IntentBus, bindBoardPointer, bindKeyboard } from '../input/intents';
import { HEIGHT, WIDTH } from '../pixelRatio';
import { BlockView, bakeBlockTextures } from '../render/blocks';
import { tune } from '../tune';
import { VERSION_STAMP } from '../version.generated';

const BOARD_X = 16;
const BOARD_Y = 104;
const BOARD_W = WIDTH - 32;

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
    this.layer?.destroy();
    this.board = generateBoard(this.rng);
    const { cols, rows } = this.board;
    const cw = BOARD_W / cols;
    this.geo = { x: BOARD_X, y: BOARD_Y, cw, ch: cw, cols, rows };
    this.bw = cw - tune.block.gap;
    bakeBlockTextures(this, { bw: this.bw, bh: this.bw });

    this.gBackdrop.clear();
    this.drawnMeters = -1;
    // Panel behind the blocks, and a mask so rising blocks do not show below the board.
    const panel = this.add.graphics().setDepth(-5);
    panel.fillStyle(0x10305f, 0.32);
    panel.fillRoundedRect(BOARD_X - 6, BOARD_Y - 6, BOARD_W + 12, cw * rows + 12, 18);
    this.layer = this.add.container(0, 0).setDepth(10);
    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(BOARD_X - 6, BOARD_Y - 6, BOARD_W + 12, cw * rows + 12);
    this.layer.setMask(maskG.createGeometryMask());

    for (const b of this.board.cells) {
      if (!b) continue;
      const i = this.board.cells.indexOf(b);
      this.addView(b, i);
    }
    this.busy = false;
    this.selected = -1;
    this.bestChain = 0;
    this.shownMeters = 0;
    this.updateHud();
    this.drawSelection();
  }

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
    await Promise.all(rises);
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
    const meters = depthMeters(this.board);
    this.hudDepth.setText(`DEPTH ${Math.floor(meters)} m`);
    this.hudSub.setText(`Blocks cleared ${this.board.cleared}   |   Best chain x${this.bestChain || 1}`);
  }

  update(_time: number, delta: number): void {
    if (runtime.newBoard) {
      runtime.newBoard = false;
      this.newBoard();
    }
    const dt = Math.min(delta, 50) / 1000;
    const target = depthMeters(this.board);
    this.shownMeters += (target - this.shownMeters) * Math.min(1, dt * 3);
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
