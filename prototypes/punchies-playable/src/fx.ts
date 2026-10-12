import Phaser from 'phaser';
import type { Tune } from './tune';
import { W, H, PIXEL_RATIO } from './pixelRatio';

// Over-the-top screen effects: impact bursts, flying goo and sparks, comic
// words, flashes, camera jolts, trails and confetti. Everything is drawn in
// code (a few generated particle textures), no art files. The overall dial is
// tune.fx.intensity, with separate multipliers for shake, particles and flashes.

const FONT = 'Arial Black, Arial, sans-serif';
export const TIER_COLORS = ['#ffc84a', '#ff9a3a', '#ff5a4a', '#ff4aa0', '#7af0ff'];

function makeTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  make('fx_dot', 16, 16, (g) => g.fillCircle(8, 8, 8));
  make('fx_chunk', 14, 14, (g) => g.fillRoundedRect(0, 0, 14, 14, 5));
  make('fx_confetti', 12, 7, (g) => g.fillRect(0, 0, 12, 7));
  make('fx_star', 28, 28, (g) => g.fillTriangle(14, 0, 18, 10, 10, 10).fillTriangle(28, 14, 18, 18, 18, 10).fillTriangle(14, 28, 10, 18, 18, 18).fillTriangle(0, 14, 10, 10, 10, 18).fillRect(9, 9, 10, 10));
}

export class Fx {
  private goo: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private puff: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti: Phaser.GameObjects.Particles.ParticleEmitter;
  private flashRect: Phaser.GameObjects.Rectangle;
  private warnEdge: Phaser.GameObjects.Graphics;
  private jolt = { z: 0, a: 0 };
  private trailTick = 0;

