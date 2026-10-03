import type Phaser from 'phaser';
import type { NodeKind, SquadType } from 'arena-sim';
import { clientTune } from '../clientTune';
import { shade } from '../theme';

type G = Phaser.GameObjects.Graphics;
type Pt = number[];

/**
 * Every piece of art uses exactly two stroke widths: a thick OUTLINE around the whole silhouette and a thin
 * DETAIL line between the parts inside it. Solid colours only, no transparency.
 */
export const OUTLINE = 2.5;
export const DETAIL = 1;

/** Line-width compensation while a scaled transform is active, so scaled art keeps the same two stroke widths. */
let lineK = 1;

interface Part {
  fill: number;
  poly?: Pt[];
  ell?: [number, number, number, number];
  /** Inside another part: it adds detail but never changes the silhouette. */
  inner: boolean;
}

/**
 * Collects parts back to front, then draws them in two passes: all parts as a team-colour underlay stroked
 * at twice OUTLINE (so only the outer half survives as the silhouette), then every fill with a thin DETAIL
 * edge in a darker shade of its own colour.
 */
class Art {
  private parts: Part[] = [];

  constructor(
    private g: G,
    private outline: number,
  ) {}

  poly(pts: Pt[], fill: number, inner = false): this {
    this.parts.push({ fill, poly: pts, inner });
    return this;
  }

  quad(x0: number, y0: number, x1: number, y1: number, fill: number, inner = false): this {
    return this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fill, inner);
  }

  ell(cx: number, cy: number, w: number, h: number, fill: number, inner = false): this {
    this.parts.push({ fill, ell: [cx, cy, w, h], inner });
    return this;
  }

  circ(cx: number, cy: number, r: number, fill: number, inner = false): this {
    return this.ell(cx, cy, r * 2, r * 2, fill, inner);
  }

  /** An isometric box on the diamond at (cx, cy): walls shaded left and right, lit roof. */
  box(cx: number, cy: number, hw: number, h: number, lift: number, wall: number, roof: number): this {
    const hh = hw / 2;
    const by = cy - lift;
    const ty = by - h;
    this.poly([[cx - hw, by], [cx, by + hh], [cx, ty + hh], [cx - hw, ty]], shade(wall, 0.82));
    this.poly([[cx + hw, by], [cx, by + hh], [cx, ty + hh], [cx + hw, ty]], shade(wall, 0.58));
    this.poly([[cx, ty - hh], [cx + hw, ty], [cx, ty + hh], [cx - hw, ty]], roof);
    return this;
  }

  draw(): void {
    const g = this.g;
    for (const p of this.parts) {
      if (p.inner) continue;
      g.fillStyle(this.outline, 1);
      g.lineStyle(OUTLINE * 2 * lineK, this.outline, 1);
      this.path(p, true);
    }
    for (const p of this.parts) {
      g.fillStyle(p.fill, 1);
      g.lineStyle(DETAIL * lineK, shade(p.fill, 0.5), 1);
      this.path(p, false);
      this.path(p, true);
    }
  }

  private path(p: Part, fill: boolean): void {
    const g = this.g;
    if (p.ell) {
      const [x, y, w, h] = p.ell;
      if (fill) g.fillEllipse(x, y, w, h);
      else g.strokeEllipse(x, y, w, h);
      return;
    }
    const pts = p.poly!;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    if (fill) g.fillPath();
    else g.strokePath();
  }
}

const DARK = 0x0c1016;
void DARK;

export interface UnitOpts {
  /** Ground shadow under the unit (off for UI icons). */
  shadow?: boolean;
  /** Dust behind ground units, rotor and prop spin. */
  moving?: boolean;
  /** Draw the unit at this fraction of its size (world units are smaller than buildings). */
  scale?: number;
}

/** Pixels from the ground point to the top of the drawn unit, for placing bars and flames. */
export function unitHeight(type: SquadType | 'scout'): number {
  switch (type) {
    case 'tank':
      return 30;
    case 'missile':
      return 34;
    case 'aircraft':
      return 40;
    case 'scout':
      return 46;
  }
}

/**
 * A unit as an upright billboard standing on (x, y), facing right when f is 1 and left when f is -1.
 * Tank and missile truck follow the reference models; the helicopter follows its own reference.
 */
