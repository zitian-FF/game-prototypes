import Phaser from 'phaser';
import { Button, PIXEL_RATIO, Sfx, mulberry32 } from 'dig-kit';
import {
  NO_LEVELS,
  SAVE_KEY,
  type Save,
  UPGRADES,
  type UpgradeId,
  chainMultiplier,
  gemValue,
  helperRate,
  maxLevel,
  tapDamage,
  upgradeCost,
} from '../game/economy';
import { type Block, type TapResult, Terrain, type TerrainSave } from '../game/terrain';
import { type Intent, IntentBus, bindShaftPointer } from '../input/intents';
import { HEIGHT, WIDTH } from '../pixelRatio';
import { STRATA, TerrainView, bakeTerrainTextures } from '../render/terrain';
import { tune } from '../tune';
import { VERSION_STAMP } from '../version.generated';

const SHAFT_X = 16;
const SHAFT_Y = 100;
const SHAFT_W = WIDTH - 32;
const ROW_H = 66;
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

const UP_LABEL: Record<UpgradeId, string> = { power: 'Power', splash: 'Splash', value: 'Gems', helper: 'Auto' };
const UP_STYLE: Record<UpgradeId, { fill: number; edge: number }> = {
  power: { fill: 0x3a4a68, edge: 0x6f9cff },
  splash: { fill: 0x5a2a3a, edge: 0xff6f91 },
  value: { fill: 0x5a3f2e, edge: 0xffa05c },
  helper: { fill: 0x2f6a4a, edge: 0x6dffa8 },
};

