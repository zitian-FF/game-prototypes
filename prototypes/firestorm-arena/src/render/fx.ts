import type Phaser from 'phaser';
import { Iso, hash2 } from './iso';
import { drawFlames } from './icons';
import { clientTune } from '../clientTune';

type G = Phaser.GameObjects.Graphics;

type Fx =
  | { kind: 'combat'; x: number; y: number; start: number; seed: number }
  | { kind: 'ring'; x: number; y: number; start: number; color: number; dur: number; big: number }
  | { kind: 'extract'; x: number; y: number; start: number; color: number }
  | { kind: 'landing'; x: number; y: number; start: number; color: number }
  | { kind: 'fireball'; x: number; y: number; start: number }
  | { kind: 'firePatch'; x: number; y: number; start: number; seed: number };

/** Short-lived effects at map-pixel positions: fights, teleports, flashes, eruptions. */
export class FxSystem {
  private list: Fx[] = [];
  private nextEruption = 0;
  private seed = 1;

  constructor(private iso: Iso) {}

  combat(wx: number, wy: number, now: number): void {
    const p = this.iso.p(wx, wy);
    this.list.push({ kind: 'combat', x: p.x, y: p.y, start: now, seed: this.seed++ });
  }

  ring(wx: number, wy: number, now: number, color: number, dur = 0.9, big = 1): void {
    const p = this.iso.p(wx, wy);
    this.list.push({ kind: 'ring', x: p.x, y: p.y, start: now, color, dur, big });
  }

  teleport(from: { x: number; y: number }, to: { x: number; y: number }, now: number, color: number): void {
    const a = this.iso.p(from.x, from.y);
    const b = this.iso.p(to.x, to.y);
    this.list.push({ kind: 'extract', x: a.x, y: a.y, start: now, color });
    this.list.push({ kind: 'landing', x: b.x, y: b.y, start: now + clientTune.fx.teleportSeconds * 0.55, color });
  }

  /** Occasional eruptions: a fireball falls from the sky and leaves a patch of fire. */
  ambient(now: number): void {
    if (now < this.nextEruption) return;
    const every = clientTune.fx.eruptionEverySeconds;
    this.nextEruption = now + every * (0.5 + hash2(this.seed++, 3, 9));
    const wx = hash2(this.seed, 1, 5) * this.iso.cols * this.iso.cell;
    const wy = hash2(this.seed, 2, 5) * this.iso.rows * this.iso.cell;
    const p = this.iso.p(wx, wy);
    this.list.push({ kind: 'fireball', x: p.x, y: p.y, start: now });
  }