export function drawUnit(g: G, type: SquadType | 'scout', x: number, y: number, f: number, color: number, t: number, _alpha = 1, o: UnitOpts = {}): void {
  if (o.scale !== undefined && o.scale !== 1) {
    // Draw at the origin under a scale transform, with line widths compensated so the strokes stay the same.
    const k = o.scale;
    g.save();
    g.translateCanvas(x, y);
    g.scaleCanvas(k, k);
    const prev = lineK;
    lineK = 1 / k;
    drawUnit(g, type, 0, 0, f, color, t, _alpha, { ...o, scale: 1 });
    lineK = prev;
    g.restore();
    return;
  }
  const moving = o.moving !== false;
  const X = (dx: number) => x + dx * f;
  const P = (dx: number, dy: number): Pt => [X(dx), dy];
  const body = shade(color, 0.6);
  const light = shade(color, 0.9);
  const dark = shade(color, 0.34);
  const steel = 0x8a93a0;
  const gun = 0x3a3f47;
  const glass = 0x1b2a38;
  const brown = 0x5a4034;
  const orange = 0xf0a63a;
  const lift = type === 'aircraft' ? 16 : type === 'scout' ? 36 : 0;
  const art = new Art(g, color);

  if (o.shadow !== false) {
    const sw = type === 'scout' ? 26 : type === 'aircraft' ? 32 : 40;
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
      dust(-22);
      // Back module with two antennas.
      art.quad(X(-11.8), yy - 27, X(-10.2), yy - 19, shade(color, 0.45));
      art.quad(X(-3.8), yy - 26, X(-2.2), yy - 19, shade(color, 0.45));
      art.ell(X(-8), yy - 20, 15, 9, light);
      art.ell(X(-14.5), yy - 20, 4, 8, dark);
      // Tracks and wheels.
      art.poly([P(-18, yy), P(18, yy), P(18, yy - 6), P(-18, yy - 6)], gun);
      for (const wx of [-12, -4, 4, 12]) art.circ(X(wx), yy - 3.2, 3.2, 0x232830).circ(X(wx), yy - 3.2, 1.2, steel, true);
      // Hull with heavy side skirts, rear box and top deck.
      art.poly([P(-19, yy - 5), P(19, yy - 5), P(21, yy - 12), P(-17, yy - 13)], body);
      art.poly([P(-16, yy - 5.5), P(17, yy - 5.5), P(18, yy - 11), P(-15, yy - 11.5)], light, true);
      art.quad(X(0.4), yy - 11, X(1.4), yy - 6, dark, true);
      art.quad(X(-8.4), yy - 11, X(-7.4), yy - 6, dark, true);
      art.poly([P(-20, yy - 6), P(-13, yy - 6), P(-13, yy - 14), P(-20, yy - 14)], body);
      art.poly([P(-15, yy - 12), P(17, yy - 12), P(14, yy - 17), P(-13, yy - 18)], light);
      // Turret: faceted block, lit front plate with three light slashes, red sensor.
      art.poly([P(-9, yy - 16), P(9, yy - 16), P(11, yy - 22), P(6, yy - 27), P(-6, yy - 27), P(-10, yy - 22)], body);
      art.poly([P(2, yy - 16), P(11, yy - 17), P(12, yy - 23), P(4, yy - 25)], light);
      for (let k = 0; k < 3; k++) art.poly([P(4.2 + k * 2.3, yy - 18.4 - k * 0.2), P(5.2 + k * 2.3, yy - 18.4 - k * 0.2), P(5.2 + k * 2.3, yy - 21.4 - k * 0.2), P(4.2 + k * 2.3, yy - 21.4 - k * 0.2)], 0xe8edf2, true);
      art.quad(X(-2.5), yy - 29, X(2.5), yy - 27, 0xd64545);
      // Mantlet, thick barrel and muzzle brake.
      art.poly([P(7, yy - 24), P(12, yy - 24), P(12, yy - 16), P(7, yy - 17)], steel);
      art.poly([P(11, yy - 21.5), P(26, yy - 20.5), P(26, yy - 16.5), P(11, yy - 17.5)], gun);
      art.poly([P(25, yy - 22.2), P(31, yy - 22.2), P(31, yy - 15.8), P(25, yy - 15.8)], shade(gun, 0.8));
      break;
    }
    case 'missile': {
      dust(-23);
      // Chassis, then three big wheels on the side.
      art.poly([P(-22, yy - 6), P(22, yy - 6), P(22, yy - 12), P(-22, yy - 12)], shade(steel, 0.8));
      // Cab with a wide dark windscreen, hood and amber headlight.
      art.poly([P(8, yy - 12), P(22, yy - 12), P(22, yy - 18), P(17, yy - 25), P(8, yy - 25)], body);
      art.poly([P(11, yy - 18.5), P(21, yy - 18.5), P(18, yy - 24), P(11.5, yy - 24)], glass, true);
      art.poly([P(18, yy - 12), P(25, yy - 12), P(25, yy - 17), P(21, yy - 17)], light);
      art.circ(X(25), yy - 14.4, 1.8, 0xf6b36b, true);
      // Launcher cradle.
      art.poly([P(-20, yy - 12), P(6, yy - 12), P(6, yy - 17), P(-20, yy - 17)], light);
      art.poly([P(-15, yy - 17), P(-3, yy - 17), P(-5, yy - 21), P(-13, yy - 21)], shade(steel, 0.9));
      for (const wx of [-15, -3, 12]) art.circ(X(wx), yy - 5.2, 5.2, 0x232830).circ(X(wx), yy - 5.2, 2.2, steel, true);
      // Three tan rockets with red nose cones and fins, fanned up toward the front (back one first).
      const c = Math.cos(-0.46);
      const s = Math.sin(-0.46);
      for (let k = 2; k >= 0; k--) {
        const ox = -17 + k * 3.2;
        const oy = yy - 19 - k * 3.6;
        const at = (ux: number, vy: number): Pt => [X(ox + ux * c + vy * s), oy + ux * s - vy * c];
        art.poly([at(-1, -2.6), at(21, -2.6), at(21, 2.6), at(-1, 2.6)], 0xc9a35f);
        art.poly([at(21, -2.6), at(29, 0), at(21, 2.6)], 0xc73c3c);
        art.poly([at(-1, 2.6), at(-1, 6), at(4, 2.6)], 0xc73c3c);
        art.poly([at(-1, -2.6), at(-1, -6), at(4, -2.6)], 0xc73c3c);
      }
      break;
    }
    case 'aircraft': {
      // Attack helicopter after the reference: round engine pods with orange exhausts, dark canopy, chin gun,
      // four-blade brown rotor with orange tips, small tail rotor.
      const cy = yy - 6;
      const hubY = cy - 13;
      const bladeLen = 25;
      const spin = moving ? t * 14 : 0.6;
      const blade = (k: number, front: boolean) => {
        const th = spin + (k * Math.PI) / 2;
        const sinT = Math.sin(th);
        if (sinT >= 0 !== front) return;
        const bx = Math.cos(th) * bladeLen;
        const by = sinT * bladeLen * 0.3;
        const w = 3.2;
        const nx0 = -Math.sin(th) * 0.3 * w;
        const ny0 = Math.cos(th) * w * 0.5;
        art.poly([[x + nx0, hubY + ny0], [x + bx + nx0, hubY + by + ny0], [x + bx - nx0, hubY + by - ny0], [x - nx0, hubY - ny0]], brown);
        const tx = x + bx * 0.82;
        const ty = hubY + by * 0.82;
        art.poly([[tx + nx0, ty + ny0], [x + bx + nx0, hubY + by + ny0], [x + bx - nx0, hubY + by - ny0], [tx - nx0, ty - ny0]], orange);
      };
      for (let k = 0; k < 4; k++) blade(k, false);
      art.poly([P(-9, cy - 3), P(-28, cy - 7), P(-28, cy - 3), P(-9, cy + 3)], body);
      art.poly([P(-24, cy - 6), P(-28, cy - 16), P(-32, cy - 15), P(-29, cy - 4)], light);
      const ta = t * 22;
      for (let k = 0; k < 2; k++) {
        const ang = ta + k * Math.PI;
        const ty = cy - 11 + Math.sin(ang) * 5;
        art.poly([P(-31.6, cy - 11), P(-30.4, cy - 11), P(-30.4 + Math.cos(ang) * 1.5, ty), P(-31.6 + Math.cos(ang) * 1.5, ty)], brown);
        art.circ(X(-31 + Math.cos(ang) * 1.5), ty, 1.3, orange);
      }
      for (const [px, py] of [[-10, cy + 3], [-3, cy + 5]] as const) {
        art.ell(X(px), py, 11, 9, body);
        art.ell(X(px - 4.5), py, 4, 7.6, orange, true);
        art.ell(X(px - 4.8), py, 1.8, 4.2, 0xfff3d0, true);
      }
      art.poly([P(-12, cy - 4), P(8, cy - 8), P(18, cy - 1), P(14, cy + 7), P(-8, cy + 8)], body);
      art.poly([P(-8, cy + 8), P(14, cy + 7), P(12, cy + 4), P(-8, cy + 4)], dark, true);
      art.poly([P(-12, cy - 4), P(8, cy - 8), P(10, cy - 6), P(-10, cy - 2)], light, true);
      art.poly([P(5, cy - 6), P(13, cy - 1), P(9, cy + 2), P(3, cy - 2)], glass, true);
      art.circ(X(17), cy + 3, 3, gun);
      art.poly([P(17, cy + 4), P(25, cy + 7.6), P(25, cy + 10.4), P(17, cy + 6.6)], gun);
      art.quad(X(24), cy + 7, X(26.4), cy + 11, orange);
      art.poly([P(-3, cy + 3), P(6, cy + 2), P(8, cy + 7), P(-2, cy + 8)], light);
      art.ell(X(3), cy + 9.5, 9, 5, body);
      art.ell(X(-1), cy + 9.5, 2.8, 4.4, orange, true);
      art.ell(x, hubY, 12, 6, 0x3a2b24);
      for (let k = 0; k < 4; k++) blade(k, true);
      art.ell(x, hubY - 1.5, 8, 3.6, 0x3a2b24).ell(x, hubY - 2.2, 5, 2, 0x6a5040, true);
      break;
    }
    case 'scout': {
      art.poly([P(-1, yy - 1), P(-8, yy - 9), P(-3, yy - 9), P(5, yy - 1)], dark);
      art.poly([P(-12, yy), P(-17, yy - 8), P(-12, yy - 8), P(-8, yy)], body);
      art.poly([P(-15, yy), P(11, yy - 2.4), P(18, yy), P(11, yy + 2.4), P(-13, yy + 1.6)], body);
      art.ell(X(7), yy - 1.4, 7, 3.6, glass, true);
      art.poly([P(-1, yy + 0.5), P(-9, yy + 10), P(-3, yy + 11), P(7, yy + 1.4)], light);
      art.poly([P(-2, yy + 3), P(-6, yy + 8.4), P(-3, yy + 9), P(2, yy + 3.4)], body, true);
      const pr = moving ? Math.cos(t * 50) : 1;
      art.poly([P(18.6, yy - 5 * pr), P(19.8, yy - 5 * pr), P(19.8, yy + 5 * pr), P(18.6, yy + 5 * pr)], 0xcfd6df);
      break;
    }
  }
  art.draw();
}

