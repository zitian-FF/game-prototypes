import Phaser from 'phaser';
import { Sfx } from '../audio/sfx';
import { aliveLayers, generateBoard, isCleared, surfaceLayer, tilesLeft, topLayer } from '../game/board';
import { mulberry32 } from '../game/rng';
import { diceCount, resolveFace, rollFaces } from '../game/rules';
import { type Board, type Face, type Hit, TOOLS, TOOL_LABEL, type ToolId } from '../game/types';
import { IntentBus, bindKeyboard } from '../input/intents';
import { HEIGHT, PIXEL_RATIO, WIDTH } from '../pixelRatio';
import type { CellView, Skin } from '../render/skin';
import { createSkin } from '../render/skins';
import { tune } from '../tune';
import { Button } from '../ui/button';
import { VERSION_STAMP } from '../version.generated';

const BOARD_RECT = { x: 16, y: 104, w: 358, h: 432 };
const DIE = 32;
const DIE_GAP = 3;
const DIE_COLS = 10;
const TRAY_Y = 562;

const FACE_COLOR: Record<Face, number> = {
  miss: 0x3b3446,
  strike: 0xe8e4f0,
  critical: 0xff8a2b,
  wild: 0xa857ff,
  lucky: 0x37d27a,
};
const FACE_TEXT: Record<Face, string> = { miss: '', strike: '1', critical: '3', wild: '5', lucky: '5' };
const FACE_NAME: Record<Face, string> = { miss: 'MISS', strike: '', critical: 'CRIT', wild: 'WILD', lucky: 'LUCKY' };
const NUM_COLOR: Record<Face, string> = {
  miss: '#888888',
  strike: '#ffffff',
  critical: '#ffb15c',
  wild: '#d9a8ff',
  lucky: '#7dffb0',
};
const TOOL_STYLE: Record<ToolId, { fill: number; edge: number }> = {
  pickaxe: { fill: 0x3a4a68, edge: 0x6f9cff },
  hammer: { fill: 0x5a3f2e, edge: 0xffa05c },
  c4: { fill: 0x5a2a3a, edge: 0xff5c7a },
};

interface CellAnim {
  height: number;
  vel: number;
  shake: number;
  flash: number;
}

interface DieView {
  face: Face;
  shown: Face;
  settleAt: number;
  nextFlip: number;
  settled: boolean;
  used: boolean;
  pulse: number;
}

type Phase = 'idle' | 'tumble' | 'resolve';

export const runtime = { skin: new URLSearchParams(location.search).get('skin') ?? 'pastel', newBoard: false };

export class GameScene extends Phaser.Scene {
  private bus = new IntentBus();
  private sfx!: Sfx;
  private rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  private board!: Board;
  private skin!: Skin;
  private skinId = '';
  private anim: CellAnim[] = [];
  private tool: ToolId = 'pickaxe';
  private phase: Phase = 'idle';

  private gBackdrop!: Phaser.GameObjects.Graphics;
  private gBoard!: Phaser.GameObjects.Graphics;
  private gDice!: Phaser.GameObjects.Graphics;
  private dieTexts: Phaser.GameObjects.Text[] = [];
  private hudTop!: Phaser.GameObjects.Text;
  private hudTool!: Phaser.GameObjects.Text;
  private summary!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private rollBtn!: Button;
  private toolBtns = new Map<ToolId, Button>();
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  private dice: DieView[] = [];
  private hitIndex = 0;
  private nextHitAt = 0;
  private combo = 0;
  private rollDmg = 0;
  private rollBroken = 0;
  private cleared = false;
  private tumbleEnd = 0;

  constructor() {
    super('game');
  }

