import Phaser from 'phaser';
import { tune, TICK_RATE } from '../sim/tune';
import { punchTotal } from '../sim/sim';
import type { Fighter, MatchResult, SimState } from '../sim/types';
import { BODY_R, drawArm, drawGlove, drawHelmet, drawTorso, muted } from './FighterView';
import { pose } from './art';
import { GroundLayer } from './groundLayer';
import { mainLook, type Look } from './characterLook';

// KO finish, render-only (the sim has already stopped; nothing here can
// affect the result or online sync).
// - drop: the loser slumps flat where they stand, in slow motion.
// - fly:  the loser is knocked along the blow to the ropes, then sits down.
// Meanwhile the winner's last punch plays out its recovery in slow motion.

const GREY = 0x6a6a6a;

type Pt = { x: number; y: number };

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 1, t);
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

// Ellipse with semi-axes a (along dir) and b, as a polygon (Graphics
// ellipses are axis-aligned only).
function ellipse(c: Pt, dx: number, dy: number, a: number, b: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    const u = Math.cos(t) * a;
    const v = Math.sin(t) * b;
    pts.push({ x: c.x + dx * u - dy * v, y: c.y + dy * u + dx * v });
  }
  return pts;
}

export class KoAnim {
  private g: Phaser.GameObjects.Graphics;
  private result: MatchResult | null = null;
  private start = 0;
  private from: Pt = { x: 0, y: 0 };
  private to: Pt = { x: 0, y: 0 };
  private dx = 1;
  private dy = 0;
  private winner: Fighter | null = null;
  private winnerFrame0 = 0;
  private shook = false;
  private sprite: Phaser.GameObjects.Image;
  private ground: GroundLayer;
  private loserFighter: Fighter | null = null;
  public looks: Look[] = [mainLook('marco'), mainLook('marco')];

  constructor(
    private scene: Phaser.Scene,
    public colors: [number, number],
  ) {
    this.ground = new GroundLayer(scene, BODY_R, 8);
    this.g = scene.add.graphics().setDepth(11);
    this.sprite = scene.add.image(0, 0, '__DEFAULT').setDepth(11).setVisible(false);
  }

  get active(): boolean {
    return this.result !== null;
  }

  get loser(): number {
    return this.result?.ko?.loser ?? -1;
  }

  // Starts (or resets, for a new sim) the animation for this state's KO.
  sync(s: SimState, allowed: boolean, now: number): void {
    const r = s.result?.ko ? s.result : null;
    if (r === this.result) return;
    if (!r) {
      this.result = null;
      this.g.clear();
      this.sprite.setVisible(false);
      this.ground.hide();
      return;
    }
    if (!allowed) return;
    const ko = r.ko!;
    const len = Math.sqrt(ko.dx * ko.dx + ko.dy * ko.dy) || 1;
    this.result = r;
    this.start = now;
    this.dx = ko.dx / len;
    this.dy = ko.dy / len;
    const f = s.fighters[ko.loser];
    this.loserFighter = structuredClone(f);
    this.from = { x: f.x, y: f.y };
    this.to = this.ropePoint(this.from);
    this.winner = structuredClone(s.fighters[1 - ko.loser]);
    this.winnerFrame0 = this.winner.punch?.frame ?? 0;
    this.shook = false;
  }

  // Real ms until the animation (plus the pause after it) is over.
  private get duration(): number {
    const k = tune.ko;
    return (this.result?.ko?.style === 'fly' ? k.flyMs + k.sitMs : k.dropMs) + k.resultDelayMs;
  }

  // Whether the result screen may show: no KO animation, or it has finished.
  finished(s: SimState, now: number): boolean {
    if (!s.result?.ko) return true;
    return this.result === s.result && now - this.start >= this.duration;
  }

  // The winner, with its last punch advanced in slow motion.
  winnerView(now: number): Fighter | null {
    const w = this.winner;
    if (!w) return null;
    if (w.punch) {
      const frames = Math.floor(((now - this.start) / 1000) * TICK_RATE * tune.ko.slowmo);
      w.punch.frame = this.winnerFrame0 + frames;
      if (w.punch.frame >= punchTotal(w.punch)) w.punch = null;
    }
    return w;
  }

