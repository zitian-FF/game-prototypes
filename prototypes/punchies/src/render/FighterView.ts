import Phaser from 'phaser';
import { tune } from '../sim/tune';
import type { Fighter } from '../sim/types';
import { activeEnd, hurtRadius, isVulnerable, phaseOf, punchPoint, stanceOf } from '../sim/sim';
import { pose } from './art';
import { GroundLayer } from './groundLayer';
import { mainLook } from './characterLook';

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
  const pts = oval(x, y, fx, fy, BODY_R * 0.8 * scale, BODY_R * scale);
  g.fillStyle(muted(color), alpha);
  g.fillPoints(pts, true);
  g.lineStyle(2.5, color, alpha);
  g.strokePoints(pts, true, true);
}

// Desaturated, darker take on a player colour (torso fill).
export function muted(c: number): number {
  const mix = (a: number, b: number) => Math.round(a * 0.3 + b * 0.7);
  const base = 0x3c4048;
  return (
    (mix((c >> 16) & 255, (base >> 16) & 255) << 16) |
    (mix((c >> 8) & 255, (base >> 8) & 255) << 8) |
    mix(c & 255, base & 255)
  );
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

// Bare arms in skin tone (player colour lives on gloves, helmet, outline),
// so the silhouette reads as a boxer rather than a pincer.
const SKIN = 0xe2a984;
export function drawArm(g: Phaser.GameObjects.Graphics, sx: number, sy: number, ex: number, ey: number, _color: number, alpha: number): void {
  g.lineStyle(7, 0x000000, 0.35 * alpha);
  g.lineBetween(sx, sy, ex, ey);
  g.lineStyle(5, SKIN, alpha);
  g.lineBetween(sx, sy, ex, ey);
}

// Glove size relative to the old placeholder (render only; hitboxes are
// unchanged).
const GLOVE = 1.15;

// Boxing glove from above, styled after the 🥊 emoji: a fat round mitt
// pointing along (fx, fy), a thumb lobe hugging the inner side, a shine
// on the knuckles and a wide white cuff with a lace stripe.
// side = +1 left hand, -1 right hand.
export function drawGlove(g: Phaser.GameObjects.Graphics, x: number, y: number, fx: number, fy: number, color: number, side: number, alpha: number, size = 1): void {
  const s = GLOVE * size;
  // Hand 0 sits on the +(fy, -fx) side, so its thumb points the other way,
  // toward the body's centre line.
  const lx = -fy * side;
  const ly = fx * side;
  const dark = shade(color, 0.6);
  // Cuff
  const cx = x - fx * 7 * s;
  const cy = y - fy * 7 * s;
  g.fillStyle(0x000000, 0.4 * alpha);
  g.fillPoints(oval(cx, cy, fx, fy, 3.6 * s, 6.4 * s), true);
  g.fillStyle(0xf4f4f4, alpha);
  g.fillPoints(oval(cx, cy, fx, fy, 2.8 * s, 5.6 * s), true);
  g.lineStyle(1, 0xb8b8b8, alpha);
  g.lineBetween(cx - lx * 4 * s, cy - ly * 4 * s, cx + lx * 4 * s, cy + ly * 4 * s);
  // Mitt: outline then fill, a little fatter than long.
  g.fillStyle(dark, alpha);
  g.fillPoints(oval(x, y, fx, fy, 8.4 * s, 8.6 * s), true);
  g.fillStyle(color, alpha);
  g.fillPoints(oval(x, y, fx, fy, 7.4 * s, 7.6 * s), true);
  // Thumb lobe on the inner side, with its crease.
  const tx = x + lx * 6.2 * s - fx * 1.5 * s;
  const ty = y + ly * 6.2 * s - fy * 1.5 * s;
  g.fillStyle(dark, alpha);
  g.fillPoints(oval(tx, ty, fx, fy, 4.6 * s, 3.4 * s), true);
  g.fillStyle(color, alpha);
  g.fillPoints(oval(tx, ty, fx, fy, 3.8 * s, 2.6 * s), true);
  g.lineStyle(1, dark, 0.8 * alpha);
  g.lineBetween(tx - fx * 3 * s, ty - fy * 3 * s, tx + fx * 2 * s, ty + fy * 2 * s);
  // Knuckle shine.
  g.fillStyle(0xffffff, 0.45 * alpha);
  g.fillPoints(oval(x + fx * 3.2 * s - lx * 2 * s, y + fy * 3.2 * s - ly * 2 * s, fx, fy, 1.6 * s, 3 * s), true);
}

export class FighterView {
  private g: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Image;
  private ground: GroundLayer;
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

  // Character look (render only): body scale and Mia's ponytail.
  private scale = 1;
  private ponytail = false;

  constructor(
    scene: Phaser.Scene,
    private color: number,
  ) {
    this.ground = new GroundLayer(scene, BODY_R);
    this.g = scene.add.graphics().setDepth(10);
    this.sprite = scene.add.image(0, 0, '__DEFAULT').setDepth(10).setVisible(false);
  }

  setLook(color: number, scale = 1, ponytail = false): void {
    this.color = color;
    this.scale = scale;
    this.ponytail = ponytail;
  }

  get look(): number {
    return this.color;
  }

  clear(): void {
    this.g.clear();
    this.sprite.setVisible(false);
    this.ground.hide();
  }

  draw(f: Fighter, now: number, showHitboxes: boolean): void {
    const g = this.g;
    g.clear();
    const stance = stanceOf(f);
    const lx = f.fy;
    const ly = -f.fx;
    const alpha = stance === 'dodging' ? 0.35 : 1;
    const k = this.scale;

    const moved = Number.isNaN(this.lastX) ? 0 : Math.hypot(f.x - this.lastX, f.y - this.lastY);
    this.lastX = f.x;
    this.lastY = f.y;
    const walking = moved > 0.2 && moved < 20; // big jumps = reset/teleport
    if (walking) this.walk += moved * 0.35;
    this.stride += ((walking ? 1 : 0) - this.stride) * 0.15;

    if (this.drawArt(f, now, walking)) {
      if (isVulnerable(f) && stance !== 'dodging') {
        g.lineStyle(2, 0xff4a3a, 0.45);
        g.strokeCircle(f.x, f.y, tune.body.vulnerableHurtRadius);
      }
      if (f.dashBuff > 0 || f.stars >= tune.stars.max) {
        g.lineStyle(2, 0xffe03a, 0.6);
        g.strokeCircle(f.x, f.y, BODY_R + 4);
      }
      if (showHitboxes) this.drawHitboxes(f);
      return;
    }

    this.ground.hide();
    // Shadow, then legs: two soft dark feet stepping under the body.
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(f.x + 3, f.y + 5, BODY_R * 2.3 * k, BODY_R * 2 * k);
    if (this.stride > 0.02) {
      for (const side of [1, -1]) {
        const swing = Math.sin(this.walk) * 9 * side * this.stride;
        const x = f.x + f.fx * swing + lx * 8 * k * side;
        const y = f.y + f.fy * swing + ly * 8 * k * side;
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
      return { x: f.x + f.fx * 15 * k + lx * 15 * k * side, y: f.y + f.fy * 15 * k + ly * 15 * k * side };
    };
    let fists = [rest(0), rest(1)];
    const colors = [this.color, this.color];
    if (f.guarding) {
      fists = [
        { x: f.x + f.fx * 20 * k + lx * 9 * k, y: f.y + f.fy * 20 * k + ly * 9 * k },
        { x: f.x + f.fx * 20 * k - lx * 9 * k, y: f.y + f.fy * 20 * k - ly * 9 * k },
      ];
      colors[0] = colors[1] = stance === 'perfectGuard' ? 0xffffff : 0x3ad0c0;
    }
    if (f.punch) {
      const p = f.punch;
      const phase = phaseOf(p);
      const end = activeEnd(p);
      const reach = p.reach;
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
      drawArm(g, f.x + lx * (BODY_R - 3) * k * side, f.y + ly * (BODY_R - 3) * k * side, fists[i].x, fists[i].y, this.color, alpha);
    }
    drawTorso(g, f.x, f.y, f.fx, f.fy, this.color, alpha, k);
    if (this.ponytail) this.drawPonytail(f, now, alpha);
    drawHelmet(g, f.x - f.fx * 2 * k, f.y - f.fy * 2 * k, f.fx, f.fy, this.color, alpha, k);
    for (let i = 0; i < 2; i++) drawGlove(g, fists[i].x, fists[i].y, f.fx, f.fy, colors[i], i === 0 ? 1 : -1, alpha, k);

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

  private drawArt(f: Fighter, now: number, walking: boolean): boolean {
    const stance = stanceOf(f);
    const prefix = f.anchored ? 'dummy' : `${f.char}${this.color !== mainLook(f.char).color ? '_alt' : ''}`;
    let action = walking ? 'walk' : 'idle';
    let progress = ((now / 1000) % 1);
    if (f.punch) {
      const p = f.punch;
      action = p.type === 'hook' ? (p.hand === 0 ? 'hook_l' : 'hook_r') : p.type;
      const end = activeEnd(p);
      // Preserve authored anticipation/extension/recovery at the sim's
      // tuned boundaries, including character/fatigue/whiff frame changes.
      progress = p.frame < p.startup ? 0.25 * p.frame / p.startup
        : p.frame < end ? 0.25 + 0.3 * (p.frame - p.startup) / Math.max(1, end - p.startup)
        : 0.55 + 0.45 * (p.frame - end) / Math.max(1, p.recovery);
    } else if (f.dodge) { action = 'dodge'; progress = f.dodge.frame / Math.max(1, tune.dodge.frames); }
    else if (f.lastBlow && f.framesSinceHit < 10) {
      action = f.lastBlow.sweet && f.lastBlow.punch !== 'jab' ? 'hit_heavy' : 'hit_light';
      progress = f.framesSinceHit / 10;
    } else if (f.stunTimer > 0) action = 'stunned';
    else if (f.guarding) action = stance === 'perfectGuard' ? 'perfect_guard' : 'guard';
    else if (f.exhausted) action = 'exhausted';
    if (!pose(this.sprite, `${prefix}_${action}`, progress)) return false;
    const rotation = Math.atan2(f.fy, f.fx);
    this.sprite.setPosition(f.x, f.y).setOrigin(0.5).setScale(this.scale / 2).setRotation(rotation);
    this.sprite.setAlpha(stance === 'dodging' ? 0.4 : 1);
    this.ground.draw(`${prefix}_${action}`, progress, f.x, f.y, rotation, this.scale, stance === 'dodging' ? 0.4 : 1);
    if (now < this.flashUntil) this.sprite.setTintFill(this.flashColor);
    else this.sprite.clearTint();
    return true;
  }

  // Yellow ponytail out the back of the helmet, swaying with the walk.
  private drawPonytail(f: Fighter, now: number, alpha: number): void {
    const g = this.g;
    const k = this.scale;
    const lx = f.fy;
    const ly = -f.fx;
    const sway = Math.sin(this.walk * 0.8 + now / 400) * (2 + 3 * this.stride);
    const pts: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const back = (9 + i * 4.5) * k;
      const off = sway * (i / 3);
      pts.push({ x: f.x - f.fx * back + lx * off, y: f.y - f.fy * back + ly * off, r: (4.2 - i * 0.7) * k });
    }
    g.fillStyle(0x8a6a10, alpha);
    for (const p of pts) g.fillCircle(p.x, p.y, p.r + 1);
    g.fillStyle(0xf2cf3a, alpha);
    for (const p of pts) g.fillCircle(p.x, p.y, p.r);
    // Hair tie.
    g.fillStyle(this.color, alpha);
    g.fillCircle(pts[0].x, pts[0].y, 2 * k);
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