/** Flickering flames rising from (x, y). `size` ~ 1 for a unit, 2 for an HQ. Solid colours. */
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

/** White line glyphs for node kinds, floating above the node. All strokes are OUTLINE wide. */
export function drawNodeIcon(g: G, kind: NodeKind, x: number, y: number, s = 1): void {
  const stroke = (draw: () => void) => {
    g.lineStyle(OUTLINE, 0xffffff, 1);
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
      });
      g.fillStyle(0xffffff, 1).fillCircle(x, y, 2.4 * s);
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

/** A node: a stack of `tier` cubes, each a step smaller than the last, with one thick outline around it all. */
export function drawNodeStack(g: G, cx: number, cy: number, tier: number, color: number, hw: number, _alpha = 1): number {
  const ch = clientTune.iso.cubeHeight;
  const art = new Art(g, shade(color, 1.35));
  let lift = 0;
  for (let i = 0; i < tier; i++) {
    const w = hw * (1 - i * 0.16);
    const c = i % 2 === 0 ? color : shade(color, 1.18);
    art.box(cx, cy, w, ch, lift, shade(c, 0.78), c);
    lift += ch;
  }
  art.draw();
  return lift;
}

/**
 * The player HQ: deliberately smaller and plainer than a node. A concrete pad, one tower with a team-colour
 * roof and a small cannon, a lower side block and a flag. `hw` is the pad half-width.
 */