  draw(now: number): void {
    const g = this.g;
    g.clear();
    const ko = this.result?.ko;
    this.ground.hide();
    if (!ko) return;
    const color = this.colors[ko.loser];
    const el = now - this.start;
    const f = this.loserFighter;
    if (f) {
      const look = this.looks[ko.loser];
      const prefix = f.anchored ? 'dummy' : `${f.char}${look.color !== mainLook(f.char).color ? '_alt' : ''}`;
      const fly = ko.style === 'fly';
      const u = clamp01(el / (fly ? tune.ko.flyMs + tune.ko.sitMs : tune.ko.dropMs));
      if (pose(this.sprite, `${prefix}_ko`, u)) {
        const p = fly ? this.flyPos(el / tune.ko.flyMs) : { x: this.from.x + this.dx * 10 * easeOut(u), y: this.from.y + this.dy * 10 * easeOut(u) };
        const rotation = fly && el < tune.ko.flyMs ? Math.atan2(f.fy, f.fx) + clamp01(el / tune.ko.flyMs) * Math.PI * 1.5 : Math.atan2(-this.dy, -this.dx);
        this.sprite.setPosition(p.x, p.y).setScale(look.scale / 2).setRotation(rotation);
        this.ground.draw(`${prefix}_ko`, u, p.x, p.y, rotation, look.scale, 1);
        if (fly && el >= tune.ko.flyMs && !this.shook) { this.shook = true; this.scene.cameras.main.shake(180, 0.006); }
        return;
      }
    }
    if (ko.style === 'drop') this.drawDrop(el, color);
    else this.drawFly(el, color, now);
  }

  // Furthest point along the blow before the body meets the ropes.
  private ropePoint(p: Pt): Pt {
    const r = tune.ring;
    let t = tune.ko.flyMaxDistance;
    if (this.dx > 0) t = Math.min(t, (r.right - BODY_R - p.x) / this.dx);
    if (this.dx < 0) t = Math.min(t, (r.left + BODY_R - p.x) / this.dx);
    if (this.dy > 0) t = Math.min(t, (r.bottom - BODY_R - p.y) / this.dy);
    if (this.dy < 0) t = Math.min(t, (r.top + BODY_R - p.y) / this.dy);
    t = Math.max(0, t);
    return { x: p.x + this.dx * t, y: p.y + this.dy * t };
  }

  // Flat on their back, head away from the attacker, fists flopped out.
  private drawDrop(el: number, color: number): void {
    const g = this.g;
    const t = easeOut(clamp01(el / tune.ko.dropMs));
    const { dx, dy } = this;
    const c = { x: this.from.x + dx * 10 * t, y: this.from.y + dy * 10 * t };
    const body = lerpColor(color, GREY, 0.6 * t);

    g.fillStyle(0x000000, 0.25 * (1 - t) + 0.15);
    g.fillPoints(ellipse({ x: c.x + 3, y: c.y + 5 }, dx, dy, BODY_R * (1.15 + 0.5 * t), BODY_R), true);
    // Gloves: from guard in front to limp at the sides, arms trailing.
    const gloves: Pt[] = [];
    for (const side of [1, -1]) {
      const fwd = 15 * (1 - t) - 2 * t;
      const out = 12 + 12 * t;
      const x = c.x - dx * fwd + -dy * out * side;
      const y = c.y - dy * fwd + dx * out * side;
      gloves.push({ x, y });
      drawArm(g, c.x - dy * (BODY_R - 3) * side, c.y + dx * (BODY_R - 3) * side, x, y, body, 1);
    }
    const torso = ellipse(c, dx, dy, BODY_R * (1 + 0.45 * t), BODY_R * (1 - 0.1 * t) * 0.85);
    g.fillStyle(muted(body), 1);
    g.fillPoints(torso, true);
    g.lineStyle(2.5, body, 1);
    g.strokePoints(torso, true, true);
    // Helmet tips back away from the attacker, face turned up.
    const headOff = -2 + BODY_R * 1.1 * t;
    drawHelmet(g, c.x + dx * headOff, c.y + dy * headOff, -dx, -dy, body, 1);
    gloves.forEach((q, i) => drawGlove(g, q.x, q.y, -dx, -dy, body, i === 0 ? 1 : -1, 1));
    // Dust puff as they land.
    const d = clamp01((el - tune.ko.dropMs * 0.6) / (tune.ko.dropMs * 0.4));
    if (d > 0 && d < 1) {
      g.lineStyle(3, 0xd8d0c0, 0.5 * (1 - d));
      g.strokeCircle(c.x, c.y, BODY_R * (1.3 + 1.2 * d));
    }
  }