  constructor(private scene: Phaser.Scene, private tune: Tune) {
    makeTextures(scene);
    const em = (texture: string, depth: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      scene.add.particles(0, 0, texture, { emitting: false, maxAliveParticles: 220, ...cfg }).setDepth(depth);
    this.goo = em('fx_chunk', 66, { lifespan: { min: 380, max: 800 }, speed: { min: 140, max: 560 }, angle: { min: 0, max: 360 }, scale: { start: 1.3, end: 0.1 }, alpha: { start: 1, end: 0 }, tint: [0x6fd16f, 0x9dbc61, 0x4f8a3a, 0xc8e86a], rotate: { min: 0, max: 360 }, gravityY: 700 });
    this.sparks = em('fx_star', 67, { lifespan: { min: 260, max: 560 }, speed: { min: 220, max: 760 }, angle: { min: 0, max: 360 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xffc84a, 0xfff1d1], blendMode: 'ADD', rotate: { min: 0, max: 360 } });
    this.puff = em('fx_dot', 64, { lifespan: { min: 420, max: 760 }, speed: { min: 20, max: 140 }, angle: { min: 0, max: 360 }, scale: { start: 0.9, end: 2.6 }, alpha: { start: 0.55, end: 0 }, tint: [0xcfd8e8, 0x9aa6c8, 0x8fbf6a] });
    this.embers = em('fx_dot', 68, { lifespan: { min: 500, max: 1000 }, speed: { min: 80, max: 360 }, angle: { min: 0, max: 360 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xff3a2a, 0xff8a2a, 0xffd04a], blendMode: 'ADD', gravityY: -120 });
    this.confetti = em('fx_confetti', 85, { lifespan: { min: 1400, max: 2400 }, speed: { min: 260, max: 760 }, angle: { min: -135, max: -45 }, scale: { start: 1.2, end: 1 }, alpha: { start: 1, end: 0.2 }, tint: [0xffc84a, 0xff5a4a, 0x7af0ff, 0x6fd16f, 0xff4aa0, 0xffffff], rotate: { min: 0, max: 360 }, gravityY: 900, maxAliveParticles: 320 });
    this.flashRect = scene.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(90);
    // Pulsing red screen edges for warnings (horde banners).
    this.warnEdge = scene.add.graphics().setDepth(59).setAlpha(0);
    const band = 90;
    const c = 0xff2a1a;
    this.warnEdge.fillGradientStyle(c, c, c, c, 0.5, 0.5, 0, 0).fillRect(0, 0, W, band);
    this.warnEdge.fillGradientStyle(c, c, c, c, 0, 0, 0.5, 0.5).fillRect(0, H - band, W, band);
    this.warnEdge.fillGradientStyle(c, c, c, c, 0.5, 0, 0.5, 0).fillRect(0, 0, band, H);
    this.warnEdge.fillGradientStyle(c, c, c, c, 0, 0.5, 0, 0.5).fillRect(W - band, 0, band, H);
  }

  private get k(): number {
    return this.tune.fx.intensity;
  }
  private count(n: number): number {
    return Math.round(n * this.k * this.tune.fx.particles);
  }

  alive(): number {
    return [this.goo, this.sparks, this.puff, this.embers, this.confetti].reduce((a, e) => a + e.getAliveParticleCount(), 0);
  }

  reset(): void {
    for (const e of [this.goo, this.sparks, this.puff, this.embers, this.confetti]) e.killAll();
    this.scene.tweens.killTweensOf(this.jolt);
    this.jolt.z = 0;
    this.jolt.a = 0;
    this.apply();
    this.flashRect.setAlpha(0);
    this.warnEdge.setAlpha(0);
  }

  // Zoom punch and rotation jolt on the main camera (the base zoom is the pixel ratio).
  private apply(): void {
    const cam = this.scene.cameras.main;
    cam.setZoom(PIXEL_RATIO * (1 + this.jolt.z));
    cam.setAngle(this.jolt.a);
  }

  camera(zoom: number, angle: number, shake: number, shakeMs: number): void {
    const s = this.scene;
    const f = this.tune.fx;
    s.cameras.main.shake(shakeMs, shake * f.shake * this.k);
    s.tweens.killTweensOf(this.jolt);
    this.jolt.z = zoom * this.k * f.zoomPunch;
    this.jolt.a = (Math.random() < 0.5 ? -1 : 1) * angle * this.k;
    s.tweens.add({ targets: this.jolt, z: 0, a: 0, duration: 260, ease: 'Cubic.Out', onUpdate: () => this.apply(), onComplete: () => this.apply() });
  }

  flash(color: number, alpha: number, ms: number): void {
    const a = Math.min(0.85, alpha * this.k * this.tune.fx.flash);
    this.flashRect.setFillStyle(color, a);
    this.scene.tweens.killTweensOf(this.flashRect);
    this.flashRect.setAlpha(1);
    this.scene.tweens.add({ targets: this.flashRect, alpha: 0, duration: ms });
  }

  warn(): void {
    const s = this.scene;
    s.tweens.killTweensOf(this.warnEdge);
    this.warnEdge.setAlpha(0);
    s.tweens.add({ targets: this.warnEdge, alpha: this.k > 1 ? 1 : this.k, duration: 160, yoyo: true, repeat: 3 });
  }

  private ring(x: number, y: number, color: number, r0: number, grow: number, ms: number, width = 6): void {
    const g = this.scene.add.graphics({ x, y }).setDepth(65);
    g.lineStyle(width, color, 1).strokeCircle(0, 0, r0);
    this.scene.tweens.add({ targets: g, scale: grow * this.k, alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => g.destroy() });
  }

  private burst(x: number, y: number, color: number, spikes: number, inner: number, outer: number, ms: number): void {
    const g = this.scene.add.graphics({ x, y }).setDepth(66);
    g.fillStyle(color, 1);
    const a0 = Math.random() * Math.PI;
    for (let i = 0; i < spikes; i++) {
      const a = a0 + (i / spikes) * Math.PI * 2;
      const w = (Math.PI / spikes) * 0.55;
      const len = i % 2 ? outer * 0.6 : outer;
      g.fillTriangle(Math.cos(a - w) * inner, Math.sin(a - w) * inner, Math.cos(a + w) * inner, Math.sin(a + w) * inner, Math.cos(a) * len, Math.sin(a) * len);
    }
    g.fillStyle(0xffffff, 1).fillCircle(0, 0, inner * 0.9);
    g.setScale(0.3);
    this.scene.tweens.add({ targets: g, scale: 1.25 * this.k, alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => g.destroy() });
  }

  // Streak lines along the blow direction.
  private streaks(x: number, y: number, dx: number, dy: number, n: number, len: number): void {
    const g = this.scene.add.graphics({ x, y }).setDepth(66);
    for (let i = 0; i < n; i++) {
      const spread = (i / Math.max(1, n - 1) - 0.5) * 0.9;
      const a = Math.atan2(dy, dx) + spread;
      const l0 = 20 + Math.random() * 20;
      const l1 = l0 + len * (0.6 + Math.random() * 0.6);
      g.lineStyle(3 + Math.random() * 3, i % 2 ? 0xffffff : 0xffc84a, 1).lineBetween(Math.cos(a) * l0, Math.sin(a) * l0, Math.cos(a) * l1, Math.sin(a) * l1);
    }
    this.scene.tweens.add({ targets: g, alpha: 0, scale: 1.4, duration: 260, ease: 'Cubic.Out', onComplete: () => g.destroy() });
  }

  word(x: number, y: number, text: string, color: string, size: number, ms = 750): void {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${Math.round(size * (0.8 + 0.2 * this.k))}px`, color, stroke: '#101b32', strokeThickness: Math.max(5, size / 4), resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(75)
      .setAngle((Math.random() - 0.5) * 24)
      .setScale(0.2)
      .setAlpha(0);
    const fit = Math.min(1, (W - 64) / (t.width * 1.5)); // big words shrink to stay on screen
    t.x = Math.max(t.width * 0.75 * fit + 8, Math.min(W - t.width * 0.75 * fit - 8, t.x));
    this.scene.tweens.add({ targets: t, alpha: 1, scale: 1.25 * fit, duration: 130, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, scale: 1.05 * fit, duration: 90, delay: 130 });
    this.scene.tweens.add({ targets: t, alpha: 0, y: y - 70, scale: 1.5 * fit, delay: ms * 0.45, duration: ms * 0.55, onComplete: () => t.destroy() });
  }

  // A sweet hit. dir is the unit blow direction (away from the player).
  hit(x: number, y: number, dir: { x: number; y: number }, zone: 'head' | 'body', killed: boolean): void {
    const head = zone === 'head';
    const col = head ? 0xffc84a : 0xffffff;
    this.burst(x, y, col, head ? 14 : 10, 14, killed ? 120 : head ? 92 : 74, killed ? 380 : 300);
    this.ring(x, y, col, 14, killed ? 6 : 4, killed ? 420 : 320, killed ? 9 : 6);
    if (killed) this.ring(x, y, 0xffffff, 10, 9, 520, 5);
    this.streaks(x, y, dir.x, dir.y, killed ? 11 : 7, killed ? 150 : 100);
    this.goo.explode(this.count(killed ? 38 : 16), x, y);
    this.sparks.explode(this.count(killed ? 26 : head ? 16 : 10), x, y);
    this.puff.explode(this.count(killed ? 12 : 5), x, y);
    this.word(x, y - 34, killed ? 'K.O.!!' : head ? 'BAM!' : 'POW!', killed ? '#ff5a4a' : head ? '#ffc84a' : '#fff1d1', killed ? 60 : head ? 46 : 38, killed ? 900 : 650);
    this.camera(killed ? 1.1 : 0.55, killed ? 1.6 : 0.8, killed ? 0.013 : 0.008, killed ? 160 : 100);
    this.flash(0xffffff, killed ? 0.4 : head ? 0.2 : 0.12, killed ? 200 : 120);
  }

  sour(x: number, y: number): void {
    this.puff.explode(this.count(6), x, y);
    this.ring(x, y, 0xff8a4a, 10, 3, 260, 4);
    this.camera(0.2, 0.4, 0.004, 70);
  }

  // Smoke and sparks behind a zombie flying off.
  trail(x: number, y: number): void {
    if (++this.trailTick % 2) return;
    this.puff.emitParticleAt(x, y, this.count(2));
    this.sparks.emitParticleAt(x, y, this.count(1));
  }

  // Marco takes a punch.
  hurt(x: number, y: number): void {
    this.embers.explode(this.count(26), x, y);
    this.ring(x, y, 0xff4a3a, 16, 5, 360, 8);
    this.burst(x, y, 0xff4a3a, 10, 16, 80, 280);
    this.word(x, y - 70, 'OUCH!', '#ff6a5a', 44, 700);
    this.flash(0xff2a1a, 0.35, 260);
    this.camera(0.9, 2.2, 0.016, 200);
  }

  // Whoosh lines in front of the fist.
  swing(x: number, y: number, dir: { x: number; y: number }, heavy: boolean): void {
    this.streaks(x + dir.x * 40, y + dir.y * 40, dir.x, dir.y, heavy ? 8 : 5, heavy ? 120 : 80);
    if (heavy) this.ring(x + dir.x * 30, y + dir.y * 30, 0xffffff, 12, 3, 220, 4);
  }

  // Combo call-out tiers 0..4: bigger tiers burn brighter.
  combo(tier: number): void {
    const gold = 0xffd04a;
    this.flash(gold, 0.12 + tier * 0.06, 260);
    this.confetti.explode(this.count(18 + tier * 14), W * 0.2, H * 0.5);
    this.confetti.explode(this.count(18 + tier * 14), W * 0.8, H * 0.5);
    this.camera(0.5 + tier * 0.25, 1 + tier * 0.4, 0.008 + tier * 0.003, 200);
  }

  // End of run: confetti for a finish, embers for an overrun.
  finish(win: boolean): void {
    if (win) {
      this.confetti.explode(this.count(70), W * 0.1, H - 40);
      this.confetti.explode(this.count(70), W * 0.9, H - 40);
      for (let i = 1; i <= 5; i++) this.scene.time.delayedCall(i * 260, () => this.confetti.explode(this.count(40), W * (0.2 + Math.random() * 0.6), H * 0.9));
    } else {
      this.embers.explode(this.count(60), W / 2, H * 0.7);
      this.flash(0xff2a1a, 0.3, 500);
    }
  }
}