export function drawHq(g: G, cx: number, cy: number, color: number, hw: number, _alpha = 1, t = 0): void {
  const s = hw / 26;
  const wall = 0xd9c9a3;
  const concrete = 0x8c8a86;
  const art = new Art(g, color);
  art.box(cx, cy, 28 * s, 4 * s, 0, concrete, shade(concrete, 1.15));
  art.box(cx + 3 * s, cy - 2 * s, 13 * s, 20 * s, 4 * s, wall, color);
  art.box(cx - 14 * s, cy + 4 * s, 9 * s, 10 * s, 4 * s, wall, color);
  // Roof cannon: a small slab and a barrel.
  const roofY = cy - 2 * s - 24 * s;
  art.box(cx + 3 * s, roofY + 2 * s, 4 * s, 5 * s, 0, shade(color, 0.9), shade(color, 1.1));
  art.poly([[cx + 1 * s, roofY - 2 * s], [cx - 8 * s, roofY + 1 * s], [cx - 8 * s, roofY + 3 * s], [cx + 1 * s, roofY + 0.5 * s]], 0x5d6672);
  // Flag.
  const fx = cx - 27 * s;
  const fy = cy + 5 * s;
  art.quad(fx - 0.8 * s, fy - 24 * s, fx + 0.8 * s, fy, 0xc9c2b0);
  const w = Math.sin(t * 4) * 1.2 * s;
  art.poly([[fx, fy - 24 * s], [fx + 10 * s, fy - 23 * s + w], [fx + 10 * s, fy - 17 * s + w], [fx, fy - 18 * s]], color);
  art.draw();
}

