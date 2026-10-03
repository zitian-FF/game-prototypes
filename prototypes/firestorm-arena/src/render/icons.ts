import type Phaser from 'phaser';
import type { NodeKind, SquadType } from 'arena-sim';
import { box, cube, diamond, poly } from './iso';
import { clientTune } from '../clientTune';
import { shade } from '../theme';

type G = Phaser.GameObjects.Graphics;

const DARK = 0x0c1016;

export interface UnitOpts {
  /** Ground shadow under the unit (off for UI icons). */
  shadow?: boolean;
  /** Dust behind ground units, rotor and prop spin. */
  moving?: boolean;
}

/** Pixels from the ground point to the top of the drawn unit, for placing bars and flames. */
export function unitHeight(type: SquadType | 'scout'): number {
  switch (type) {
    case 'tank':
      return 24;
    case 'missile':
      return 28;
    case 'aircraft':
      return 40;
    case 'scout':
      return 46;
  }
}

/**
 * A unit as an upright billboard standing on (x, y), facing right when f is 1 and left when f is -1.
 * Solid colours only: three tones of the team colour (top lit, side, underside), a team-colour outline,
 * an opaque ground shadow and, for flyers, altitude above that shadow.
 */
export function drawUnit(g: G, type: SquadType | 'scout', x: number, y: number, f: number, color: number, t: number, _alpha = 1, o: UnitOpts = {}): void {
  const alpha = 1;
  const moving = o.moving !== false;
  const X = (dx: number) => x + dx * f;
  const mid = shade(color, 0.42);
  const hi = shade(color, 0.8);
  const lo = shade(color, 0.2);
  const metal = 0x161b22;
  const glass = 0x7fd0ff;
  const brown = 0x5a4034;
  const orange = 0xf0a63a;
  const lift = type === 'aircraft' ? 16 : type === 'scout' ? 36 : 0;

  if (o.shadow !== false) {
    const sw = type === 'scout' ? 26 : type === 'aircraft' ? 32 : 38;
    g.fillStyle(0x120f0d, 1).fillEllipse(x, y + 1, sw, lift ? 6 : 9);
  }
  const yy = y - lift;

  const dust = (back: number) => {
    if (!moving) return;
    for (let k = 0; k < 3; k++) {
      const wob = Math.sin(t * 9 + k * 2) * 1.5;
      g.fillStyle([0x6b5f54, 0x574d44, 0x443c35][k], 1).fillCircle(X(back - k * 6), yy - 2 - k * 1.5 + wob, 2.4 + k * 0.6);
    }
  };

  switch (type) {
    case 'tank': {
      dust(-20);
      // tracks and road wheels
      g.fillStyle(metal, 1).fillRoundedRect(x - 17, yy - 8, 34, 9, 4);
      for (let i = -2; i <= 2; i++) {
        g.fillStyle(0x0b0e13, 1).fillCircle(x + i * 6.6, yy - 3.5, 3.4);
        g.fillStyle(hi, 1).fillCircle(x + i * 6.6, yy - 3.5, 1.2);
      }
      // hull: sloped front, lit top plane, team stripe
      poly(g, [[X(-14), yy - 7], [X(16), yy - 7], [X(12), yy - 13], [X(-12), yy - 13]], mid, 1, color, 1.6);
      poly(g, [[X(-12), yy - 13], [X(12), yy - 13], [X(11), yy - 15], [X(-11), yy - 15]], hi, 1);
      poly(g, [[X(-12), yy - 10], [X(12), yy - 10], [X(13), yy - 8.6], [X(-13), yy - 8.6]], color, 1);
      // turret and barrel
      g.fillStyle(mid, 1).fillEllipse(X(-1), yy - 17, 18, 9);
      g.fillStyle(hi, 1).fillEllipse(X(-2), yy - 18.6, 11, 4.5);
      g.lineStyle(1.4, color, 1).strokeEllipse(X(-1), yy - 17, 18, 9);
      poly(g, [[X(6), yy - 18.6], [X(24), yy - 17.6], [X(24), yy - 14.8], [X(6), yy - 15.4]], mid, 1, color, 1);
      g.fillStyle(lo, 1).fillRect(Math.min(X(24), X(27)), yy - 18.4, 3, 4);
      break;
    }
    case 'missile': {
      dust(-21);
      // chassis and wheels
      poly(g, [[X(-18), yy - 7], [X(18), yy - 7], [X(18), yy - 11], [X(-18), yy - 11]], metal, 1, color, 1.4);
      for (const wx of [-12, -2, 12]) {
        g.fillStyle(0x0b0e13, 1).fillCircle(X(wx), yy - 4.5, 4.6);
        g.fillStyle(color, 1).fillCircle(X(wx), yy - 4.5, 1.8);
      }
      // cab with a glass pane
      poly(g, [[X(8), yy - 11], [X(18), yy - 11], [X(18), yy - 19], [X(12), yy - 20], [X(8), yy - 15]], mid, 1, color, 1.4);
      poly(g, [[X(12), yy - 15], [X(17), yy - 15], [X(17), yy - 18.6], [X(13), yy - 19]], glass, 1);
      // rocket pod tilted up toward the front
      const c = Math.cos(-0.52);
      const sn = Math.sin(-0.52);
      const ax = -15;
      const ay = yy - 12;
      const len = 23;
      const hgt = 9;
      const nx = sn;
      const ny = -c;
      const pt = (ux: number, vy: number): number[] => [X(ax + ux * c + vy * nx), ay + ux * sn + vy * ny];
      poly(g, [pt(0, 0), pt(len, 0), pt(len, hgt), pt(0, hgt)], mid, 1, color, 1.4);
      poly(g, [pt(0, hgt), pt(len, hgt), pt(len, hgt - 2.2), pt(0, hgt - 2.2)], hi, 1);
      for (let k = 0; k < 3; k++) {
        const q = pt(len, 1.6 + k * 2.8);
        g.fillStyle(0x05070a, 1).fillCircle(q[0], q[1], 1.3);
      }
      g.lineStyle(1.4, 0xcfd6df, 1).beginPath();
      const tip = pt(len + 4, hgt / 2);
      const base = pt(len, hgt / 2);
      g.moveTo(base[0], base[1]);
      g.lineTo(tip[0], tip[1]);
      g.strokePath();
      break;
    }
    case 'aircraft': {
      // Attack helicopter after the reference art: stubby wings with round engine pods and orange exhausts,
      // a dark canopy, a chin gun, a four-blade brown rotor with orange tips, and a small tail rotor.
      const cy = yy - 6;
      const hubY = cy - 13;
      const bladeLen = 25;
      const spin = moving ? t * 14 : 0.6;
      // Back half of the main rotor (blades pointing away from the viewer) sits behind the body.
      const blade = (k: number, front: boolean) => {
        const th = spin + (k * Math.PI) / 2;
        const sinT = Math.sin(th);
        if (sinT >= 0 !== front) return;
        const bx = Math.cos(th) * bladeLen;
        const by = sinT * bladeLen * 0.3;
        const w = 3.2;
        const nx0 = -Math.sin(th) * 0.3 * w;
        const ny0 = Math.cos(th) * w * 0.5;
        poly(g, [[x + nx0, hubY + ny0], [x + bx + nx0, hubY + by + ny0], [x + bx - nx0, hubY + by - ny0], [x - nx0, hubY - ny0]], brown, 1);
        const tx = x + bx * 0.82;
        const ty = hubY + by * 0.82;
        poly(g, [[tx + nx0, ty + ny0], [x + bx + nx0, hubY + by + ny0], [x + bx - nx0, hubY + by - ny0], [tx - nx0, ty - ny0]], orange, 1);
      };
      for (let k = 0; k < 4; k++) blade(k, false);
      // Tail boom, fin and tail rotor.
      poly(g, [[X(-9), cy - 3], [X(-28), cy - 7], [X(-28), cy - 3], [X(-9), cy + 3]], mid, 1, color, 1.3);
      poly(g, [[X(-24), cy - 6], [X(-28), cy - 16], [X(-32), cy - 15], [X(-29), cy - 4]], hi, 1, color, 1.2);
      const ta = t * 22;
      for (let k = 0; k < 2; k++) {
        const ang = ta + k * Math.PI;
        const ty = cy - 11 + Math.sin(ang) * 5;
        g.lineStyle(2.4, brown, 1).beginPath();
        g.moveTo(X(-31), cy - 11);
        g.lineTo(X(-31 + Math.cos(ang) * 1.5), ty);
        g.strokePath();
        g.fillStyle(orange, 1).fillCircle(X(-31 + Math.cos(ang) * 1.5), ty, 1.3);
      }
      // Rear engine pods with orange exhaust rings.
      for (const [px, py] of [[-10, cy + 3], [-3, cy + 5]] as const) {
        g.fillStyle(mid, 1).fillEllipse(X(px), py, 11, 9);
        g.lineStyle(1.3, color, 1).strokeEllipse(X(px), py, 11, 9);
        g.fillStyle(orange, 1).fillEllipse(X(px - 4.5), py, 4, 7.6);
        g.fillStyle(0xfff3d0, 1).fillEllipse(X(px - 4.8), py, 1.8, 4.2);
      }
      // Fuselage: wedge body, dark belly, canopy, chin gun.
      poly(g, [[X(-12), cy - 4], [X(8), cy - 8], [X(18), cy - 1], [X(14), cy + 7], [X(-8), cy + 8]], mid, 1, color, 1.6);
      poly(g, [[X(-8), cy + 8], [X(14), cy + 7], [X(12), cy + 4], [X(-8), cy + 4]], lo, 1);
      poly(g, [[X(-12), cy - 4], [X(8), cy - 8], [X(10), cy - 6], [X(-10), cy - 2]], hi, 1);
      poly(g, [[X(5), cy - 6], [X(13), cy - 1], [X(9), cy + 2], [X(3), cy - 2]], 0x1b2a38, 1, hi, 1);
      g.fillStyle(0xcfe9ff, 1).fillCircle(X(8), cy - 3, 1);
      g.fillStyle(0x2b2f36, 1).fillCircle(X(17), cy + 3, 3);
      g.lineStyle(2.4, 0x2b2f36, 1).beginPath();
      g.moveTo(X(17), cy + 5);
      g.lineTo(X(25), cy + 9);
      g.strokePath();
      g.fillStyle(orange, 1).fillRect(Math.min(X(24), X(26.4)), cy + 7.6, 2.4, 3);
      // Stub wing with a small pod below the fuselage, so the canopy stays clear.
      poly(g, [[X(-3), cy + 3], [X(6), cy + 2], [X(8), cy + 7], [X(-2), cy + 8]], hi, 1, color, 1.2);
      g.fillStyle(mid, 1).fillEllipse(X(3), cy + 9.5, 9, 5);
      g.lineStyle(1.2, color, 1).strokeEllipse(X(3), cy + 9.5, 9, 5);
      g.fillStyle(orange, 1).fillEllipse(X(-1), cy + 9.5, 2.8, 4.4);
      // Main rotor hub and the front half of the blades.
      g.fillStyle(0x3a2b24, 1).fillEllipse(x, hubY, 12, 6);
      g.fillStyle(brown, 1).fillEllipse(x, hubY - 1, 10, 4);
      for (let k = 0; k < 4; k++) blade(k, true);
      g.fillStyle(0x3a2b24, 1).fillEllipse(x, hubY - 1.5, 8, 3.6);
      g.fillStyle(0x6a5040, 1).fillEllipse(x, hubY - 2.2, 5, 2);
      break;
    }
    case 'scout': {
      // far wing, fuselage, near wing, tail: layered back to front for depth
      poly(g, [[X(-1), yy - 1], [X(-8), yy - 9], [X(-3), yy - 9], [X(5), yy - 1]], lo, 1, color, 1);
      poly(g, [[X(-12), yy], [X(-17), yy - 8], [X(-12), yy - 8], [X(-8), yy]], mid, 1, color, 1.1);
      poly(g, [[X(-15), yy], [X(11), yy - 2.4], [X(18), yy], [X(11), yy + 2.4], [X(-13), yy + 1.6]], mid, 1, color, 1.5);
      g.fillStyle(glass, 1).fillEllipse(X(7), yy - 1.4, 7, 3.6);
      poly(g, [[X(-1), yy + 0.5], [X(-9), yy + 10], [X(-3), yy + 11], [X(7), yy + 1.4]], hi, 1, color, 1.3);
      poly(g, [[X(-2), yy + 3], [X(-6), yy + 8.4], [X(-3), yy + 9], [X(2), yy + 3.4]], mid, 1);
      const pr = moving ? Math.cos(t * 50) : 1;
      g.lineStyle(1.8, 0xcfd6df, 1).beginPath();
      g.moveTo(X(19), yy - 5 * pr);
      g.lineTo(X(19), yy + 5 * pr);
      g.strokePath();
      break;
    }
  }
  void alpha;
}

