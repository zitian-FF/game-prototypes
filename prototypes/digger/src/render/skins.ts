import type Phaser from 'phaser';
import {
  type BoardRect,
  type CellView,
  type Pt,
  type Skin,
  crackPaths,
  mix,
  shade,
  tileColor,
} from './skin';
import { tune } from '../tune';

const FLOOR = 0x241c2e;
const GOLD = 0xffd23f;

/** Maps board coordinates (u across, v down, h in layers) to screen pixels. */
interface Projection {
  P(u: number, v: number, h: number): Pt;
  /** Edges of the prism that face the camera, with a brightness factor. */
  faces: { a: [number, number]; b: [number, number]; light: number }[];
}

type Corner = [number, number];

function poly(g: Phaser.GameObjects.Graphics, pts: Pt[], color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillPoints(pts, true);
}

function bilerp(q: Pt[], s: number, t: number): Pt {
  // q = [topLeft, topRight, bottomRight, bottomLeft]
  const top = { x: q[0].x + (q[1].x - q[0].x) * s, y: q[0].y + (q[1].y - q[0].y) * s };
  const bot = { x: q[3].x + (q[2].x - q[3].x) * s, y: q[3].y + (q[2].y - q[3].y) * s };
  return { x: top.x + (bot.x - top.x) * t, y: top.y + (bot.y - top.y) * t };
}

function drawDecor(g: Phaser.GameObjects.Graphics, q: Pt[], v: CellView, scale: number): void {
  const s = v.surface;
  if (!s) return;
  const dmg = 1 - s.hpFrac;
  if (dmg > 0.01) {
    g.lineStyle(Math.max(1, 1.6 * scale), 0x1b1420, 0.85);
    for (const path of crackPaths(v.idx + 1, 1 + Math.ceil(dmg * 4))) {
      g.beginPath();
      path.forEach((p, i) => {
        const pt = bilerp(q, p.x, p.y);
        if (i === 0) g.moveTo(pt.x, pt.y);
        else g.lineTo(pt.x, pt.y);
      });
      g.strokePath();
    }
  }
  if (s.kind === 'hardened') {
    g.fillStyle(0x2c2f3a, 0.9);
    for (const [a, b] of [[0.17, 0.17], [0.83, 0.17], [0.83, 0.83], [0.17, 0.83]]) {
      const p = bilerp(q, a, b);
      g.fillCircle(p.x, p.y, Math.max(1.2, 2.2 * scale));
    }
  }
  if (s.weak) {
    const c = bilerp(q, 0.5, 0.5);
    const pulse = 0.65 + 0.35 * Math.sin(v.time * 6 + v.idx);
    const r = 7 * scale;
    g.fillStyle(0xff8a1f, 0.28 * pulse);
    g.fillCircle(c.x, c.y, r * 1.5);
    g.lineStyle(Math.max(1.5, 2 * scale), 0xffb347, 0.9 * pulse + 0.1);
    g.beginPath();
    g.moveTo(c.x - r, c.y - r * 0.6);
    g.lineTo(c.x + r, c.y + r * 0.6);
    g.moveTo(c.x + r, c.y - r * 0.6);
    g.lineTo(c.x - r, c.y + r * 0.6);
    g.strokePath();
  }
}

function drawTreasure(g: Phaser.GameObjects.Graphics, P: Projection['P'], u0: number, v0: number, u1: number, v1: number, t: number): void {
  const at = (s: number, r: number) => P(u0 + (u1 - u0) * s, v0 + (v1 - v0) * r, 0);
  const pts = [at(0.5, 0.15), at(0.82, 0.5), at(0.5, 0.85), at(0.18, 0.5)];
  poly(g, pts, shade(GOLD, 0.7));
  poly(g, [pts[0], pts[1], at(0.5, 0.5)], GOLD);
  poly(g, [pts[0], at(0.5, 0.5), pts[3]], mix(GOLD, 0xffffff, 0.45));
  const glint = 0.5 + 0.5 * Math.sin(t * 4);
  const c = at(0.5, 0.5);
  g.fillStyle(0xffffff, 0.35 * glint);
  g.fillCircle(c.x - 3, c.y - 3, 3);
}

/** 3D-ish blocks drawn from quads. Tilt and iso only differ by projection. */
class PrismSkin implements Skin {
  constructor(
    readonly id: string,
    readonly label: string,
    private proj: Projection,
    private backdrop: (g: Phaser.GameObjects.Graphics, w: number, h: number) => void,
    private sort: (cols: number, rows: number) => { col: number; row: number }[],
    /** Share of the cell depth the top face covers; the rest shows the front face. */
    private topDepth = 1 - tune.layout.cellGap,
  ) {}