/** Hospital icon: a red cross on white. */
export function drawCross(g: G, x: number, y: number, s = 1): void {
  g.fillStyle(0xffffff, 1).fillRect(x - 8 * s, y - 8 * s, 16 * s, 16 * s);
  g.lineStyle(OUTLINE, 0xffffff, 1).strokeRect(x - 8 * s, y - 8 * s, 16 * s, 16 * s);
  g.fillStyle(0xe03b3b, 1).fillRect(x - 2 * s, y - 6 * s, 4 * s, 12 * s).fillRect(x - 6 * s, y - 2 * s, 12 * s, 4 * s);
}

/** Small sword mark for Power values. */
export function drawPowerSword(g: G, x: number, y: number, color = 0xffd54a): void {
  g.lineStyle(OUTLINE, color, 1);
  g.beginPath();
  g.moveTo(x - 4, y + 5);
  g.lineTo(x + 5, y - 5);
  g.moveTo(x - 4, y + 1);
  g.lineTo(x - 1, y + 4);
  g.strokePath();
}

/**
 * Nuclear silo after the reference art: a flat armoured hex pad with hazard-yellow bays, a raised ring with
 * team-colour clamps, a central launch bore with the warhead tip showing, and four anti-aircraft towers.
 */
export function drawSilo(g: G, cx: number, cy: number, color: number, hw: number, _alpha = 1): void {
  const s = hw / 26;
  const art = new Art(g, color);
  const hex = (r: number, y: number, fill: number, inner = false) => {
    const pts: Pt[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k;
      pts.push([cx + Math.cos(a) * r, y + Math.sin(a) * r * 0.5]);
    }
    art.poly(pts, fill, inner);
  };
  const steel = 0x6e7580;
  const yellow = 0xf2c230;
  // Pad, then a slab below it for thickness.
  hex(30 * s, cy + 4 * s, shade(steel, 0.6));
  hex(30 * s, cy, steel);
  // Hazard-yellow bays on four of the six sides.
  for (const k of [0, 2, 3, 5]) {
    const a0 = (Math.PI / 3) * k;
    const a1 = (Math.PI / 3) * (k + 1);
    const pt = (a: number, r: number): Pt => [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.5];
    art.poly([pt(a0, 30 * s), pt(a1, 30 * s), pt(a1, 21 * s), pt(a0, 21 * s)], yellow, true);
  }
  // Raised ring and team-colour clamps.
  art.ell(cx, cy - 4 * s, 38 * s, 19 * s, shade(steel, 1.2));
  art.ell(cx, cy - 7 * s, 38 * s, 19 * s, 0x9aa1ab);
  for (const a of [0.5, 2.1, 4.2, 5.7]) {
    art.quad(cx + Math.cos(a) * 19 * s - 2.5 * s, cy - 7 * s + Math.sin(a) * 9.5 * s - 3 * s, cx + Math.cos(a) * 19 * s + 2.5 * s, cy - 7 * s + Math.sin(a) * 9.5 * s + 3 * s, color, true);
  }
  // Launch bore with the warhead tip.
  art.ell(cx, cy - 7 * s, 26 * s, 13 * s, 0x1a1f26, true);
  art.ell(cx, cy - 7 * s, 18 * s, 9 * s, 0x2f3640, true);
  art.poly([[cx - 5 * s, cy - 8 * s], [cx + 5 * s, cy - 8 * s], [cx + 4 * s, cy - 17 * s], [cx, cy - 25 * s], [cx - 4 * s, cy - 17 * s]], 0xd8dde3);
  art.poly([[cx - 4 * s, cy - 17 * s], [cx, cy - 25 * s], [cx + 4 * s, cy - 17 * s]], 0xd8352f, true);
  art.quad(cx - 4.4 * s, cy - 15 * s, cx + 4.4 * s, cy - 13 * s, yellow, true);
  // Four AA towers on the corners.
  const tower = (dx: number, dy: number) => {
    const tx = cx + dx;
    const ty = cy + dy;
    art.box(tx, ty, 6 * s, 9 * s, 0, yellow, shade(yellow, 1.12));
    art.poly([[tx - 1 * s, ty - 10 * s], [tx + 9 * s, ty - 17 * s], [tx + 10.5 * s, ty - 15 * s], [tx + 1 * s, ty - 8 * s]], 0x4d535c);
  };
  tower(-24 * s, 0);
  tower(0, -12 * s);
  tower(24 * s, 0);
  tower(0, 12 * s);
  art.draw();
}