/** Flickering flames rising from (x, y). `size` ~ 1 for a unit, 2 for an HQ. */
export function drawFlames(g: G, x: number, y: number, t: number, size = 1, seed = 0): void {
  for (let i = 0; i < 4; i++) {
    const ph = t * 9 + i * 1.7 + seed;
    const fx = x + (i - 1.5) * 5 * size + Math.sin(ph) * 1.5;
    const h = (9 + Math.sin(ph * 1.3) * 3.5 + i * 0.6) * size;
    g.fillStyle(0xff4a1c, 1);
    g.fillTriangle(fx - 3.5 * size, y, fx + 3.5 * size, y, fx + Math.sin(ph) * 2, y - h);
    g.fillStyle(0xffc233, 1);
    g.fillTriangle(fx - 2 * size, y, fx + 2 * size, y, fx + Math.sin(ph) * 1.2, y - h * 0.62);
  }
}

/** Icon floating above a node's cube stack, in white with a dark outline. */
export function drawNodeIcon(g: G, kind: NodeKind, x: number, y: number, s = 1): void {
  const line = (w: number, c: number) => g.lineStyle(w * s, c, 1);
  const stroke = (draw: () => void) => {
    line(4, 0x000000);
    draw();
    line(2, 0xffffff);
    draw();
  };
  switch (kind) {
    case 'points':
      stroke(() => {
        g.beginPath();
        g.moveTo(x, y - 8 * s);
        g.lineTo(x + 7 * s, y);
        g.lineTo(x, y + 8 * s);
        g.lineTo(x - 7 * s, y);
        g.closePath();
        g.strokePath();
      });
      g.fillStyle(0xffd54a, 1).fillCircle(x, y, 3 * s);
      break;
    case 'attackBoost': // sword
      stroke(() => {
        g.beginPath();
        g.moveTo(x - 6 * s, y + 7 * s);
        g.lineTo(x + 6 * s, y - 7 * s);
        g.moveTo(x - 6 * s, y - 1 * s);
        g.lineTo(x + 1 * s, y + 6 * s);
        g.strokePath();
      });
      break;
    case 'defenseBoost': // shield
      stroke(() => {
        g.beginPath();
        g.moveTo(x - 6 * s, y - 6 * s);
        g.lineTo(x + 6 * s, y - 6 * s);
        g.lineTo(x + 6 * s, y + 1 * s);
        g.lineTo(x, y + 8 * s);
        g.lineTo(x - 6 * s, y + 1 * s);
        g.closePath();
        g.strokePath();
      });
      break;
    case 'speedBoost': // double chevron
      stroke(() => {
        g.beginPath();
        g.moveTo(x - 7 * s, y - 6 * s);
        g.lineTo(x - 1 * s, y);
        g.lineTo(x - 7 * s, y + 6 * s);
        g.moveTo(x + 1 * s, y - 6 * s);
        g.lineTo(x + 7 * s, y);
        g.lineTo(x + 1 * s, y + 6 * s);
        g.strokePath();
      });
      break;
    case 'teleportCooldown': // clock
      stroke(() => {
        g.strokeCircle(x, y, 7 * s);
        g.beginPath();
        g.moveTo(x, y - 5 * s);
        g.lineTo(x, y);
        g.lineTo(x + 4 * s, y + 2 * s);
        g.strokePath();
      });
      break;
    case 'largeVision': // eye
      stroke(() => {
        g.beginPath();
        g.moveTo(x - 9 * s, y);
        g.lineTo(x - 4 * s, y - 5 * s);
        g.lineTo(x + 4 * s, y - 5 * s);
        g.lineTo(x + 9 * s, y);
        g.lineTo(x + 4 * s, y + 5 * s);
        g.lineTo(x - 4 * s, y + 5 * s);
        g.closePath();
        g.strokePath();
        g.strokeCircle(x, y, 2.4 * s);
      });
      break;
    case 'hospital':
      drawCross(g, x, y, s);
      break;
    case 'turret': // cannon
      stroke(() => {
        g.strokeCircle(x - 2 * s, y + 2 * s, 5 * s);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 9 * s, y - 6 * s);
        g.strokePath();
      });
      break;
  }
}

