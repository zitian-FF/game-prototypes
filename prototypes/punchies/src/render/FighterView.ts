import Phaser from 'phaser';
import { tune } from '../sim/tune';
import type { Fighter } from '../sim/types';
import { activeEnd, hurtRadius, isVulnerable, phaseOf, punchPoint, stanceOf } from '../sim/sim';

// Placeholder top-down boxer drawn in code: torso, sparring helmet, arms,
// gloves, stepping legs, state tints. Reads sim state only; never writes it.

export const BODY_R = 17;
export const FIST_R = 7;

type Pt = { x: number; y: number };

// Oval centred on (x, y): semi-axis a along (fx, fy), b across it.
export function oval(x: number, y: number, fx: number, fy: number, a: number, b: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 18; i++) {
    const t = (i / 18) * Math.PI * 2;
    const u = Math.cos(t) * a;
    const v = Math.sin(t) * b;
    pts.push({ x: x + fx * u + fy * v, y: y + fy * u - fx * v });
  }
  return pts;
}

// Scale an RGB colour's brightness (k < 1 darker, > 1 lighter).
export function shade(c: number, k: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

// Body parts shared with the KO animation.
export function drawTorso(g: Phaser.GameObjects.Graphics, x: number, y: number, fx: number, fy: number, color: number, alpha: number, scale = 1): void {
  g.fillStyle(0x000000, 0.35 * alpha);
  g.fillPoints(oval(x, y, fx, fy, BODY_R * 0.8 * scale + 1, BODY_R * scale + 1), true);
  g.fillStyle(color, alpha);
  g.fillPoints(oval(x, y, fx, fy, BODY_R * 0.8 * scale, BODY_R * scale), true);
}

// Sparring helmet from above: padded shell, crown ridge, face opening at the front.
export function drawHelmet(g: Phaser.GameObjects.Graphics, x: number, y: number, fx: number, fy: number, color: number, alpha: number, scale = 1): void {
  g.fillStyle(shade(color, 0.55), alpha);
  g.fillCircle(x, y, 10.5 * scale);
  g.fillStyle(shade(color, 1.15), alpha);
  g.fillCircle(x, y, 9 * scale);
  g.fillStyle(0xf0c8a0, alpha);
  g.fillCircle(x + fx * 6 * scale, y + fy * 6 * scale, 4.2 * scale);
  g.lineStyle(2, shade(color, 0.6), alpha);
  g.lineBetween(x - fx * 7 * scale, y - fy * 7 * scale, x + fx * 2 * scale, y + fy * 2 * scale);
}

export function drawArm(g: Phaser.GameObjects.Graphics, sx: number, sy: number, ex: number, ey: number, color: number, alpha: number): void {
  g.lineStyle(7, 0x000000, 0.35 * alpha);
  g.lineBetween(sx, sy, ex, ey);
  g.lineStyle(5, shade(color, 0.7), alpha);
  g.lineBetween(sx, sy, ex, ey);
}

// Boxing glove from above: mitt pointing along (fx, fy), thumb on the
// inside, white cuff at the wrist. side = +1 left hand, -1 right hand.
export function drawGlove(g: Phaser.GameObjects.Graphics, x: number, y: number, fx: number, fy: number, color: number, side: number, alpha: number): void {
  const lx = fy * side;
  const ly = -fx * side;
  g.fillStyle(0xf4f4f4, alpha);
  g.fillPoints(oval(x - fx * 5.5, y - fy * 5.5, fx, fy, 2.6, 5.2), true);
  g.fillStyle(0x000000, 0.45 * alpha);
  g.fillPoints(oval(x, y, fx, fy, FIST_R + 2.2, FIST_R + 0.2), true);
  g.fillStyle(color, alpha);
  g.fillPoints(oval(x, y, fx, fy, FIST_R + 1.2, FIST_R - 0.8), true);
  g.fillCircle(x - lx * 5 - fx, y - ly * 5 - fy, 2.8);
  g.fillStyle(0xffffff, 0.35 * alpha);
  g.fillCircle(x + fx * 3 + lx * 2, y + fy * 3 + ly * 2, 2.2);
}

export class FighterView {
  private g: Phaser.GameObjects.Graphics;
  private flashColor = 0xffffff;
  private flashUntil = 0;
  // Walk cycle, driven by how far the body moves between frames.
  private lastX = NaN;
  private lastY = NaN;
  private walk = 0;
  private stride = 0;

  // Brief body flash when hit (white = you landed it, red = you took it).
  flash(color: number, now: number, ms = 110): void {
    this.flashColor = color;
    this.flashUntil = now + ms;
  }

  constructor(
    scene: Phaser.Scene,
    private color: number,
  ) {
    this.g = scene.add.graphics().setDepth(10);
  }

  clear(): void {
    this.g.clear();
  }

  draw(f: Fighter, now: number, showHitboxes: boolean): void {
    const g = this.g;
    g.clear();
    const stance = stanceOf(f);
    const lx = f.fy;
    const ly = -f.fx;
    const alpha = stance === 'dodging' ? 0.35 : 1;

    const moved = Number.isNaN(this.lastX) ? 0 : Math.hypot(f.x - this.lastX, f.y - this.lastY);
    this.lastX = f.x;
    this.lastY = f.y;
    const walking = moved > 0.2 && moved < 20; // big jumps = reset/teleport
    if (walking) this.walk += moved * 0.35;
    this.stride += ((walking ? 1 : 0) - this.stride) * 0.15;

    // Shadow, then legs: two soft dark feet stepping under the body.
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(f.x + 3, f.y + 5, BODY_R * 2.3, BODY_R * 2);
    if (this.stride > 0.02) {
      for (const side of [1, -1]) {
        const swing = Math.sin(this.walk) * 9 * side * this.stride;
        const x = f.x + f.fx * swing + lx * 8 * side;
        const y = f.y + f.fy * swing + ly * 8 * side;
        g.fillStyle(0x000000, 0.3 * this.stride * alpha);
        g.fillEllipse(x + 2, y + 3, 11, 11);
      }
    }
    if (isVulnerable(f) && stance !== 'dodging') {
      g.lineStyle(2, 0xff4a3a, 0.35 + 0.2 * Math.sin(now / 60));
      g.strokeCircle(f.x, f.y, tune.body.vulnerableHurtRadius);
    }

    // Gloves: player colour at rest; phase colours while punching/guarding.
    const rest = (hand: 0 | 1) => {
      const side = hand === 0 ? 1 : -1;
      return { x: f.x + f.fx * 15 + lx * 12 * side, y: f.y + f.fy * 15 + ly * 12 * side };
    };
    let fists = [rest(0), rest(1)];
    const colors = [this.color, this.color];
    if (f.guarding) {
      fists = [
        { x: f.x + f.fx * 20 + lx * 6, y: f.y + f.fy * 20 + ly * 6 },
        { x: f.x + f.fx * 20 - lx * 6, y: f.y + f.fy * 20 - ly * 6 },
      ];
      colors[0] = colors[1] = stance === 'perfectGuard' ? 0xffffff : 0x3ad0c0;
    }
    if (f.punch) {
      const p = f.punch;
      const phase = phaseOf(p);
      const end = activeEnd(p);
      const reach = tune.punches[p.type].reach;
      let t: number;
      if (phase === 'startup') t = -0.15 * (p.frame / p.startup);
      else if (phase === 'recovery') t = 1 - (p.frame - end) / p.recovery;
      else t = 1;
      const from = rest(p.hand);
      const to = phase === 'recovery' ? { x: f.x + f.fx * reach, y: f.y + f.fy * reach } : punchPoint(f, p);
      let x = from.x + (to.x - from.x) * t;
      let y = from.y + (to.y - from.y) * t;
      if (p.type === 'hook' || p.type === 'uppercut') {
        const side = p.hand === 0 ? 1 : -1;
        const bulge = Math.sin(Math.max(0, t) * Math.PI) * (p.type === 'hook' ? 14 : 6) * side;
        x += lx * bulge;
        y += ly * bulge;
      }
      fists[p.hand] = { x, y };
      colors[p.hand] =
        phase === 'sweet' ? 0xffe03a : phase === 'sour' ? 0xff8a3a : p.type === 'uppercut' ? 0xffc83a : this.color;
    }

    // Arms from the shoulders (torso edge) to the glove cuffs.
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      drawArm(g, f.x + lx * (BODY_R - 3) * side, f.y + ly * (BODY_R - 3) * side, fists[i].x, fists[i].y, this.color, alpha);
    }
    drawTorso(g, f.x, f.y, f.fx, f.fy, this.color, alpha);
    drawHelmet(g, f.x - f.fx * 2, f.y - f.fy * 2, f.fx, f.fy, this.color, alpha);
    for (let i = 0; i < 2; i++) drawGlove(g, fists[i].x, fists[i].y, f.fx, f.fy, colors[i], i === 0 ? 1 : -1, alpha);

    if (now < this.flashUntil) {
      g.fillStyle(this.flashColor, 0.75);
      g.fillCircle(f.x, f.y, BODY_R + 2);
    }
    // Powered up (dash buff armed or Uppercut charged): subtle yellow pulse.
    if (f.dashBuff > 0 || f.stars >= tune.stars.max) {
      const pulse = 0.5 + 0.5 * Math.sin(now / (f.dashBuff > 0 ? 45 : 110));
      g.fillStyle(0xffe03a, 0.1 + 0.18 * pulse);
      g.fillCircle(f.x, f.y, BODY_R + 1);
      g.lineStyle(2, 0xffe03a, 0.25 + 0.35 * pulse);
      g.strokeCircle(f.x, f.y, BODY_R + 4);
    }

    // Stun: orbiting stars
    if (f.stunTimer > 0) {
      g.fillStyle(0xffe03a, 1);
      for (let i = 0; i < 3; i++) {
        const a = now / 150 + (i * Math.PI * 2) / 3;
        g.fillCircle(f.x + Math.cos(a) * 20, f.y - 4 + Math.sin(a) * 8, 3);
      }
    }

    if (showHitboxes) this.drawHitboxes(f);
  }

  private drawHitboxes(f: Fighter): void {
    const g = this.g;
    g.lineStyle(1, 0x00ff88, 0.8);
    g.strokeCircle(f.x, f.y, hurtRadius(f));
    if (!isVulnerable(f)) {
      g.lineStyle(1, 0x00aaff, 0.9);
      g.strokeCircle(f.x, f.y, tune.body.coreRadius);
    }
    if (f.punch) {
      const phase = phaseOf(f.punch);
      const pt = punchPoint(f, f.punch);
      const c = phase === 'sweet' ? 0xffff00 : phase === 'sour' ? 0xff8800 : 0x888888;
      g.lineStyle(1, c, phase === 'startup' || phase === 'recovery' ? 0.4 : 1);
      g.strokeCircle(pt.x, pt.y, tune.punches[f.punch.type].hitRadius);
    }
  }
}