/**
 * Missile turret after the reference art: four yellow gun pods on the corners of a cross-shaped base and a
 * taller central launcher block with two red missile bays. Team colour is on the base and the pod trim.
 */
export function drawTurret(g: G, cx: number, cy: number, color: number, hw: number, _alpha = 1): void {
  const s = hw / 26;
  const art = new Art(g, color);
  const yellow = 0xe8d233;
  const slab = 0x6e7580;
  art.box(cx, cy, 28 * s, 4 * s, 0, slab, shade(slab, 1.2));
  const pod = (dx: number, dy: number) => {
    art.box(cx + dx, cy + dy, 8 * s, 4 * s, 4 * s, shade(color, 0.9), color);
    art.box(cx + dx, cy + dy, 6 * s, 9 * s, 8 * s, yellow, shade(yellow, 1.1));
    art.quad(cx + dx - 1.2 * s, cy + dy - 22 * s, cx + dx + 5 * s, cy + dy - 19 * s, 0x4d535c);
    art.quad(cx + dx - 3 * s, cy + dy - 18 * s, cx + dx + 3 * s, cy + dy - 14 * s, shade(color, 1.1), true);
  };
  pod(0, -13 * s);
  pod(-21 * s, 0);
  pod(21 * s, 0);
  // Central launcher.
  art.box(cx, cy + 3 * s, 14 * s, 24 * s, 4 * s, yellow, shade(yellow, 1.12));
  art.box(cx, cy + 3 * s, 9 * s, 7 * s, 28 * s, shade(yellow, 0.9), shade(yellow, 1.05));
  art.quad(cx - 12 * s, cy - 27 * s, cx - 4 * s, cy - 11 * s, 0x2f3640, true);
  art.circ(cx - 8 * s, cy - 23 * s, 1.8 * s, 0xd8352f, true);
  art.circ(cx - 8 * s, cy - 17 * s, 1.8 * s, 0xd8352f, true);
  art.quad(cx + 4 * s, cy - 26 * s, cx + 12 * s, cy - 10 * s, 0x2f3640, true);
  art.circ(cx + 8 * s, cy - 22 * s, 1.8 * s, 0xd8352f, true);
  art.circ(cx + 8 * s, cy - 16 * s, 1.8 * s, 0xd8352f, true);
  pod(0, 13 * s);
  art.draw();
}

