import Phaser from 'phaser';
import { Button, PIXEL_RATIO, Sfx, mulberry32 } from 'dig-kit';
import { SAVE_KEY, type Save, UPGRADES, type UpgradeId, gemValue, helperRate, tapDamage, upgradeCost } from '../game/economy';
import { type HitResult, Terrain, type TerrainSave } from '../game/terrain';
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

const UP_LABEL: Record<UpgradeId, string> = { power: 'Tap power', value: 'Gem value', helper: 'Auto pickaxe' };
const UP_STYLE: Record<UpgradeId, { fill: number; edge: number }> = {
  power: { fill: 0x3a4a68, edge: 0x6f9cff },
  value: { fill: 0x5a3f2e, edge: 0xffa05c },
  helper: { fill: 0x2f6a4a, edge: 0x6dffa8 },
};

export const runtime = { reset: false };

const lerpColor = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export class GameScene extends Phaser.Scene {
  private bus = new IntentBus<Intent>();
  private sfx!: Sfx;
  private terrain!: Terrain;
  private levels: Save['levels'] = { power: 0, value: 0, helper: 0 };
  private gems = 0;
  private shownGems = 0;
  private views = new Map<string, TerrainView>();
  private layer!: Phaser.GameObjects.Container;
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
    this.hudSub = this.hudText(WIDTH / 2, 74, 13, '#f1e9ff');
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
    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    mask.fillStyle(0xffffff, 1);
    mask.fillRoundedRect(SHAFT_X - 6, SHAFT_Y - 6, SHAFT_W + 12, shaftH + 12, 18);
    this.layer.setMask(mask.createGeometryMask());

    this.loadSave();
    this.shownTop = this.terrain.topOpenRow() - tune.terrain.tunnelRows;

    // Upgrade shelf under the shaft.
    const bw = (WIDTH - 32 - 16) / 3;
    const by = SHAFT_Y + shaftH + 62;
    UPGRADES.forEach((id, i) => {
      const b = new Button(this, 16 + bw / 2 + i * (bw + 8), by, bw, 78, UP_LABEL[id], ' ', UP_STYLE[id], () => this.bus.emit({ type: 'buy', id }), 15);
      this.buttons.set(id, b);
    });
    this.refreshShelf();

    this.bus.on((intent) => (intent.type === 'tapBlock' ? this.tapBlock(intent.row, intent.col, false) : this.buy(intent.id)));
    bindShaftPointer(this, this.bus, (x, y) => this.locate(x, y));
    this.game.events.on(Phaser.Core.Events.HIDDEN, () => this.save());
    window.addEventListener('pagehide', () => this.save());

    if (new URLSearchParams(location.search).get('test') === '1') {
      (window as unknown as Record<string, unknown>).__digTap = {
        target: () => {
          const top = this.terrain.topOpenRow();
          for (let r = top; r < top + tune.terrain.rowsVisible - 2; r++)
            for (let c = 0; c < tune.terrain.cols; c++)
              if (!this.terrain.cell(r, c).broken) return { x: this.colX(c), y: this.rowY(r) };
          return null;
        },
        gems: () => this.gems,
        dug: () => this.terrain.blocksDug,
        grant: (n: number) => {
          this.gems += n;
          this.refreshShelf();
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
    if (!saved || saved.v !== 1) {
      this.terrain = new Terrain(Math.floor(mulberry32(Date.now())() * 2 ** 31));
      return;
    }
    this.terrain = Terrain.restore(saved.terrain);
    this.levels = { power: saved.levels.power ?? 0, value: saved.levels.value ?? 0, helper: saved.levels.helper ?? 0 };
    this.gems = this.shownGems = saved.gems;

    // Offline progress: the auto pickaxe kept digging while the tab was closed.
    const rate = helperRate(this.levels);
    if (rate > 0 && saved.savedAt) {
      const secs = Math.min(tune.offline.capSeconds, Math.max(0, (Date.now() - saved.savedAt) / 1000));
      const taps = Math.floor(secs * rate * tune.offline.efficiency);
      if (taps > 0) {
        const found = this.terrain.autoDig(taps, tapDamage(this.levels));
        const earned = Math.round(found.gems * (1 + this.levels.value * tune.upgrades.value.perLevel));
        this.gems += earned;
        this.shownGems = this.gems - earned;
        this.time.delayedCall(600, () => this.say(`While you were away: ${found.blocks} blocks, +${earned} gems`));
        this.dirty = true;
      }
    }
  }

  private save(): void {
    this.dirty = false;
    this.lastSave = this.time.now;
    const data: Save & { terrain: TerrainSave } = { v: 1, gems: this.gems, levels: this.levels, savedAt: Date.now(), terrain: this.terrain.serialize() };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable: play on without saving */
    }
  }

  // ------------------------------------------------------------------ input

  private colX = (c: number): number => SHAFT_X + c * this.colW + this.colW / 2;
  private rowY = (r: number): number => SHAFT_Y + (r - this.shownTop) * ROW_H + ROW_H / 2;

  private locate(x: number, y: number): { row: number; col: number } | null {
    const col = Math.floor((x - SHAFT_X) / this.colW);
    const row = Math.floor((y - SHAFT_Y) / ROW_H + this.shownTop);
    if (col < 0 || col >= tune.terrain.cols || y < SHAFT_Y || y > SHAFT_Y + ROW_H * tune.terrain.rowsVisible || row < 0) return null;
    return this.terrain.cell(row, col).broken ? null : { row, col };
  }

  private buy(id: UpgradeId): void {
    const cost = upgradeCost(id, this.levels[id]);
    if (this.gems < cost) {
      const b = this.buttons.get(id)!;
      this.sfx.miss();
      this.tweens.add({ targets: b.container, x: b.container.x + 4, duration: 45, yoyo: true, repeat: 2 });
      return;
    }
    this.gems -= cost;
    this.levels[id]++;
    this.sfx.treasure();
    this.ring(this.buttons.get(id)!.container.x, this.buttons.get(id)!.container.y, 0xffe066, 50);
    this.refreshShelf();
    this.dirty = true;
  }

  private refreshShelf(): void {
    for (const id of UPGRADES) {
      const lv = this.levels[id];
      const cost = upgradeCost(id, lv);
      const b = this.buttons.get(id)!;
      b.setText(UP_LABEL[id], `Lv ${lv}  ·  ${cost} gems`);
      b.container.setAlpha(this.gems >= cost ? 1 : 0.55);
    }
  }

  // ----------------------------------------------------------------- digging

  private tapBlock(row: number, col: number, auto: boolean): void {
    const dmg = tapDamage(this.levels);
    const res = this.terrain.hit(row, col, dmg);
    if (!res) return;
    const f = tune.feel;
    const now = this.time.now;
    if (!auto) {
      this.combo = now - this.lastTapAt > f.comboResetMs ? 0 : this.combo + 1;
      this.lastTapAt = now;
    }
    this.impact(res, dmg, auto);
  }

  private impact(res: HitResult, dmg: number, auto: boolean): void {
    const f = tune.feel;
    const view = this.views.get(`${res.row}:${res.col}`);
    const x = this.colX(res.col);
    const y = this.rowY(res.row);
    this.sfx.hit(auto ? 0 : this.combo, false);
    this.sparks.particleTint = STRATA[this.terrain.strataOf(res.row)];
    this.sparks.explode(res.broke ? f.dustPerBreak : f.dustPerTap, x, y);
    this.floatText(x, y - 10, `-${dmg}`, 16, '#ffffff');
    if (view) {
      view.shake = 1;
      view.flash = 1;
      view.redrawCracks();
    }
    this.dirty = true;
    if (!res.broke) return;

    this.sfx.strikeBreak(this.combo);
    this.cameras.main.shake(f.breakShakeMs, f.breakShakeIntensity);
    if (navigator.vibrate && f.vibrate && !auto) navigator.vibrate(10);
    if (view) {
      this.views.delete(`${res.row}:${res.col}`);
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
    if (res.gem > 0) void this.flyGem(x, y, gemValue(res.gem, this.levels));
    if (res.rowCleared) {
      this.sfx.cleared();
      this.cameras.main.shake(f.rowClearShakeMs, f.rowClearShakeIntensity);
      this.punchZoom(f.punchZoom);
      this.say('ROW CLEARED');
    }
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

  private syncViews(dt: number): void {
    const first = Math.floor(this.shownTop) - 1;
    const last = Math.ceil(this.shownTop) + tune.terrain.rowsVisible + 1;
    const wanted = new Set<string>();
    for (let r = Math.max(0, first); r <= last; r++) {
      for (let c = 0; c < tune.terrain.cols; c++) {
        const cell = this.terrain.cell(r, c);
        if (cell.broken) continue;
        const key = `${r}:${c}`;
        wanted.add(key);
        let v = this.views.get(key);
        if (!v) {
          v = new TerrainView(this, cell, { bw: this.tw, bh: this.th }, r * 31 + c + 1);
          this.views.set(key, v);
          this.layer.add(v.container);
        }
        const jitter = tune.feel.tapShakePx * v.shake;
        v.container.setPosition(this.colX(c) + (Math.random() - 0.5) * 2 * jitter, this.rowY(r) + (Math.random() - 0.5) * 2 * jitter);
        v.update(dt);
      }
    }
    for (const [key, v] of this.views) {
      if (!wanted.has(key) && !v.cell.broken) {
        v.destroy();
        this.views.delete(key);
      }
    }
  }

  update(time: number, delta: number): void {
    if (runtime.reset) runtime.reset = false;
    const dt = Math.min(delta, 50) / 1000;

    // Camera: slide down as rows clear, keeping a little tunnel above the open rows.
    const target = this.terrain.topOpenRow() - tune.terrain.tunnelRows;
    this.shownTop += (target - this.shownTop) * (1 - Math.exp(-dt * tune.feel.cameraFollow));
    this.syncViews(dt);

    // Auto pickaxe: taps a random visible block now and then.
    const rate = helperRate(this.levels);
    if (rate > 0) {
      this.helperAcc += dt * rate;
      while (this.helperAcc >= 1) {
        this.helperAcc -= 1;
        const top = this.terrain.topOpenRow();
        const options: { row: number; col: number }[] = [];
        for (let r = top; r < top + tune.terrain.rowsVisible - 2; r++)
          for (let c = 0; c < tune.terrain.cols; c++) if (!this.terrain.cell(r, c).broken) options.push({ row: r, col: c });
        if (options.length) {
          const o = options[Math.floor(Math.random() * options.length)];
          this.tapBlock(o.row, o.col, true);
        }
      }
    }

    this.shownGems += (this.gems - this.shownGems) * Math.min(1, dt * 10);
    this.hudGems.setText(String(Math.round(this.shownGems)));
    this.hudDepth.setText(`DEPTH ${Math.floor(this.terrain.depthMeters())} m`);
    this.hudSub.setText(
      `Tap ${tapDamage(this.levels)}  |  Gems x${(1 + this.levels.value * tune.upgrades.value.perLevel).toFixed(2)}  |  Auto ${helperRate(this.levels).toFixed(1)}/s  |  Dug ${this.terrain.blocksDug}`,
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