/** A node: a stack of `tier` cubes, each a step smaller than the last. */
export function drawNodeStack(g: G, cx: number, cy: number, tier: number, color: number, hw: number, alpha = 1): number {
  const ch = clientTune.iso.cubeHeight;
  let lift = 0;
  for (let i = 0; i < tier; i++) {
    const w = hw * (1 - i * 0.16);
    cube(g, cx, cy, w, ch, lift, i % 2 === 0 ? color : shade(color, 1.18), alpha);
    lift += ch;
  }
  return lift;
}

/**
 * An HQ in the style of the reference art: a concrete pad with hazard stripes, a stepped beige building with
 * team-colour roofs, a rooftop cannon, an antenna with a red tip and a team flag. `hw` is the pad half-width.
 */
export function drawHq(g: G, cx: number, cy: number, color: number, hw: number, alpha = 1, t = 0): void {
  const s = hw / 26;
  const wall = 0xd9c9a3;
  const concrete = 0x8c8a86;
  // Pad: a low concrete slab.
  box(g, cx, cy, 28 * s, 5 * s, 0, concrete, shade(concrete, 1.15), alpha);
  // Hazard stripes on the two front faces of the pad, following the bottom edge of each face.
  const padHw = 28 * s;
  const rightBottom = (x: number) => cy + (padHw / 2) * (1 - (x - cx) / padHw);
  const leftBottom = (x: number) => cy + (padHw / 2) * ((x - (cx - padHw)) / padHw);
  const stripe = (x0: number, bottom: (x: number) => number) => {
    const x1 = x0 + 3 * s;
    poly(g, [[x0, bottom(x0)], [x1, bottom(x1)], [x1, bottom(x1) - 4.4 * s], [x0, bottom(x0) - 4.4 * s]], 0x1c1a17, alpha);
    poly(g, [[x1 + 1.2 * s, bottom(x1 + 1.2 * s)], [x1 + 3.2 * s, bottom(x1 + 3.2 * s)], [x1 + 3.2 * s, bottom(x1 + 3.2 * s) - 4.4 * s], [x1 + 1.2 * s, bottom(x1 + 1.2 * s) - 4.4 * s]], 0xf0b53a, alpha);
  };
  stripe(cx + 11 * s, rightBottom);
  stripe(cx + 19 * s, rightBottom);
  stripe(cx - 21 * s, leftBottom);
  stripe(cx - 13 * s, leftBottom);
  // Main tower at the back, with a team-colour roof and the rooftop cannon.
  box(g, cx, cy - 3 * s, 13 * s, 26 * s, 5 * s, wall, color, alpha);
  const roofY = cy - 3 * s - 31 * s;
  box(g, cx - 4.5 * s, roofY + 3 * s, 3.4 * s, 9 * s, 0, shade(color, 0.9), shade(color, 1.1), alpha);
  box(g, cx + 4.5 * s, roofY + 1 * s, 3.4 * s, 9 * s, 0, shade(color, 0.9), shade(color, 1.1), alpha);
  g.lineStyle(3 * s, 0x7d8794, alpha).beginPath();
  g.moveTo(cx - 3 * s, roofY - 3 * s);
  g.lineTo(cx - 11 * s, roofY + 2 * s);
  g.strokePath();
  g.fillStyle(0x4a525c, alpha).fillCircle(cx - 11 * s, roofY + 2 * s, 2.2 * s);
  // Wings step down on both sides, front block in the middle with the blue door.
  box(g, cx - 14 * s, cy + 3 * s, 9 * s, 13 * s, 5 * s, wall, color, alpha);
  box(g, cx + 14 * s, cy + 1 * s, 9 * s, 16 * s, 5 * s, wall, color, alpha);
  box(g, cx, cy + 9 * s, 8 * s, 9 * s, 5 * s, wall, shade(color, 1.05), alpha);
  const doorBottom = (x: number) => cy + 9 * s - 5 * s + (8 * s / 2) * ((x - (cx - 8 * s)) / (8 * s));
  const d1 = cx - 6 * s;
  const d2 = cx - 2.2 * s;
  poly(g, [[d1, doorBottom(d1)], [d2, doorBottom(d2)], [d2, doorBottom(d2) - 6.5 * s], [d1, doorBottom(d1) - 6.5 * s]], shade(color, 0.7), alpha);
  // Antenna with a red tip, back right.
  g.lineStyle(2.4 * s, 0x6b727d, alpha).beginPath();
  g.moveTo(cx + 22 * s, cy - 6 * s);
  g.lineTo(cx + 22 * s, cy - 36 * s);
  g.strokePath();
  g.fillStyle(0xe34b3a, alpha).fillRect(cx + 20.4 * s, cy - 44 * s, 3.2 * s, 9 * s);
  // Flag: a pole with a gold base and a team-colour banner that ripples.
  const fx = cx - 30 * s;
  const fy = cy + 7 * s;
  g.lineStyle(2 * s, 0xc9c2b0, alpha).beginPath();
  g.moveTo(fx, fy);
  g.lineTo(fx, fy - 30 * s);
  g.strokePath();
  g.fillStyle(0xf0b53a, alpha).fillCircle(fx, fy, 2.6 * s);
  const w = Math.sin(t * 4) * 1.4 * s;
  poly(g, [[fx, fy - 30 * s], [fx + 12 * s, fy - 28.6 * s + w], [fx + 12 * s, fy - 22 * s + w], [fx, fy - 23 * s]], color, alpha);
  poly(g, [[fx, fy - 27 * s], [fx + 12 * s, fy - 26 * s + w], [fx + 12 * s, fy - 24.6 * s + w], [fx, fy - 25.6 * s]], shade(color, 0.6), alpha);
}