const lerpColor = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export class GameScene extends Phaser.Scene {
  private bus = new IntentBus<Intent>();
  private sfx!: Sfx;
  private terrain!: Terrain;
  private levels: Save['levels'] = { ...NO_LEVELS };
  private gems = 0;
  private shownGems = 0;
  private views = new Map<number, TerrainView>();
  private layer!: Phaser.GameObjects.Container;
  private fx!: Phaser.GameObjects.Graphics;
  private fallLock = 0;
  private lastThump = 0;
  private rockHinted = false;
  private shownTop = 0;
  private colW = 0;
  private tw = 0;
  private th = 0;
  private combo = 0;
  private lastTapAt = -1e9;
  private helperAcc = 0;
  private dirty = false;
  private lastSave = 0;

  private gBackdrop!: Phaser.GameObjects.Graphics;
  private hudDepth!: Phaser.GameObjects.Text;
  private hudSub!: Phaser.GameObjects.Text;
  private hudGems!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private buttons = new Map<UpgradeId, Button>();
  private shownMeters = 0;
  private drawnMeters = -1;

  constructor() {
    super('game');
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setZoom(PIXEL_RATIO);
    cam.centerOn(WIDTH / 2, HEIGHT / 2);
    this.sfx = new Sfx(this, {
      volume: () => tune.feel.volume,
      pitchStep: () => tune.feel.pitchStepPerHit,
      pitchStepMax: () => tune.feel.pitchStepMax,
    });

    this.gBackdrop = this.add.graphics().setDepth(-10);
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
    this.hudDepth = this.hudText(WIDTH / 2 - 20, 38, 26, '#ffffff');
    this.hudSub = this.hudText(WIDTH / 2, 74, 12, '#f1e9ff');
    this.banner = this.hudText(WIDTH / 2, 330, 28, '#ffe27a').setDepth(230).setAlpha(0);
    this.hudGems = this.hudText(GEM_X + 22, GEM_Y, 22, '#ffffff').setOrigin(0, 0.5);

    this.colW = SHAFT_W / tune.terrain.cols;
    this.tw = this.colW - 6;
    this.th = ROW_H - 6;
    bakeTerrainTextures(this, { bw: this.tw, bh: this.th });
    this.add.image(GEM_X, GEM_Y, 'dm_gem').setDisplaySize(26, 26).setDepth(240);

    const shaftH = ROW_H * tune.terrain.rowsVisible;
    const shaft = this.add.graphics().setDepth(-5);
    shaft.fillStyle(0x24123a, 0.78);
    shaft.fillRoundedRect(SHAFT_X - 6, SHAFT_Y - 6, SHAFT_W + 12, shaftH + 12, 18);
    shaft.lineStyle(3, 0xffffff, 0.12);
    shaft.strokeRoundedRect(SHAFT_X - 6, SHAFT_Y - 6, SHAFT_W + 12, shaftH + 12, 18);
    this.layer = this.add.container(0, 0).setDepth(8);
    this.fx = this.add.graphics().setDepth(12);
    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    mask.fillStyle(0xffffff, 1);
    mask.fillRoundedRect(SHAFT_X - 6, SHAFT_Y - 6, SHAFT_W + 12, shaftH + 12, 18);
    this.layer.setMask(mask.createGeometryMask());

    this.loadSave();
    this.shownTop = this.terrain.minSurface() - tune.terrain.tunnelRows;

    // Upgrade shelf under the shaft.
    const bw = (WIDTH - 32 - 8 * (UPGRADES.length - 1)) / UPGRADES.length;
    const by = SHAFT_Y + shaftH + 62;
    UPGRADES.forEach((id, i) => {
      const b = new Button(this, 16 + bw / 2 + i * (bw + 8), by, bw, 78, UP_LABEL[id], ' ', UP_STYLE[id], () => this.bus.emit({ type: 'buy', id }), 14);
      this.buttons.set(id, b);
    });
    this.refreshShelf();

    this.bus.on((intent) => (intent.type === 'tapBlock' ? this.tapAt(intent.col, intent.row, false) : this.buy(intent.id)));
    // The pointer binding reports a board position; here "row" is the board row and "col" the column.
    bindShaftPointer(this, this.bus, (x, y) => this.locate(x, y));
    this.game.events.on(Phaser.Core.Events.HIDDEN, () => this.save());
    window.addEventListener('pagehide', () => this.save());

    if (new URLSearchParams(location.search).get('test') === '1') {
      (window as unknown as Record<string, unknown>).__digTap = {
        /** Pixel position of the first tappable block of a kind in view (default dirt). */
        target: (kind = 'dirt') => {
          let best: { x: number; y: number; d: number } | null = null;
          for (const v of this.views.values()) {
            if (v.block.kind !== kind) continue;
            const y = v.container.y;
            if (y < SHAFT_Y + 20 || y > SHAFT_Y + ROW_H * (tune.terrain.rowsVisible - 1)) continue;
            if (!best || y < best.y) best = { x: v.container.x, y, d: 0 };
          }
          return best;
        },
        gems: () => this.gems,
        dug: () => this.terrain.blocksDug,
        levels: () => ({ ...this.levels }),
        grant: (n: number) => {
          this.gems += n;
          this.refreshShelf();
        },
        kinds: () => {
          const out: Record<string, number> = {};
          for (const v of this.views.values()) out[v.block.kind] = (out[v.block.kind] ?? 0) + 1;
          return out;
        },
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

  // ------------------------------------------------------------ save / load

  private loadSave(): void {
    let saved: (Save & { terrain: TerrainSave }) | null = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    if (!saved || saved.v !== 2) {
      this.terrain = new Terrain(Math.floor(mulberry32(Date.now())() * 2 ** 31));
      return;
    }
    this.terrain = Terrain.restore(saved.terrain);
    this.levels = { ...NO_LEVELS, ...saved.levels };
    this.gems = this.shownGems = saved.gems;

    // Offline progress: the auto pickaxe kept digging while the tab was closed.
    const rate = helperRate(this.levels);
    if (rate > 0 && saved.savedAt) {
      const secs = Math.min(tune.offline.capSeconds, Math.max(0, (Date.now() - saved.savedAt) / 1000));
      const taps = Math.min(20000, Math.floor(secs * rate * tune.offline.efficiency));
      if (taps > 0) {
        const dugBefore = this.terrain.blocksDug;
        let earned = 0;
        for (let i = 0; i < taps; i++) {
          const t = this.terrain.autoTarget();
          const res = t && this.terrain.tap(t.col, t.drow, tapDamage(this.levels), this.levels.splash);
          if (!res) break;
          for (const { block, wave } of res.broken) if (block.gem > 0) earned += Math.round(gemValue(block.gem, this.levels) * chainMultiplier(wave));
        }
        this.gems += earned;
        this.shownGems = this.gems - earned;
        const dug = this.terrain.blocksDug - dugBefore;
        this.time.delayedCall(600, () => this.say(`Away: ${dug} blocks, +${earned} gems`));
        this.dirty = true;
      }
    }
  }

  private save(): void {
    this.dirty = false;
    this.lastSave = this.time.now;
    const data: Save & { terrain: TerrainSave } = { v: 2, gems: this.gems, levels: this.levels, savedAt: Date.now(), terrain: this.terrain.serialize() };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable: play on without saving */
    }
  }

  // ------------------------------------------------------------------ input

  private colX = (c: number): number => SHAFT_X + c * this.colW + this.colW / 2;
  private rowY = (r: number): number => SHAFT_Y + (r - this.shownTop) * ROW_H + ROW_H / 2;

  /** The block under a point, found from where blocks are drawn (they may still be falling). */
  private locate(x: number, y: number): { row: number; col: number } | null {
    if (y < SHAFT_Y || y > SHAFT_Y + ROW_H * tune.terrain.rowsVisible) return null;
    let best: TerrainView | null = null;
    let bestD = Infinity;
    for (const v of this.views.values()) {
      const dx = Math.abs(v.container.x - x);
      const dy = Math.abs(v.container.y - y);
      if (dx <= this.colW / 2 && dy <= ROW_H / 2 && dx + dy < bestD) {
        best = v;
        bestD = dx + dy;
      }
    }
    return best ? { col: best.block.col, row: best.block.drow } : null;
  }

  private buy(id: UpgradeId): void {
    const cost = upgradeCost(id, this.levels[id]);
    const b = this.buttons.get(id)!;
    if (this.levels[id] >= maxLevel(id) || this.gems < cost) {
      this.sfx.miss();
      this.tweens.add({ targets: b.container, x: b.container.x + 4, duration: 45, yoyo: true, repeat: 2 });
      return;
    }
    this.gems -= cost;
    this.levels[id]++;
    this.sfx.treasure();
    this.ring(b.container.x, b.container.y, 0xffe066, 50);
    this.refreshShelf();
    this.dirty = true;
  }

  private refreshShelf(): void {
    for (const id of UPGRADES) {
      const lv = this.levels[id];
      const maxed = lv >= maxLevel(id);
      const cost = upgradeCost(id, lv);
      const b = this.buttons.get(id)!;
      b.setText(UP_LABEL[id], maxed ? `Lv ${lv}  MAX` : `Lv ${lv}  ${cost}`);
      b.container.setAlpha(!maxed && this.gems >= cost ? 1 : 0.55);
    }
  }

  // ----------------------------------------------------------------- digging

  private viewOf(b: Block): TerrainView | undefined {
    return this.views.get(b.id);
  }

  private tapAt(col: number, drow: number, auto: boolean): void {
    const block = this.terrain.blockAt(col, drow);
    if (!block) return;
    const f = tune.feel;
    if (block.kind === 'rock') {
      if (auto) return;
      // Rocks ignore taps: they only break from splash and blasts.
      const v = this.viewOf(block);
      this.sfx.tone(170, 0.07, 'square', 0.16, 120);
      if (v) {
        const x = v.container.x;
        this.tweens.add({ targets: v.container, x: x + f.clinkShakePx, duration: 40, yoyo: true, repeat: 2, onComplete: () => (v.container.x = x) });
        this.floatText(v.container.x, v.container.y - 8, 'SPLASH ONLY', 11, '#cfd6ea');
      }
      if (!this.rockHinted) {
        this.rockHinted = true;
        this.say('Rocks break from splash');
      }
      return;
    }
    const res = this.terrain.tap(col, drow, tapDamage(this.levels), this.levels.splash);
    if (!res) return;
    if (!auto) {
      this.combo = this.time.now - this.lastTapAt > f.comboResetMs ? 0 : this.combo + 1;
      this.lastTapAt = this.time.now;
    }
    this.dirty = true;
    void this.playTap(res, auto);
  }

  /** Animates a tap wave by wave: hits, breaks, TNT blasts and crystal links, then everything above falls. */
  private async playTap(res: TapResult, auto: boolean): Promise<void> {
    const f = tune.feel;
    this.fallLock++;
    for (let w = 0; w < res.waves.length; w++) {
      const wave = res.waves[w];
      let blast = false;
      let link = false;
      for (const h of wave.hits) {
        const v = this.viewOf(h.block);
        if (!v) continue;
        const x = v.container.x;
        const y = v.container.y;
        v.shake = h.kind === 'tap' ? 1 : 0.7;
        v.flash = 1;
        v.redrawCracks();
        this.sparks.particleTint = h.block.kind === 'dirt' ? STRATA[h.block.strata] : 0xc8d4f0;
        this.sparks.explode(h.kind === 'tap' ? f.dustPerTap : 3, x, y);
        if (h.kind === 'tap') this.floatText(x, y - 10, `-${h.dmg}`, 16, '#ffffff');
        else if (h.kind === 'splash') this.floatText(x, y - 6, `-${h.dmg}`, 11, '#cfe4ff');
        else if (h.kind === 'blast') {
          blast = true;
          this.floatText(x, y - 8, `-${h.dmg}`, 16, '#ffb15c');
        } else if (h.from) {
          link = true;
          this.linkBolt(h.from, v.container.x, v.container.y);
        }
      }
      this.sfx.hit(auto ? 0 : this.combo + w, false);
      if (blast) {
        this.sfx.critical();
        this.cameras.main.shake(f.blastShakeMs, f.blastShake);
        for (const b of wave.broke) if (b.kind === 'tnt') this.blastRing(b);
      }
      if (link) this.sfx.wild();

      for (const b of wave.broke) this.popBlock(b, w + 1, auto);

      if (w < res.waves.length - 1) await this.wait(tune.chain.waveDelayMs);
    }
    if (res.waves.length >= tune.chain.bigWaves) {
      this.sfx.cleared();
      this.punchZoom(f.punchZoom);
      this.say(`CHAIN x${res.waves.length}`);
    }
    // Everything above what broke now falls into the gaps.
    await this.wait(120);
    this.fallLock--;
  }

  private popBlock(b: Block, wave: number, auto: boolean): void {
    const f = tune.feel;
    const v = this.viewOf(b);
    if (!v) return;
    this.views.delete(b.id);
    const x = v.container.x;
    const y = v.container.y;
    this.sparks.particleTint = b.kind === 'dirt' ? STRATA[b.strata] : b.kind === 'tnt' ? 0xff8a3d : b.kind === 'crystal' ? 0xd9a8ff : 0xaeb8d6;
    this.sparks.explode(f.dustPerBreak, x, y);
    this.sfx.strikeBreak(this.combo + wave);
    this.cameras.main.shake(f.breakShakeMs, f.breakShakeIntensity);
    if (navigator.vibrate && f.vibrate && !auto) navigator.vibrate(10);
    this.tweens.add({
      targets: v.container,
      scale: 1.2,
      alpha: 0,
      angle: (Math.random() - 0.5) * 18,
      duration: f.popMs + 40,
      ease: 'Cubic.Out',
      onComplete: () => v.destroy(),
    });
    if (b.gem > 0) void this.flyGem(x, y, Math.round(gemValue(b.gem, this.levels) * chainMultiplier(wave)));
  }

  private blastRing(b: Block): void {
    const x = this.colX(b.col);
    const y = this.rowY(b.drow);
    this.ring(x, y, 0xff8a3d, 90);
    this.ring(x, y, 0xffe066, 60);
    this.sparks.particleTint = 0xff8a3d;
    this.sparks.explode(24, x, y);
  }

  /** A short glowing line from a shattered crystal to the next one. */
  private linkBolt(from: { col: number; drow: number }, tx: number, ty: number): void {
    const fx = this.colX(from.col);
    const fy = this.rowY(from.drow);
    const g = this.fx;
    g.lineStyle(5, 0xe2c2ff, 1);
    g.lineBetween(fx, fy, tx, ty);
    g.lineStyle(2, 0xffffff, 1);
    g.lineBetween(fx, fy, tx, ty);
    this.time.delayedCall(tune.feel.linkFlashMs, () => g.clear());
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
    this.dirty = true;
    this.sfx.treasure();
    this.ring(GEM_X, GEM_Y, 0x6ff0ff, 30);
    this.sparks.particleTint = 0xffe066;
    this.sparks.explode(12, GEM_X, GEM_Y);
    this.tweens.add({ targets: this.hudGems, scale: 1.4, duration: 90, yoyo: true });
    this.refreshShelf();
  }

  // --------------------------------------------------------------------- fx

  private tweenP(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(Math.max(1, ms), resolve));
  }

  private punchZoom(mult: number): void {
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    cam.setZoom(PIXEL_RATIO);
    this.tweens.add({ targets: cam, zoom: PIXEL_RATIO * mult, duration: 70, yoyo: true, ease: 'Sine.Out' });
  }

  private ring(x: number, y: number, color: number, r: number): void {
    const g = this.add.graphics({ x, y }).setDepth(219);
    g.lineStyle(4, color, 1);
    g.strokeCircle(0, 0, r * 0.4);
    this.tweens.add({ targets: g, scale: 2.4, alpha: 0, duration: 340, ease: 'Cubic.Out', onComplete: () => g.destroy() });
  }

  private say(text: string): void {
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1100, duration: 400 });
  }

  private floatText(x: number, y: number, text: string, size: number, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: `${size}px`, color, stroke: '#1f4f8f', strokeThickness: 4, resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(225)
      .setScale(0.6);
    this.tweens.add({ targets: t, scale: 1.1, duration: 90, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - tune.feel.numberRisePx, alpha: 0, delay: 100, duration: tune.feel.numberRiseMs, ease: 'Cubic.In', onComplete: () => t.destroy() });
  }

  // ----------------------------------------------------------------- update

  /** Creates views for blocks in or near the visible window and moves them (falling under gravity). */
  private syncViews(dt: number): void {
    const f = tune.fall;
    const first = Math.floor(this.shownTop) - 1;
    const last = Math.ceil(this.shownTop) + tune.terrain.rowsVisible + 1;
    const wanted = new Set<number>();
    for (let c = 0; c < tune.terrain.cols; c++) {
      const s = this.terrain.surface(c);
      this.terrain.ensure(c, last);
      const list = this.terrain.cols[c];
      for (let drow = Math.max(s, first); drow <= last; drow++) {
        const b = list[drow - s];
        if (!b || b.broken) continue;
        wanted.add(b.id);
        let v = this.views.get(b.id);
        if (!v) {
          v = new TerrainView(this, b, { bw: this.tw, bh: this.th });
          this.views.set(b.id, v);
          this.layer.add(v.container);
        }
        // While a chain is playing, blocks hold still; they fall afterwards.
        if (!v.placed || this.fallLock === 0) v.targetRow = b.drow;
        const ty = this.rowY(v.targetRow);
        if (!v.placed) {
          v.container.setPosition(this.colX(c), ty);
          v.placed = true;
        } else if (v.container.y < ty - 0.5 || v.vy < 0) {
          v.vy = Math.min(f.maxSpeed, v.vy + f.gravity * dt);
          v.container.y += v.vy * dt;
          if (v.container.y >= ty) {
            v.container.y = ty;
            if (v.vy > 320 && this.time.now - this.lastThump > 90) {
              this.lastThump = this.time.now;
              this.sfx.tone(90, 0.07, 'sine', 0.22, 60);
            }
            v.vy = v.vy > 120 ? -v.vy * f.bounce : 0;
          }
        } else {
          v.container.y = ty;
          v.vy = 0;
        }
        const jitter = tune.feel.tapShakePx * v.shake;
        v.container.x = this.colX(c) + (Math.random() - 0.5) * 2 * jitter;
        v.update(dt);
      }
    }
    for (const [id, v] of this.views) {
      if (!wanted.has(id) && !v.block.broken) {
        v.destroy();
        this.views.delete(id);
      }
    }
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;

    // Camera: slide down as the wall's surface drops, keeping a little tunnel above it.
    const target = this.terrain.minSurface() - tune.terrain.tunnelRows;
    this.shownTop += (target - this.shownTop) * (1 - Math.exp(-dt * tune.feel.cameraFollow));
    this.syncViews(dt);

    // Auto pickaxe: taps a block now and then.
    const rate = helperRate(this.levels);
    if (rate > 0) {
      this.helperAcc += dt * rate;
      while (this.helperAcc >= 1) {
        this.helperAcc -= 1;
        const t = this.terrain.autoTarget();
        if (t) this.tapAt(t.col, t.drow, true);
      }
    }

    this.shownGems += (this.gems - this.shownGems) * Math.min(1, dt * 10);
    this.hudGems.setText(String(Math.round(this.shownGems)));
    this.hudDepth.setText(`DEPTH ${Math.floor(this.terrain.depthMeters())} m`);
    this.hudSub.setText(
      `Dmg ${tapDamage(this.levels)}  |  Splash ${this.levels.splash}  |  Gems x${(1 + this.levels.value * tune.upgrades.value.perLevel).toFixed(2)}  |  Auto ${helperRate(this.levels).toFixed(1)}/s  |  Dug ${this.terrain.blocksDug}`,
    );

    if (this.dirty && time - this.lastSave > 300) this.save();

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