  order(cols: number, rows: number) {
    return this.sort(cols, rows);
  }

  anchor(col: number, row: number, height: number): Pt {
    return this.proj.P(col + 0.5, row + this.topDepth / 2, height);
  }

  drawBackdrop(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    this.backdrop(g, w, h);
  }

  drawCell(g: Phaser.GameObjects.Graphics, v: CellView): void {
    const gap = tune.layout.cellGap;
    const u0 = v.col + gap;
    const u1 = v.col + 1 - gap;
    const v0 = v.row + gap;
    const v1 = v.row + this.topDepth;
    const P = (u: number, vv: number, h: number): Pt => {
      const p = this.proj.P(u, vv, h);
      return { x: p.x + v.offX, y: p.y + v.offY };
    };
    const floor = [P(u0, v0, 0), P(u1, v0, 0), P(u1, v1, 0), P(u0, v1, 0)];
    poly(g, floor, FLOOR);
    poly(g, [floor[0], floor[1], bilerp(floor, 1, 0.22), bilerp(floor, 0, 0.22)], 0x120d19, 0.7);
    if (v.hasTreasure) drawTreasure(g, (u, vv, h) => P(u, vv, h), u0, v0, u1, v1, v.time);
    if (v.height < 0.02 || !v.surface) return;

    const n = Math.max(1, v.alive.length);
    const bandH = v.height / n;
    const corner = (c: Corner, h: number) => P(c[0] === 0 ? u0 : u1, c[1] === 0 ? v0 : v1, h);
    // Side faces, bottom band is the deepest unbroken layer.
    for (const f of this.proj.faces) {
      for (let i = 0; i < n; i++) {
        const a = v.alive[n - 1 - i];
        const col = shade(tileColor(a.layer, a.kind), f.light);
        const z0 = i * bandH;
        const z1 = (i + 1) * bandH;
        poly(g, [corner(f.a, z0), corner(f.b, z0), corner(f.b, z1), corner(f.a, z1)], col);
        if (i > 0) {
          g.lineStyle(1, 0x000000, 0.25);
          g.lineBetween(corner(f.a, z0).x, corner(f.a, z0).y, corner(f.b, z0).x, corner(f.b, z0).y);
        }
      }
    }
    const top = [P(u0, v0, v.height), P(u1, v0, v.height), P(u1, v1, v.height), P(u0, v1, v.height)];
    const base = tileColor(v.surface.layer, v.surface.kind);
    const dmg = 1 - v.surface.hpFrac;
    poly(g, top, shade(base, 1 - dmg * 0.18));
    // Bevel highlight along the lit edges.
    g.lineStyle(1.5, 0xffffff, 0.35);
    g.lineBetween(top[0].x, top[0].y, top[1].x, top[1].y);
    g.lineBetween(top[0].x, top[0].y, top[3].x, top[3].y);
    g.lineStyle(1, 0x000000, 0.3);
    g.lineBetween(top[2].x, top[2].y, top[1].x, top[1].y);
    g.lineBetween(top[2].x, top[2].y, top[3].x, top[3].y);
    drawDecor(g, top, v, Math.abs(top[1].x - top[0].x) / 52);
    if (v.flash > 0.01) poly(g, top, 0xffffff, Math.min(0.85, v.flash));
  }
}

function gradientBackdrop(top: number, bottom: number) {
  return (g: Phaser.GameObjects.Graphics, w: number, h: number) => {
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, w, h);
  };
}

export function createTiltSkin(rect: BoardRect, cols: number, rows: number): Skin {
  const back = tune.layout.tiltBackScale;
  const sc = (v: number) => back + (1 - back) * (v / rows);
  const norm = back * rows + ((1 - back) * rows) / 2;
  const yOf = (v: number) => rect.y + rect.h * ((back * v + ((1 - back) * v * v) / (2 * rows)) / norm);
  const proj: Projection = {
    P: (u, v, h) => ({
      x: rect.x + rect.w / 2 + (u - cols / 2) * (rect.w / cols) * sc(v),
      y: yOf(v) - h * tune.layout.layerHeightPx * sc(v),
    }),
    faces: [{ a: [0, 1], b: [1, 1], light: 0.72 }],
  };
  return new PrismSkin('bevel', 'Bevel blocks (2.5D tilt)', proj, gradientBackdrop(0x241a35, 0x0e0a16), (c, r) => {
    const out: { col: number; row: number }[] = [];
    for (let row = 0; row < r; row++) for (let col = 0; col < c; col++) out.push({ col, row });
    return out;
  }, tune.layout.tiltTopDepth);
}