/** Hospital icon: a white cross. */
export function drawCross(g: G, x: number, y: number, s = 1): void {
  for (const [w, c] of [[6, 0x000000], [3.4, 0xffffff]] as const) {
    g.lineStyle(w * s, c, 1);
    g.beginPath();
    g.moveTo(x - 7 * s, y);
    g.lineTo(x + 7 * s, y);
    g.moveTo(x, y - 7 * s);
    g.lineTo(x, y + 7 * s);
    g.strokePath();
  }
  g.fillStyle(0xff4a4a, 1).fillRect(x - 1.7 * s, y - 5 * s, 3.4 * s, 10 * s).fillRect(x - 5 * s, y - 1.7 * s, 10 * s, 3.4 * s);
}

/** Small crossed-sword mark for Power values. */
export function drawPowerSword(g: G, x: number, y: number, color = 0xffd54a): void {
  g.lineStyle(2, color, 1);
  g.beginPath();
  g.moveTo(x - 4, y + 5);
  g.lineTo(x + 5, y - 5);
  g.moveTo(x - 4, y + 1);
  g.lineTo(x - 1, y + 4);
  g.strokePath();
}

/** Nuclear silo: a round concrete cylinder with a hatch and four anti-aircraft towers on the corners. */
export function drawSilo(g: G, cx: number, cy: number, color: number, hw: number, alpha = 1): void {
  const hh = hw / 2;
  // Base pad
  diamond(g, cx, cy, hw * 1.15, hh * 1.15, shade(color, 0.3), alpha, color, 2);
  // Four AA towers on the corners: thin stalks with a twin-barrel head
  const corners = [
    [-hw * 0.82, 0],
    [hw * 0.82, 0],
    [0, -hh * 0.82],
    [0, hh * 0.82],
  ];
  const towers = (front: boolean) => {
    for (const [dx, dy] of corners) {
      if ((dy > 0 || (dy === 0 && false)) !== front) continue;
      const tx = cx + dx;
      const ty = cy + dy;
      g.lineStyle(3, shade(color, 0.7), alpha);
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx, ty - 16);
      g.strokePath();
      g.fillStyle(shade(color, 1.1), alpha).fillCircle(tx, ty - 17, 3.4);
      g.lineStyle(2, 0xffffff, alpha);
      g.beginPath();
      g.moveTo(tx, ty - 18);
      g.lineTo(tx + 7, ty - 26);
      g.moveTo(tx + 2, ty - 17);
      g.lineTo(tx + 9, ty - 24);
      g.strokePath();
    }
  };
  towers(false);
  // Cylinder body: two ellipses joined by straight sides
  const r = hw * 0.62;
  const h = 26;
  g.fillStyle(shade(color, 0.55), alpha);
  g.fillRect(cx - r, cy - h, r * 2, h);
  g.fillEllipse(cx, cy, r * 2, r);
  g.lineStyle(1, 0x000000, alpha);
  g.strokeEllipse(cx, cy, r * 2, r);
  g.fillStyle(shade(color, 1.05), alpha);
  g.fillEllipse(cx, cy - h, r * 2, r);
  g.lineStyle(1.5, 0x000000, alpha);
  g.strokeEllipse(cx, cy - h, r * 2, r);
  // Split hatch and warning stripe
  g.fillStyle(0x1a1f26, alpha).fillEllipse(cx, cy - h, r * 1.45, r * 0.72);
  g.lineStyle(2, 0xffd54a, alpha);
  g.beginPath();
  g.moveTo(cx, cy - h - r * 0.36);
  g.lineTo(cx, cy - h + r * 0.36);
  g.strokePath();
  g.fillStyle(0xffd54a, alpha).fillRect(cx - r, cy - 9, r * 2, 3);
  towers(true);
}