/** Hospital after the reference art: a tent with a cream canvas roof, team-colour walls, a red cross panel and a supply crate. */
export function drawHospital(g: G, cx: number, cy: number, color: number, hw: number, _alpha = 1): void {
  const s = hw / 24;
  const art = new Art(g, color);
  const canvas = 0xe6d5b2;
  art.box(cx, cy, 26 * s, 3 * s, 0, 0x6e7580, 0x8a909a);
  // Walls and the two roof planes.
  art.poly([[cx - 20 * s, cy + 1 * s], [cx, cy + 11 * s], [cx, cy - 6 * s], [cx - 20 * s, cy - 14 * s]], shade(color, 0.85));
  art.poly([[cx + 20 * s, cy + 1 * s], [cx, cy + 11 * s], [cx, cy - 6 * s], [cx + 20 * s, cy - 14 * s]], shade(color, 0.6));
  art.poly([[cx - 22 * s, cy - 12 * s], [cx, cy - 2 * s], [cx, cy - 26 * s], [cx - 10 * s, cy - 30 * s]], canvas);
  art.poly([[cx + 22 * s, cy - 12 * s], [cx, cy - 2 * s], [cx, cy - 26 * s], [cx + 10 * s, cy - 30 * s]], shade(canvas, 0.78));
  // Red cross panel on the left roof plane.
  art.poly([[cx - 16 * s, cy - 14 * s], [cx - 4 * s, cy - 9 * s], [cx - 4 * s, cy - 21 * s], [cx - 16 * s, cy - 26 * s]], 0xf4f1ea, true);
  art.poly([[cx - 12.8 * s, cy - 22.6 * s], [cx - 8 * s, cy - 20.6 * s], [cx - 8 * s, cy - 12.6 * s], [cx - 12.8 * s, cy - 14.6 * s]], 0xd8352f, true);
  art.poly([[cx - 15 * s, cy - 18.6 * s], [cx - 5 * s, cy - 14.6 * s], [cx - 5 * s, cy - 17 * s], [cx - 15 * s, cy - 21 * s]], 0xd8352f, true);
  // Supply crate.
  art.box(cx + 13 * s, cy + 9 * s, 5 * s, 6 * s, 0, 0xb98a55, 0xd2a46e);
  art.draw();
}

/** A turret missile in flight, pointing along `angle` (radians, screen space). Green body, red nose, fins, flame. */
export function drawMissile(g: G, x: number, y: number, angle: number, color: number, t: number, s = 1): void {
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  const P = (u: number, v: number): Pt => [x + (u * c - v * sn) * s, y + (u * sn + v * c) * s];
  const flick = Math.sin(t * 40) > 0 ? 1 : 0.8;
  const art = new Art(g, color);
  art.poly([P(-6, -3), P(-20 * flick - 6, 0), P(-6, 3)], 0xff7a22, true);
  art.poly([P(-6, -1.6), P(-13 * flick - 6, 0), P(-6, 1.6)], 0xffe08a, true);
  art.poly([P(-8, -3), P(-13, -8), P(-3, -3)], 0x3e6b36);
  art.poly([P(-8, 3), P(-13, 8), P(-3, 3)], 0x3e6b36);
  art.poly([P(-9, -3.4), P(7, -3.4), P(7, 3.4), P(-9, 3.4)], 0x5f9a4f);
  art.poly([P(-4, -3.4), P(-1, -3.4), P(-1, 3.4), P(-4, 3.4)], 0xf2c230, true);
  art.poly([P(7, -3.4), P(11, -2), P(14, 0), P(11, 2), P(7, 3.4)], 0xd8352f);
  art.draw();
}

/** A chunky 3D question mark standing on (x, y): an extruded hook and dot, solid colours, one outline. */
export function drawQuestion(g: G, x: number, y: number, color: number, size = 1): void {
  const depth = 4 * size;
  const pts: Pt[] = [];
  // Hook: from the upper left, over the top, down the right and into the stem.
  for (let a = Math.PI * 1.05; a <= Math.PI * 2.35; a += 0.18) pts.push([Math.cos(a) * 6.2 * size, -17 * size + Math.sin(a) * 6.2 * size]);
  pts.push([2.4 * size, -8.5 * size], [0, -5.5 * size]);
  const layer = (dx: number, dy: number, w: number, c: number) => {
    g.lineStyle(w, c, 1);
    g.beginPath();
    g.moveTo(x + pts[0][0] + dx, y + pts[0][1] + dy);
    for (let i = 1; i < pts.length; i++) g.lineTo(x + pts[i][0] + dx, y + pts[i][1] + dy);
    g.strokePath();
    g.fillStyle(c, 1).fillCircle(x + dx, y - 1.6 * size + dy, w * 0.52);
  };
  const w = 5 * size;
  layer(depth * 0.7, depth, w + OUTLINE * 2, color);
  layer(0, 0, w + OUTLINE * 2, color);
  for (let k = depth; k >= 1; k--) layer(k * 0.7, k, w, shade(0xffa24a, 0.55));
  layer(0, 0, w, 0xffb066);
  // Lit highlight on the hook.
  g.lineStyle(DETAIL, 0xffe0b8, 1);
  g.beginPath();
  g.moveTo(x + pts[1][0] - 1 * size, y + pts[1][1] - 1 * size);
  for (let i = 2; i < Math.min(pts.length, 8); i++) g.lineTo(x + pts[i][0] - 1 * size, y + pts[i][1] - 1 * size);
  g.strokePath();
}

