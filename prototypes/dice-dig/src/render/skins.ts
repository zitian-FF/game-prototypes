import type Phaser from 'phaser';
import { type Pt, bakePillow, bakeTexture, crackPaths, drawCrack, layerColor, mix, shade } from 'dig-kit';
import { type BoardRect, type CellLayers, type CellView, ROW_DEPTH, type Skin, tileColor } from './skin';
import type { TileKind } from '../game/types';
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

interface DecorStyle {
  crack: number;
  rivet: number;
  weak: number;
  weakGlow: number;
}
const DARK_DECOR: DecorStyle = { crack: 0x1b1420, rivet: 0x2c2f3a, weak: 0xffb347, weakGlow: 0xff8a1f };

function drawDecor(g: Phaser.GameObjects.Graphics, q: Pt[], v: CellView, scale: number, st: DecorStyle = DARK_DECOR): void {
  const s = v.surface;
  if (!s) return;
  const dmg = 1 - s.hpFrac;
  if (dmg > 0.01) {
    for (const path of crackPaths(v.idx + 1, 2 + Math.ceil(dmg * 3))) {
      const pts = path.map((p) => bilerp(q, p.x, p.y));
      drawCrack(g, pts, (1.6 + dmg * 3.2) * scale, st.crack);
    }
  }
  if (s.kind === 'hardened') {
    g.fillStyle(st.rivet, 0.9);
    for (const [a, b] of [[0.17, 0.17], [0.83, 0.17], [0.83, 0.83], [0.17, 0.83]]) {
      const p = bilerp(q, a, b);
      g.fillCircle(p.x, p.y, Math.max(1.2, 2.2 * scale));
    }
  }
  if (s.weak) {
    const c = bilerp(q, 0.5, 0.5);
    const pulse = 0.65 + 0.35 * Math.sin(v.time * 6 + v.idx);
    const r = 7 * scale;
    g.fillStyle(st.weakGlow, 0.28 * pulse);
    g.fillCircle(c.x, c.y, r * 1.5);
    g.lineStyle(Math.max(1.5, 2 * scale), st.weak, 0.9 * pulse + 0.1);
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

  drawCell(layers: CellLayers, v: CellView): void {
    const g = layers.floor;
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
    drawCell(layers, v) {
      const g = layers.floor;
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

const PASTEL_DECOR: DecorStyle = { crack: 0x3a2a55, rivet: 0xffffff, weak: 0xff2f6a, weakGlow: 0xff6f9a };

const KINDS: TileKind[] = ['soft', 'normal', 'hardened'];

/**
 * Soft pillow blocks, each layer a rounded slab. Slabs are baked once into
 * textures and drawn as sprites, because tessellating dozens of rounded
 * shapes per cell every frame is far too slow. Only cheap decor (cracks,
 * rivets, weak points, flash) is drawn live. Replacing this with hand-made
 * art means swapping the bake step for real frames.
 */
export function createPastelSkin(rect: BoardRect, cols: number, rows: number): Skin {
  const cw = rect.w / cols;
  const pitch = rect.h / rows;
  const topH = pitch * tune.layout.pastelTopDepth;
  const gap = 3;
  const R = Math.min(cw, topH) * 0.28;
  const lp = tune.layout.layerHeightPx;
  const bw = cw - gap;
  const topNominal = topH + lp;
  const lowNominal = lp * 2.1;
  const geo = (col: number, row: number) => ({ x: rect.x + col * cw + gap / 2, y: rect.y + row * pitch });
  const key = (role: string, layer: number, kind: TileKind) => `pd_${role}_${layer}_${kind}`;

  let scene: Phaser.Scene | null = null;
  const baked = (sc: Phaser.Scene) => {
    scene = sc;
    if (sc.textures.exists('pd_pit')) return;
    for (let layer = 0; layer < 3; layer++) {
      for (const kind of KINDS) {
        const col = layerColor(layer, kind);
        bakePillow(sc, key('top', layer, kind), bw, topNominal, R * 1.15, col, true);
        bakePillow(sc, key('low', layer, kind), bw, lowNominal, Math.min(R, lowNominal / 2), shade(col, 0.9), false);
      }
    }
    bakeTexture(sc, 'pd_pit', bw, topH, (g, res) => {
      g.fillStyle(0x7a4a2e, 1);
      g.fillRoundedRect(0, 0, bw * res, topH * res, R * res);
      g.fillStyle(0x4a2a1c, 0.7);
      g.fillRoundedRect(2 * res, 2 * res, (bw - 4) * res, topH * 0.4 * res, R * 0.8 * res);
    });
  };

  interface CellSprites {
    pit: Phaser.GameObjects.Image;
    slabs: Phaser.GameObjects.Image[];
  }
  const pool = new Map<number, CellSprites>();
  const spritesFor = (sc: Phaser.Scene, idx: number): CellSprites => {
    let c = pool.get(idx);
    if (!c) {
      const mk = () => sc.add.image(0, 0, 'pd_pit').setOrigin(0, 0).setVisible(false);
      c = { pit: mk(), slabs: [mk(), mk(), mk()] };
      pool.set(idx, c);
    }
    return c;
  };

  return {
    id: 'pastel',
    label: 'Pastel soft blocks',
    order: (c, r) => {
      const out: { col: number; row: number }[] = [];
      for (let row = 0; row < r; row++) for (let col = 0; col < c; col++) out.push({ col, row });
      return out;
    },
    anchor: (col, row, height) => {
      const b = geo(col, row);
      return { x: b.x + bw / 2, y: b.y - height * lp + topH / 2 };
    },
    drawBackdrop(g, w, h) {
      g.fillGradientStyle(0x2f9bff, 0x2f9bff, 0x8ad8ff, 0x8ad8ff, 1);
      g.fillRect(0, 0, w, h);
      g.fillStyle(0xffffff, 0.16);
      for (const [x, y, r] of [[60, 70, 34], [330, 40, 26], [300, 570, 40], [40, 590, 30]]) g.fillCircle(x, y, r);
    },
    drawCell(layers, v) {
      const sc = layers.floor.scene;
      baked(sc);
      const sp = spritesFor(sc, v.idx);
      const b = geo(v.col, v.row);
      const base = v.row * ROW_DEPTH;
      sp.pit.setTexture('pd_pit').setPosition(b.x, b.y).setDisplaySize(bw, topH).setDepth(base).setVisible(true);
      if (v.hasTreasure) {
        const g = layers.floor;
        const cx = b.x + bw / 2;
        const cy = b.y + topH / 2;
        const r = Math.min(bw, topH) * 0.3;
        const gem = [{ x: cx, y: cy - r }, { x: cx + r * 0.85, y: cy }, { x: cx, y: cy + r }, { x: cx - r * 0.85, y: cy }];
        g.fillStyle(0xffc94d, 1);
        g.fillPoints(gem, true);
        g.fillStyle(0xfff0a8, 1);
        g.fillPoints([gem[0], gem[1], { x: cx, y: cy }], true);
        g.fillStyle(0xffffff, 0.35 + 0.3 * Math.sin(v.time * 4));
        g.fillCircle(cx - r * 0.3, cy - r * 0.3, 2.5);
      }
      const n = v.alive.length;
      for (let k = 0; k < 3; k++) if (k >= n || v.height < 0.02) sp.slabs[k].setVisible(false);
      if (v.height < 0.02 || !v.surface) return;

      const topY = b.y - v.height * lp + v.offY;
      const x = b.x + v.offX;
      const sliceH = (v.height * lp) / n;
      // Deepest slab first so each overlaps the one below; its rounded
      // bottom edge forms the groove between layers.
      for (let k = n - 1; k >= 0; k--) {
        const a = v.alive[k];
        const img = sp.slabs[k];
        img.setVisible(true).setDepth(base + 1 + (n - k) * 0.1);
        if (k === 0) img.setTexture(key('top', a.layer, a.kind)).setPosition(x, topY).setDisplaySize(bw, topH + sliceH);
        else {
          const h = sliceH * 2.1;
          img.setTexture(key('low', a.layer, a.kind)).setPosition(x, topY + topH + k * sliceH - h + v.offY * 0).setDisplaySize(bw, h);
        }
      }
      const g = layers.top;
      const q: Pt[] = [{ x, y: topY }, { x: x + bw, y: topY }, { x: x + bw, y: topY + topH }, { x, y: topY + topH }];
      drawDecor(g, q, v, bw / 52, PASTEL_DECOR);
      if (v.flash > 0.01) {
        g.fillStyle(0xffffff, Math.min(0.85, v.flash));
        g.fillRoundedRect(x, topY, bw, topH, R);
      }
    },
    dispose() {
      for (const c of pool.values()) {
        c.pit.destroy();
        c.slabs.forEach((i) => i.destroy());
      }
      pool.clear();
      void scene;
    },
  };
}

export const SKIN_IDS = ['pastel', 'bevel', 'flat', 'iso'] as const;
export type SkinId = (typeof SKIN_IDS)[number];

export function createSkin(id: string, rect: BoardRect, cols: number, rows: number): Skin {
  if (id === 'bevel') return createTiltSkin(rect, cols, rows);
  if (id === 'flat') return createFlatSkin(rect, cols, rows);
  if (id === 'iso') return createIsoSkin(rect, cols, rows);
  return createPastelSkin(rect, cols, rows);
}