  draw(g: G, now: number): void {
    const next: Fx[] = [];
    for (const fx of this.list) {
      const age = now - fx.start;
      if (age < 0) {
        next.push(fx);
        continue;
      }
      let alive = true;
      switch (fx.kind) {
        case 'combat':
          alive = this.drawCombat(g, fx, age);
          break;
        case 'ring': {
          const k = age / fx.dur;
          alive = k < 1;
          if (alive) {
            const r = (10 + k * 60) * fx.big;
            g.lineStyle(3, fx.color, 1 - k);
            g.strokeEllipse(fx.x, fx.y, r * 2, r);
          }
          break;
        }
        case 'extract': {
          const dur = clientTune.fx.teleportSeconds;
          const k = age / dur;
          alive = k < 1;
          if (alive) {
            // A column of light climbing out of the pad, the pad shrinking away.
            g.fillStyle(fx.color, 0.35 * (1 - k));
            g.fillRect(fx.x - 14, fx.y - 160 * k - 20, 28, 160 * k + 20);
            g.fillStyle(0xffffff, 0.7 * (1 - k));
            g.fillRect(fx.x - 4, fx.y - 220 * k - 20, 8, 220 * k + 20);
            g.lineStyle(2, fx.color, 1 - k);
            g.strokeEllipse(fx.x, fx.y, 70 * (1 - k) + 6, 35 * (1 - k) + 3);
          }
          break;
        }
        case 'landing': {
          const dur = clientTune.fx.teleportSeconds * 0.8;
          const k = age / dur;
          alive = k < 1;
          if (alive) {
            const fall = Math.min(1, k / 0.45);
            if (fall < 1) {
              g.fillStyle(fx.color, 0.5);
              g.fillRect(fx.x - 12, fx.y - 260 * (1 - fall), 24, 260 * (1 - fall));
            } else {
              const s = (k - 0.45) / 0.55;
              g.lineStyle(4, 0xffffff, 1 - s);
              g.strokeEllipse(fx.x, fx.y, 30 + s * 150, 15 + s * 75);
              g.lineStyle(3, fx.color, 1 - s);
              g.strokeEllipse(fx.x, fx.y, 20 + s * 110, 10 + s * 55);
              g.fillStyle(0xffe08a, 0.5 * (1 - s));
              g.fillEllipse(fx.x, fx.y, 40, 20);
            }
          }
          break;
        }
        case 'fireball': {
          const dur = 0.9;
          const k = age / dur;
          if (k < 1) {
            const y = fx.y - 380 * (1 - k * k);
            const x = fx.x - 60 * (1 - k);
            g.fillStyle(0xff7a22, 0.9).fillCircle(x, y, 5);
            g.fillStyle(0xffe08a, 0.9).fillCircle(x, y, 2.5);
            g.lineStyle(2, 0xff5a1c, 0.5);
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + 12, y - 26);
            g.strokePath();
          } else {
            alive = false;
            this.list.push({ kind: 'firePatch', x: fx.x, y: fx.y, start: fx.start + dur, seed: this.seed++ });
            this.list.push({ kind: 'ring', x: fx.x, y: fx.y, start: fx.start + dur, color: 0xff8a33, dur: 0.6, big: 0.7 });
          }
          break;
        }
        case 'firePatch': {
          const dur = clientTune.fx.fireSeconds;
          const k = age / dur;
          alive = k < 1;
          if (alive) {
            g.fillStyle(0x1a0a05, 0.5 * (1 - k)).fillEllipse(fx.x, fx.y, 46, 23);
            const scale = 0.8 * (1 - k * 0.7);
            drawFlames(g, fx.x - 8, fx.y, now, scale, fx.seed);
            drawFlames(g, fx.x + 8, fx.y + 3, now + 1, scale * 0.8, fx.seed + 3);
          }
          break;
        }
      }
      if (alive) next.push(fx);
    }
    this.list = next;
  }

  /** Bullet sprays and explosions for a couple of seconds. */
  private drawCombat(g: G, fx: Extract<Fx, { kind: 'combat' }>, age: number): boolean {
    const dur = clientTune.fx.combatSeconds;
    if (age > dur) return false;
    const fade = Math.min(1, (dur - age) / 0.5);
    const n = clientTune.fx.sprayCount;
    // Tracer fire: short bright streaks flicking out from the fight.
    for (let i = 0; i < n; i++) {
      const phase = age * 8 + hash2(fx.seed, i, 3) * 10;
      const k = phase - Math.floor(phase);
      const ang = hash2(fx.seed, i, 4) * Math.PI * 2 + Math.floor(phase) * 1.7;
      const r0 = 6 + k * 34;
      const r1 = r0 + 9;
      g.lineStyle(2, i % 3 === 0 ? 0xffe08a : 0xff9a3a, fade * (1 - k));
      g.beginPath();
      g.moveTo(fx.x + Math.cos(ang) * r0, fx.y - 12 + Math.sin(ang) * r0 * 0.5);
      g.lineTo(fx.x + Math.cos(ang) * r1, fx.y - 12 + Math.sin(ang) * r1 * 0.5);
      g.strokePath();
    }
    // Explosions popping at random spots across the node.
    for (let j = 0; j < 6; j++) {
      const t0 = hash2(fx.seed, j, 8) * (dur - 0.7);
      const e = (age - t0) / 0.6;
      if (e < 0 || e > 1) continue;
      const ex = fx.x + (hash2(fx.seed, j, 9) - 0.5) * 60;
      const ey = fx.y - 8 + (hash2(fx.seed, j, 10) - 0.5) * 26;
      g.fillStyle(0xffd070, (1 - e) * fade).fillCircle(ex, ey, 4 + e * 14);
      g.fillStyle(0xff5a1c, (1 - e) * 0.8 * fade).fillCircle(ex, ey, 2 + e * 9);
    }
    g.fillStyle(0x2a1208, 0.25 * fade).fillEllipse(fx.x, fx.y, 70, 35);
    return true;
  }
}