  private flyPos(u: number): Pt {
    const e = easeOut(clamp01(u));
    return { x: this.from.x + (this.to.x - this.from.x) * e, y: this.from.y + (this.to.y - this.from.y) * e };
  }

  // Launched along the blow with a spin and ghost trail, hits the ropes,
  // then slumps sitting against them facing the centre.
  private drawFly(el: number, color: number, now: number): void {
    const g = this.g;
    const k = tune.ko;
    const u = clamp01(el / k.flyMs);
    const v = clamp01((el - k.flyMs) / k.sitMs);
    const { dx, dy } = this;

    if (u < 1) {
      for (let i = 4; i >= 1; i--) {
        const p = this.flyPos(u - i * 0.06);
        g.fillStyle(color, 0.12 * (5 - i) * (1 - u));
        g.fillCircle(p.x, p.y, BODY_R);
      }
      const p = this.flyPos(u);
      const spin = Math.atan2(-dy, -dx) + u * Math.PI * 1.5;
      this.boxer(p, Math.cos(spin), Math.sin(spin), color, 1, 18, 16);
      return;
    }

    if (!this.shook) {
      this.shook = true;
      this.scene.cameras.main.shake(180, 0.006);
    }
    // Rope flash + bulge at the impact point.
    const flash = 1 - clamp01((el - k.flyMs) / 400);
    if (flash > 0) {
      const bx = this.to.x + dx * (BODY_R + 2);
      const by = this.to.y + dy * (BODY_R + 2);
      g.lineStyle(5, 0xffffff, 0.8 * flash);
      g.lineBetween(bx - dy * 34, by + dx * 34, bx + dx * 5 * flash, by + dy * 5 * flash);
      g.lineBetween(bx + dx * 5 * flash, by + dy * 5 * flash, bx + dy * 34, by - dx * 34);
    }
    // Sitting: back to the ropes, facing the centre, head drooping forward,
    // fists resting on the floor at the sides.
    const e = easeOut(v);
    const scale = 1 - 0.15 * e;
    this.boxer(this.to, -dx, -dy, lerpColor(color, GREY, 0.35 * e), scale, 15 + 5 * e, 12 + 10 * e, 3 + 6 * e);
    g.fillStyle(0xffe03a, 1);
    for (let i = 0; i < 3; i++) {
      const a = now / 150 + (i * Math.PI * 2) / 3;
      g.fillCircle(this.to.x + Math.cos(a) * 20, this.to.y - 4 + Math.sin(a) * 8, 3);
    }
  }

  // Body, head and fists facing (fx, fy). headFwd > 0 droops the head forward.
  private boxer(p: Pt, fx: number, fy: number, color: number, scale: number, fistFwd: number, fistOut: number, headFwd = -2): void {
    const g = this.g;
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(p.x + 3, p.y + 5, BODY_R * 2.3 * scale, BODY_R * 2 * scale);
    const gloves: Pt[] = [];
    for (const side of [1, -1]) {
      const x = p.x + fx * fistFwd * scale + fy * fistOut * side * scale;
      const y = p.y + fy * fistFwd * scale - fx * fistOut * side * scale;
      gloves.push({ x, y });
      drawArm(g, p.x + fy * (BODY_R - 3) * side * scale, p.y - fx * (BODY_R - 3) * side * scale, x, y, color, 1);
    }
    drawTorso(g, p.x, p.y, fx, fy, color, 1, scale);
    drawHelmet(g, p.x + fx * headFwd, p.y + fy * headFwd, fx, fy, color, 1, scale);
    gloves.forEach((q, i) => drawGlove(g, q.x, q.y, fx, fy, color, i === 0 ? 1 : -1, 1));
  }
}