  create(): void {
    const params = new URLSearchParams(location.search);
    const seed = params.get('seed');
    if (seed) this.rng = mulberry32(Number(seed) || 1);
    const tool = params.get('tool') as ToolId | null;
    if (tool && TOOLS.includes(tool)) this.tool = tool;

    const cam = this.cameras.main;
    cam.setZoom(PIXEL_RATIO);
    cam.centerOn(WIDTH / 2, HEIGHT / 2);

    this.sfx = new Sfx(this);
    this.gBackdrop = this.add.graphics().setDepth(-10);
    this.gBoard = this.add.graphics().setDepth(0);
    this.gDice = this.add.graphics().setDepth(2);

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
        angle: { min: 195, max: 345 },
        gravityY: tune.feel.particleGravity,
        scale: { start: 1.5, end: 0 },
        alpha: { start: 1, end: 0.2 },
        rotate: { min: 0, max: 360 },
      })
      .setDepth(20);

    for (let i = 0; i < 20; i++) {
      this.dieTexts.push(
        this.add
          .text(0, 0, '', {
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            fontSize: '16px',
            color: '#1a1424',
            resolution: PIXEL_RATIO,
          })
          .setOrigin(0.5)
          .setDepth(3)
          .setVisible(false),
      );
    }

    this.add
      .text(5, 4, VERSION_STAMP, { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', resolution: PIXEL_RATIO })
      .setAlpha(0.28)
      .setDepth(50);
    this.hudTop = this.hudText(WIDTH / 2, 24, 16, '#ffffff');
    this.hudTool = this.hudText(WIDTH / 2, 48, 13, '#f1e9ff');
    this.summary = this.hudText(WIDTH / 2, 650, 14, '#ffffff');
    this.banner = this.hudText(WIDTH / 2, 320, 34, '#ffe27a').setDepth(30).setAlpha(0);

    const bw = (358 - 16) / 3;
    TOOLS.forEach((t, i) => {
      const cfg = tune.tools[t];
      const b = new Button(this, 16 + bw / 2 + i * (bw + 8), 702, bw, 54, TOOL_LABEL[t], `${cfg.diceMin}-${cfg.diceMax} dice`, TOOL_STYLE[t], () =>
        this.bus.emit({ type: 'selectTool', tool: t }),
      );
      this.toolBtns.set(t, b);
    });
    this.rollBtn = new Button(this, WIDTH / 2, 784, 358, 80, 'ROLL', null, { fill: 0x2f9e5b, edge: 0x6dffa8 }, () => this.bus.emit({ type: 'roll' }), 34);

    this.bus.on((intent) => {
      if (intent.type === 'roll') this.onRoll();
      else this.selectTool(intent.tool);
    });
    bindKeyboard(this, this.bus);

    this.newBoard();
    this.selectTool(this.tool);
  }

  private hudText(x: number, y: number, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, '', {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        fontSize: `${size}px`,
        color,
        stroke: '#5b4a86',
        strokeThickness: Math.max(2, size / 6),
        align: 'center',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(5);
  }

  // ---------------------------------------------------------------- state

  newBoard(): void {
    this.board = generateBoard(this.rng);
    this.anim = this.board.cells.map((c) => ({ height: aliveLayers(c), vel: 0, shake: 0, flash: 0 }));
    this.skinId = '';
    this.cleared = false;
    this.phase = 'idle';
    this.dice = [];
    this.rollBtn?.setText('ROLL');
    this.summary?.setText('Tap ROLL to dig');
    this.banner?.setAlpha(0);
  }

  private selectTool(tool: ToolId): void {
    this.tool = tool;
    for (const [id, b] of this.toolBtns) b.setSelected(id === tool);
    this.sfx.uiTap();
    const c = tune.tools[tool];
    this.hudTool.setText(`${TOOL_LABEL[tool]}: ${c.diceMin}-${c.diceMax} dice, hardness tier ${c.tier}`);
  }

  private ensureSkin(): void {
    const want = runtime.skin;
    if (this.skin && this.skinId === want && this.skin.id === want) return;
    this.skinId = want;
    this.skin = createSkin(want, BOARD_RECT, this.board.cols, this.board.rows);
    this.gBackdrop.clear();
    this.skin.drawBackdrop(this.gBackdrop, WIDTH, HEIGHT);
  }

  // ----------------------------------------------------------------- roll

  private onRoll(): void {
    if (this.cleared) {
      this.sfx.uiTap();
      this.newBoard();
      return;
    }
    if (this.phase !== 'idle') this.flushRoll();
    const n = diceCount(this.tool, this.rng);
    const faces = rollFaces(n, this.rng);
    const now = this.time.now;
    this.dice = faces.map((face, i) => ({
      face,
      shown: 'strike',
      settleAt: now + tune.feel.tumbleMs + (i / Math.max(1, n - 1)) * tune.feel.dieSettleSpreadMs,
      nextFlip: now,
      settled: false,
      used: false,
      pulse: 0,
    }));
    this.tumbleEnd = Math.max(...this.dice.map((d) => d.settleAt));
    this.hitIndex = 0;
    this.combo = 0;
    this.rollDmg = 0;
    this.rollBroken = 0;
    this.phase = 'tumble';
    this.summary.setText(`Rolling ${n} dice...`);
    this.sfx.rollStart();
  }

  /** Finishes the current roll at once so the next tap can start a new one. */
  private flushRoll(): void {
    for (const d of this.dice) {
      d.settled = true;
      d.shown = d.face;
    }
    while (this.hitIndex < this.dice.length) {
      const hit = resolveFace(this.board, this.dice[this.hitIndex].face, this.tool, this.rng);
      this.dice[this.hitIndex].used = true;
      if (hit) {
        this.rollDmg += hit.dmg;
        if (hit.broke) this.rollBroken++;
        const a = this.anim[hit.cell];
        a.flash = 0.6;
        a.vel -= 3;
      }
      this.hitIndex++;
    }
    this.finishRoll();
  }

  private finishRoll(): void {
    this.phase = 'idle';
    this.summary.setText(`${this.dice.length} dice  |  ${this.rollDmg} dmg  |  ${this.rollBroken} broken`);
    if (isCleared(this.board)) {
      this.cleared = true;
      this.rollBtn.setText('NEXT BOARD');
      this.banner.setText('BOARD CLEARED!').setAlpha(1).setScale(0.5);
      this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.Out' });
      this.sfx.cleared();
      this.cameras.main.shake(240, 0.01);
    }
  }

  // --------------------------------------------------------------- update

  update(time: number, delta: number): void {
    if (runtime.newBoard) {
      runtime.newBoard = false;
      this.newBoard();
    }
    this.ensureSkin();
    const dt = Math.min(delta, 50) / 1000;

    if (this.phase === 'tumble') {
      for (let i = 0; i < this.dice.length; i++) {
        const d = this.dice[i];
        if (d.settled) continue;
        if (time >= d.settleAt) {
          d.settled = true;
          d.shown = d.face;
          d.pulse = 1;
          this.sfx.dieLand(i);
        } else if (time >= d.nextFlip) {
          d.shown = (['miss', 'strike', 'critical', 'wild', 'lucky'] as Face[])[Math.floor(Math.random() * 5)];
          d.nextFlip = time + 55;
        }
      }
      if (time >= this.tumbleEnd) {
        this.phase = 'resolve';
        this.nextHitAt = time + 120;
      }
    } else if (this.phase === 'resolve') {
      const interval = Math.min(tune.feel.hitIntervalMs, tune.feel.maxResolveMs / Math.max(1, this.dice.length));
      while (this.phase === 'resolve' && time >= this.nextHitAt && this.hitIndex < this.dice.length) {
        this.resolveNext(time, interval);
      }
      if (this.phase === 'resolve' && this.hitIndex >= this.dice.length && time >= this.nextHitAt) this.finishRoll();
    }

    this.stepAnim(dt);
    this.drawBoard(time / 1000);
    this.drawDice(dt);
    this.hudTop.setText(
      this.cleared
        ? 'All layers cleared'
        : `Layer ${Math.max(0, topLayer(this.board)) + 1} of ${this.board.layers}   |   ${tilesLeft(this.board)} tiles left`,
    );
  }

  private resolveNext(time: number, interval: number): void {
    const die = this.dice[this.hitIndex];
    die.used = true;
    die.pulse = 1;
    this.hitIndex++;
    const hit = resolveFace(this.board, die.face, this.tool, this.rng);
    let delay = interval;
    if (!hit) {
      this.sfx.miss();
    } else {
      this.rollDmg += hit.dmg;
      if (hit.broke) this.rollBroken++;
      delay += this.playHit(hit);
      this.combo++;
    }
    this.nextHitAt = time + delay;
  }

  // ------------------------------------------------------------------ fx

  /** Plays all feedback for a hit. Returns extra hitstop in ms. */
  private playHit(hit: Hit): number {
    const f = tune.feel;
    const a = this.anim[hit.cell];
    const cell = this.board.cells[hit.cell];
    a.shake = 1;
    a.flash = 1;
    const pos = this.skin.anchor(cell.col, cell.row, Math.max(a.height, aliveLayers(cell)));
    const big = hit.face === 'critical' || hit.face === 'wild' || hit.face === 'lucky';

    this.sfx.hit(this.combo, hit.glancing);
    if (hit.broke) {
      this.sfx.strikeBreak(this.combo);
      a.vel -= 5;
    }
    this.sparks.particleTint = hit.broke ? 0xffe3a8 : 0xd9c3a0;
    this.sparks.explode(hit.broke ? f.particlesPerBreak : f.particlesPerHit, pos.x, pos.y);

    let label = String(hit.dmg);
    if (hit.weak) label += '  x' + tune.weakPointMultiplier;
    this.floatText(pos.x, pos.y - 6, label, big ? 26 : hit.glancing ? 13 : 18, hit.glancing ? '#9aa0b4' : NUM_COLOR[hit.face], big ? FACE_NAME[hit.face] : hit.glancing ? 'tough' : '');

    let stop = 0;
    const cam = this.cameras.main;
    if (hit.face === 'critical') {
      cam.shake(f.screenShakeCritMs, f.screenShakeCritIntensity);
      this.sfx.critical();
      stop = f.hitstopCritMs;
      this.ring(pos.x, pos.y, 0xff8a2b, 26);
      this.vibrate(15);
    } else if (hit.face === 'wild') {
      cam.shake(f.screenShakeWildMs, f.screenShakeWildIntensity);
      this.sfx.wild();
      stop = f.hitstopCritMs;
      this.ring(pos.x, pos.y, 0xc27bff, 46);
      this.sparks.particleTint = 0xc27bff;
      this.sparks.explode(10, pos.x, pos.y);
      this.vibrate(20);
    } else if (hit.face === 'lucky') {
      cam.shake(f.screenShakeLuckyMs, f.screenShakeLuckyIntensity);
      this.sfx.lucky();
      stop = f.hitstopLuckyMs;
      this.ring(pos.x, pos.y, 0xffe066, 56);
      this.sparks.particleTint = 0xffe066;
      this.sparks.explode(16, pos.x, pos.y);
      this.punchZoom(1.035);
      this.vibrate(25);
    } else if (hit.broke) {
      this.vibrate(8);
    }
    if (big) this.punchZoom(1.02);
    if (hit.treasureRevealed) {
      this.sfx.treasure();
      this.ring(pos.x, pos.y, 0xffd23f, 36);
    }
    return stop;
  }

  private vibrate(ms: number): void {
    if (tune.feel.vibrate && 'vibrate' in navigator) navigator.vibrate(ms);
  }

  private punchZoom(mult: number): void {
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    cam.setZoom(PIXEL_RATIO);
    this.tweens.add({ targets: cam, zoom: PIXEL_RATIO * mult, duration: 70, yoyo: true, ease: 'Sine.Out' });
  }

  private ring(x: number, y: number, color: number, r: number): void {
    const g = this.add.graphics({ x, y }).setDepth(19);
    g.lineStyle(4, color, 1);
    g.strokeCircle(0, 0, r * 0.4);
    this.tweens.add({
      targets: g,
      scale: 2.4,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.Out',
      onComplete: () => g.destroy(),
    });
  }

  private floatText(x: number, y: number, text: string, size: number, color: string, tag: string): void {
    x = Phaser.Math.Clamp(x, 48, WIDTH - 48);
    const t = this.add
      .text(x, y, tag ? `${tag}\n${text}` : text, {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        fontSize: `${size}px`,
        color,
        stroke: '#0d0a14',
        strokeThickness: 4,
        align: 'center',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setScale(0.5);
    this.tweens.add({ targets: t, scale: 1.15, duration: 110, ease: 'Back.Out' });
    this.tweens.add({
      targets: t,
      y: y - tune.feel.numberRisePx,
      alpha: 0,
      delay: 140,
      duration: tune.feel.numberRiseMs,
      ease: 'Cubic.In',
      onComplete: () => t.destroy(),
    });
  }

  // -------------------------------------------------------------- drawing

  private stepAnim(dt: number): void {
    const f = tune.feel;
    for (const cell of this.board.cells) {
      const a = this.anim[cell.idx];
      const target = aliveLayers(cell);
      const acc = (target - a.height) * f.dropStiffness - a.vel * f.dropDamping;
      a.vel += acc * dt;
      a.height += a.vel * dt;
      if (Math.abs(target - a.height) < 0.001 && Math.abs(a.vel) < 0.01) {
        a.height = target;
        a.vel = 0;
      }
      a.shake = Math.max(0, a.shake - (dt * 1000) / f.tileShakeMs);
      a.flash = Math.max(0, a.flash - (dt * 1000) / f.tileFlashMs);
    }
  }

  private drawBoard(t: number): void {
    const g = this.gBoard;
    g.clear();
    for (const { col, row } of this.skin.order(this.board.cols, this.board.rows)) {
      const cell = this.board.cells[row * this.board.cols + col];
      const a = this.anim[cell.idx];
      const s = surfaceLayer(cell);
      const tile = s >= 0 ? cell.tiles[s] : null;
      const view: CellView = {
        idx: cell.idx,
        col,
        row,
        height: a.height,
        alive: cell.tiles.flatMap((tl, layer) => (tl.hp > 0 ? [{ layer, kind: tl.kind }] : [])),
        surface: tile
          ? { layer: s, kind: tile.kind, hpFrac: tile.hp / tile.maxHp, weak: tile.weak, hardness: tile.hardness }
          : null,
        hasTreasure: cell.treasure !== null,
        offX: (Math.random() - 0.5) * 2 * tune.feel.tileShakePx * a.shake,
        offY: (Math.random() - 0.5) * 2 * tune.feel.tileShakePx * a.shake,
        flash: a.flash,
        time: t,
      };
      this.skin.drawCell(g, view);
    }
  }

  private drawDice(dt: number): void {
    const g = this.gDice;
    g.clear();
    const startX = (WIDTH - (DIE_COLS * DIE + (DIE_COLS - 1) * DIE_GAP)) / 2 + DIE / 2;
    for (let i = 0; i < 20; i++) {
      const txt = this.dieTexts[i];
      const d = this.dice[i];
      if (!d) {
        txt.setVisible(false);
        continue;
      }
      d.pulse = Math.max(0, d.pulse - dt * 6);
      const cx = startX + (i % DIE_COLS) * (DIE + DIE_GAP);
      const cy = TRAY_Y + DIE / 2 + Math.floor(i / DIE_COLS) * (DIE + DIE_GAP);
      const s = DIE * (1 + d.pulse * 0.25) * (d.settled ? 1 : 0.92);
      const wob = d.settled ? 0 : Math.sin(this.time.now / 28 + i) * 2;
      const alpha = d.used && d.pulse < 0.05 ? 0.5 : 1;
      this.drawFace(g, d.shown, cx, cy + wob, s, alpha);
      txt.setVisible(true).setPosition(cx, cy + wob).setText(FACE_TEXT[d.shown]).setAlpha(alpha);
      txt.setColor(d.shown === 'miss' ? '#6a6178' : d.shown === 'strike' ? '#1a1424' : '#ffffff');
    }
  }

  private drawFace(g: Phaser.GameObjects.Graphics, face: Face, cx: number, cy: number, s: number, alpha: number): void {
    const h = s / 2;
    const col = FACE_COLOR[face];
    g.fillStyle(0x000000, 0.4 * alpha);
    g.fillRoundedRect(cx - h, cy - h + 3, s, s, 7);
    g.fillStyle(col, alpha);
    if (face === 'wild') {
      g.fillPoints(
        [
          { x: cx, y: cy - h - 2 },
          { x: cx + h + 2, y: cy },
          { x: cx, y: cy + h + 2 },
          { x: cx - h - 2, y: cy },
        ],
        true,
      );
    } else if (face === 'lucky') {
      g.fillCircle(cx, cy, h + 1);
      g.fillStyle(0xffe066, alpha);
      g.fillCircle(cx + h * 0.55, cy - h * 0.55, 3);
    } else if (face === 'critical') {
      const pts = [];
      for (let k = 0; k < 16; k++) {
        const r = k % 2 === 0 ? h + 3 : h - 3;
        const a = (k / 16) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      g.fillPoints(pts, true);
    } else {
      g.fillRoundedRect(cx - h, cy - h, s, s, 7);
    }
    if (face === 'miss') {
      g.lineStyle(2, 0x6a6178, alpha);
      g.lineBetween(cx - 5, cy - 5, cx + 5, cy + 5);
      g.lineBetween(cx + 5, cy - 5, cx - 5, cy + 5);
    }
  }
}
