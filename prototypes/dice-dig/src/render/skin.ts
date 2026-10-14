import type Phaser from 'phaser';
import { type Pt, mix, shade } from 'dig-kit';
import type { TileKind } from '../game/types';

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