export function createIsoSkin(rect: BoardRect, cols: number, rows: number): Skin {
  const hw = rect.w / (cols + rows) / 1;
  const hh = hw * 0.5;
  const cx = rect.x + (rect.w * rows) / (cols + rows);
  const y0 = rect.y + (rect.h - (cols + rows) * hh) / 2;
  const proj: Projection = {
    P: (u, v, h) => ({
      x: cx + (u - v) * hw,
      y: y0 + (u + v) * hh - h * tune.layout.layerHeightPx * 1.1,
    }),
    faces: [
      { a: [0, 1], b: [1, 1], light: 0.8 },
      { a: [1, 0], b: [1, 1], light: 0.55 },
    ],
  };
  return new PrismSkin('iso', 'Isometric blocks', proj, gradientBackdrop(0x1b2a3a, 0x0a1118), (c, r) => {
    const out: { col: number; row: number }[] = [];
    for (let s = 0; s < c + r - 1; s++) for (let col = 0; col < c; col++) if (s - col >= 0 && s - col < r) out.push({ col, row: s - col });
    return out;
  });
}

/** Chunky flat cartoon tiles: outline, drop shadow, no extrusion. */
export function createFlatSkin(rect: BoardRect, cols: number, rows: number): Skin {
  const cw = rect.w / cols;
  const ch = Math.min(cw * 1.05, rect.h / rows);
  const oy = rect.y + (rect.h - ch * rows) / 2;
  const box = (col: number, row: number, inset: number) => ({
    x: rect.x + col * cw + inset,
    y: oy + row * ch + inset,
    w: cw - inset * 2,
    h: ch - inset * 2,
  });
  const OUT = 0x14101c;
  return {
    id: 'flat',
    label: 'Flat cartoon tiles',
    order: (c, r) => {
      const out: { col: number; row: number }[] = [];
      for (let row = 0; row < r; row++) for (let col = 0; col < c; col++) out.push({ col, row });
      return out;
    },
    anchor: (col, row) => {
      const b = box(col, row, 0);
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    },
    drawBackdrop: gradientBackdrop(0x2a2140, 0x15101f),
    drawCell(g, v) {
      const b = box(v.col, v.row, 2.5);
      const x = b.x + v.offX;
      const y = b.y + v.offY;
      g.fillStyle(FLOOR, 1);
      g.fillRoundedRect(b.x, b.y, b.w, b.h, 8);
      if (v.hasTreasure) {
        const pts = (cx: number, cy: number, r: number): Pt[] => [
          { x: cx, y: cy - r },
          { x: cx + r * 0.8, y: cy },
          { x: cx, y: cy + r },
          { x: cx - r * 0.8, y: cy },
        ];
        const p = pts(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.3);
        g.lineStyle(2.5, OUT, 1);
        g.fillStyle(GOLD, 1);
        g.fillPoints(p, true);
        g.strokePoints(p, true);
      }
      if (!v.surface) return;
      const base = tileColor(v.surface.layer, v.surface.kind);
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(x, y + 4, b.w, b.h, 8);
      g.fillStyle(base, 1);
      g.fillRoundedRect(x, y, b.w, b.h, 8);
      g.fillStyle(0xffffff, 0.2);
      g.fillRoundedRect(x + 3, y + 3, b.w - 6, b.h * 0.3, 5);
      g.lineStyle(3, OUT, 1);
      g.strokeRoundedRect(x, y, b.w, b.h, 8);
      // Layer pips: how many layers remain including this one.
      for (let i = 0; i < v.alive.length; i++) {
        g.fillStyle(OUT, 0.8);
        g.fillCircle(x + 8 + i * 8, y + b.h - 8, 2.6);
      }
      const q: Pt[] = [{ x, y }, { x: x + b.w, y }, { x: x + b.w, y: y + b.h }, { x, y: y + b.h }];
      drawDecor(g, q, v, b.w / 52);
      if (v.flash > 0.01) {
        g.fillStyle(0xffffff, Math.min(0.85, v.flash));
        g.fillRoundedRect(x, y, b.w, b.h, 8);
      }
    },
  };
}

export const SKIN_IDS = ['bevel', 'flat', 'iso'] as const;
export type SkinId = (typeof SKIN_IDS)[number];

export function createSkin(id: string, rect: BoardRect, cols: number, rows: number): Skin {
  if (id === 'flat') return createFlatSkin(rect, cols, rows);
  if (id === 'iso') return createIsoSkin(rect, cols, rows);
  return createTiltSkin(rect, cols, rows);
}