/**
 * Oil refinery in the style of the reference art: two big domed storage tanks with glowing green tops and
 * team-colour clamps on a machinery base, with a small side tank and glowing vents.
 */
export function drawRefinery(g: G, cx: number, cy: number, color: number, hw: number, t: number, alpha = 1): void {
  const s = hw / 27;
  const pad = 0x464b54;
  box(g, cx, cy, 29 * s, 5 * s, 0, pad, shade(pad, 1.25), alpha, shade(color, 0.6));
  const glow = 0.55 + 0.45 * Math.sin(t * 2.2);
  // Pulse by colour, not by transparency.
  const glowColor = glow > 0.8 ? 0x9dff7a : glow > 0.55 ? 0x7dff6a : 0x4fcf44;
  const coreColor = glow > 0.7 ? 0xf0ffe6 : 0xc8f5b8;
  const tank = (x: number, y: number, r: number, h: number, hh: number) => {
    // body in three vertical bands for roundness, base ellipse, top ring with a glowing core
    g.fillStyle(0x8d95a1, alpha).fillEllipse(x, y, r * 2, r);
    g.fillStyle(0xd7dce3, alpha).fillRect(x - r, y - h, r * 0.7, h);
    g.fillStyle(0xbcc3cd, alpha).fillRect(x - r * 0.3, y - h, r * 1.0, h);
    g.fillStyle(0x949ca8, alpha).fillRect(x + r * 0.7, y - h, r * 0.3, h);
    g.fillStyle(0x7e8793, alpha).fillRect(x + r * 0.7, y - h, r * 0.3, h);
    g.fillStyle(0xbcc3cd, alpha).fillEllipse(x, y, r * 2, r);
    g.fillStyle(0xd7dce3, alpha).fillRect(x - r, y - h, r * 1.0, h);
    g.fillStyle(0xbcc3cd, alpha).fillRect(x, y - h, r * 0.8, h);
    g.fillStyle(0x949ca8, alpha).fillRect(x + r * 0.8, y - h, r * 0.2, h);
    g.fillStyle(0xbcc3cd, alpha).fillEllipse(x, y, r * 2, r);
    g.fillStyle(0x6b727d, alpha).fillEllipse(x, y - h, r * 2, r);
    g.lineStyle(1, 0x30353c, alpha).strokeEllipse(x, y - h, r * 2, r);
    g.fillStyle(0x23382a, alpha).fillEllipse(x, y - h, r * 1.45, r * 0.72);
    g.fillStyle(glowColor, alpha).fillEllipse(x, y - h, r * 0.95, r * 0.46);
    g.fillStyle(coreColor, alpha).fillEllipse(x, y - h, r * 0.4, r * 0.2);
    // team-colour clamps down the sides
    g.fillStyle(color, alpha).fillRect(x - r - 0.8 * s, y - h + 3 * s, 3 * s, h - 5 * s);
    g.fillStyle(shade(color, 0.6), alpha).fillRect(x + r - 2 * s, y - h + 3 * s, 3 * s, h - 5 * s);
    void hh;
  };
  // Side tank and the two main tanks, back to front.
  g.fillStyle(0x6d6a74, alpha).fillEllipse(cx - 24 * s, cy - 2 * s, 11 * s, 5.5 * s).fillRect(cx - 29.5 * s, cy - 10 * s, 11 * s, 8 * s);
  g.fillStyle(0x8b8794, alpha).fillEllipse(cx - 24 * s, cy - 10 * s, 11 * s, 5.5 * s);
  tank(cx - 8 * s, cy - 3 * s, 11 * s, 34 * s, 0);
  tank(cx + 11 * s, cy + 5 * s, 12 * s, 28 * s, 0);
  // Machinery base in front with glowing vents, and a pipe between the tanks.
  box(g, cx - 14 * s, cy + 12 * s, 9 * s, 8 * s, 5 * s, 0x6a717c, color, alpha);
  g.fillStyle(glowColor, alpha).fillRect(cx + 21 * s, cy + 3 * s, 6 * s, 2 * s).fillRect(cx + 21 * s, cy + 7 * s, 6 * s, 2 * s);
  g.lineStyle(2.4 * s, 0x39414b, alpha).beginPath();
  g.moveTo(cx - 6 * s, cy + 6 * s);
  g.lineTo(cx + 6 * s, cy + 14 * s);
  g.strokePath();
}
