import type Phaser from 'phaser';
import type { TileKind } from '../game/types';

export interface Pt {
  x: number;
  y: number;
}

/** Everything a skin needs to draw one cell. Skins never read game state. */
export interface CellView {
  idx: number;
  col: number;
  row: number;
  /** Eased stack height in layers (0 to 3). Falls with a spring when a layer breaks. */
  height: number;
  /** Unbroken layers, top first. Each entry is the layer index (0 = top). */
  alive: { layer: number; kind: TileKind }[];
  surface: { layer: number; kind: TileKind; hpFrac: number; weak: boolean; hardness: number } | null;
  hasTreasure: boolean;
  offX: number;
  offY: number;
  /** 0 to 1 white hit flash. */
  flash: number;
  /** Seconds, for ambient pulses. */
  time: number;
}

/**
 * A skin turns cell views into pixels. Swapping the art style (or moving to
 * real sprites later) means writing another Skin; scene, rules and fx do not
 * change. `anchor` tells fx where a cell is on screen.
 */
export interface Skin {
  readonly id: string;
  readonly label: string;
  /** Cells in back-to-front draw order. */
  order(cols: number, rows: number): { col: number; row: number }[];
  anchor(col: number, row: number, height: number): Pt;
  drawBackdrop(g: Phaser.GameObjects.Graphics, w: number, h: number): void;
  drawCell(g: Phaser.GameObjects.Graphics, v: CellView): void;
}

export interface BoardRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function shade(color: number, f: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((color & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => {
    const av = (a >> s) & 255;
    const bv = (b >> s) & 255;
    return Math.round(av + (bv - av) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Strata colours, top layer first. Placeholder palette: swap freely.
const LAYER_BASE = [0xc79a62, 0xa8604a, 0x5b6a8c];
const KIND_TINT: Record<TileKind, (c: number) => number> = {
  soft: (c) => mix(c, 0xffffff, 0.22),
  normal: (c) => c,
  hardened: (c) => mix(shade(c, 0.75), 0x8a8f9c, 0.55),
};

export function tileColor(layer: number, kind: TileKind): number {
  return KIND_TINT[kind](LAYER_BASE[Math.min(layer, LAYER_BASE.length - 1)]);
}

/** Deterministic crack polylines in unit-square coordinates. */
export function crackPaths(seed: number, count: number): Pt[][] {
  const out: Pt[][] = [];
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const a = (i / Math.max(count, 1)) * Math.PI * 2 + rnd() * 1.2;
    const path: Pt[] = [{ x: 0.5 + (rnd() - 0.5) * 0.1, y: 0.5 + (rnd() - 0.5) * 0.1 }];
    let x = path[0].x;
    let y = path[0].y;
    const steps = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < steps; k++) {
      const ang = a + (rnd() - 0.5) * 0.9;
      const len = 0.16 + rnd() * 0.12;
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len;
      path.push({ x: Math.max(0.04, Math.min(0.96, x)), y: Math.max(0.04, Math.min(0.96, y)) });
    }
    out.push(path);
  }
  return out;
}