/**
 * Oil refinery after the reference art: two big domed storage tanks with glowing green tops and team-colour
 * clamps on a machinery base, a small side tank and glowing vents. The glow pulses by colour, not alpha.
 */
export function drawRefinery(g: G, cx: number, cy: number, color: number, hw: number, t: number, _alpha = 1): void {
  const s = hw / 27;
  const art = new Art(g, color);
  const glow = 0.55 + 0.45 * Math.sin(t * 2.2);
  const glowColor = glow > 0.8 ? 0x9dff7a : glow > 0.55 ? 0x7dff6a : 0x4fcf44;
  const coreColor = glow > 0.7 ? 0xf0ffe6 : 0xc8f5b8;
  const pad = 0x464b54;
  art.box(cx, cy, 29 * s, 4 * s, 0, pad, shade(pad, 1.25));
  // Small side tank.
  art.quad(cx - 29.5 * s, cy - 10 * s, cx - 18.5 * s, cy - 2 * s, 0x6d6a74);
  art.ell(cx - 24 * s, cy - 2 * s, 11 * s, 5.5 * s, 0x6d6a74);
  art.ell(cx - 24 * s, cy - 10 * s, 11 * s, 5.5 * s, 0x8b8794);
  const tank = (x: number, y: number, r: number, h: number) => {
    art.ell(x, y, r * 2, r, 0xbcc3cd);
    art.quad(x - r, y - h, x + r, y, 0xbcc3cd);
    art.quad(x - r, y - h, x - r * 0.3, y, 0xd7dce3, true);
    art.quad(x + r * 0.6, y - h, x + r, y, 0x949ca8, true);
    art.ell(x, y, r * 2, r, 0xbcc3cd);
    art.quad(x - r, y - 1, x + r, y, 0xbcc3cd, true);
    art.ell(x, y - h, r * 2, r, 0x6b727d);
    art.ell(x, y - h, r * 1.45, r * 0.72, 0x23382a, true);
    art.ell(x, y - h, r * 0.95, r * 0.46, glowColor, true);
    art.ell(x, y - h, r * 0.4, r * 0.2, coreColor, true);
    art.quad(x - r - 0.8 * s, y - h + 3 * s, x - r + 2.2 * s, y - 2 * s, color);
    art.quad(x + r - 2 * s, y - h + 3 * s, x + r + 1 * s, y - 2 * s, shade(color, 0.6));
  };
  tank(cx - 8 * s, cy - 3 * s, 11 * s, 34 * s);
  tank(cx + 11 * s, cy + 5 * s, 12 * s, 28 * s);
  art.box(cx - 14 * s, cy + 12 * s, 9 * s, 8 * s, 4 * s, 0x6a717c, color);
  art.quad(cx + 21 * s, cy + 3 * s, cx + 27 * s, cy + 5 * s, glowColor, true);
  art.quad(cx + 21 * s, cy + 7 * s, cx + 27 * s, cy + 9 * s, glowColor, true);
  art.draw();
}

/** A padlock standing on (x, y): grey body, keyhole and a shackle. Marks a node that is not open for capture yet. */
export function drawLock(g: G, x: number, y: number, s = 1): void {
  const art = new Art(g, 0x3a4350);
  art.poly([[x - 6 * s, y - 20 * s], [x - 6 * s, y - 28 * s], [x - 3.5 * s, y - 32 * s], [x + 3.5 * s, y - 32 * s], [x + 6 * s, y - 28 * s], [x + 6 * s, y - 20 * s], [x + 3 * s, y - 20 * s], [x + 3 * s, y - 27 * s], [x + 2 * s, y - 29 * s], [x - 2 * s, y - 29 * s], [x - 3 * s, y - 27 * s], [x - 3 * s, y - 20 * s]], 0xb8c0cc);
  art.quad(x - 9 * s, y - 20 * s, x + 9 * s, y - 6 * s, 0xf2c230);
  art.quad(x - 9 * s, y - 20 * s, x + 9 * s, y - 18 * s, 0xffe08a, true);
  art.circ(x, y - 14 * s, 2.2 * s, 0x2f3640, true);
  art.quad(x - 0.9 * s, y - 14 * s, x + 0.9 * s, y - 9 * s, 0x2f3640, true);
  art.draw();
}
