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
/** Per-row draw targets. `floor` is drawn first, `top` after every sprite of the row. */
export interface CellLayers {
  floor: Phaser.GameObjects.Graphics;
  top: Phaser.GameObjects.Graphics;
}

export interface Skin {
  readonly id: string;
  readonly label: string;
  /** Cells in back-to-front draw order. */
  order(cols: number, rows: number): { col: number; row: number }[];
  anchor(col: number, row: number, height: number): Pt;
  drawBackdrop(g: Phaser.GameObjects.Graphics, w: number, h: number): void;
  /** Draw one cell. Rows are depth-sorted by the scene (row * ROW_DEPTH). */
  drawCell(layers: CellLayers, v: CellView): void;
  /** Release any sprites the skin created. Called when the skin is replaced. */
  dispose?(): void;
}

/** Depth step per board row; skins place their sprites inside this band. */
export const ROW_DEPTH = 10;

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

/**
 * Deterministic jagged crack arms in unit-square coordinates. Each arm starts
 * near the centre and zigzags outward with sharp turns, like a real fracture.
 * The renderer turns them into tapered filled shapes.
 */
export function crackPaths(seed: number, count: number): Pt[][] {
  const out: Pt[][] = [];
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const clamp = (v: number) => Math.max(0.05, Math.min(0.95, v));
  const base = rnd() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = base + (i / Math.max(count, 1)) * Math.PI * 2 + (rnd() - 0.5) * 0.7;
    let x = 0.5 + (rnd() - 0.5) * 0.08;
    let y = 0.5 + (rnd() - 0.5) * 0.08;
    const path: Pt[] = [{ x, y }];
    const steps = 3 + Math.floor(rnd() * 2);
    let ang = a;
    for (let k = 0; k < steps; k++) {
      ang += (k % 2 === 0 ? 1 : -1) * (0.35 + rnd() * 0.5);
      const len = 0.1 + rnd() * 0.1;
      x = clamp(x + Math.cos(ang) * len);
      y = clamp(y + Math.sin(ang) * len);
      path.push({ x, y });
    }
    out.push(path);
  }
  return out;
}
