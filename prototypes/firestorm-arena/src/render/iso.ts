import type Phaser from 'phaser';
import type { Tune, Vec } from 'arena-sim';
import { clientTune } from '../clientTune';
import { shade } from '../theme';

type G = Phaser.GameObjects.Graphics;

/**
 * World units (sim coordinates) <-> map pixels. The floor is an upright square grid: x goes right and y goes
 * down, one cell is `tile` pixels. Buildings and units are still drawn as isometric sprites standing on a
 * tile, which is why the old diamond helpers below remain for the art.
 */
export class Iso {
  /** Tile edge in pixels. */
  readonly tile: number;
  readonly cell: number;
  readonly pxW: number;
  readonly pxH: number;
  readonly cols: number;
  readonly rows: number;

  constructor(tune: Tune) {
    this.tile = clientTune.iso.tileSize;
    this.cell = tune.map.cellSize;
    this.cols = tune.map.widthCells;
    this.rows = tune.map.heightCells;
    this.pxW = this.cols * this.tile;
    this.pxH = this.rows * this.tile;
  }

  /** World position to map pixels. */
  p(x: number, y: number): Vec {
    const k = this.tile / this.cell;
    return { x: x * k, y: y * k };
  }

  /** Map pixels back to world position. */
  unproject(sx: number, sy: number): Vec {
    const k = this.cell / this.tile;
    return { x: sx * k, y: sy * k };
  }

  /** Painter's order: things lower on the screen are drawn later. */
  depth(x: number, y: number): number {
    return (y + x * 0.001) / this.cell;
  }
}

export function poly(g: G, pts: number[][], fill?: number, alpha = 1, stroke?: number, lw = 1): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  if (fill !== undefined) {
    g.fillStyle(fill, alpha);
    g.fillPath();
  }
  if (stroke !== undefined) {
    g.lineStyle(lw, stroke, 1);
    g.strokePath();
  }
}

/** A square tile centred at (cx, cy) with half-size `half`. */
export function square(g: G, cx: number, cy: number, half: number, fill?: number, alpha = 1, stroke?: number, lw = 1): void {
  poly(g, [[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]], fill, alpha, stroke, lw);
}

export function diamond(g: G, cx: number, cy: number, hw: number, hh: number, fill?: number, alpha = 1, stroke?: number, lw = 1): void {
  poly(g, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], fill, alpha, stroke, lw);
}

/**
 * An isometric cube standing on the diamond centred at (cx, cy) with half-width
 * hw (half-height hw / 2), `h` pixels tall, base lifted by `lift`.
 */
export function cube(g: G, cx: number, cy: number, hw: number, h: number, lift: number, color: number, alpha = 1, edge = 0x000000): void {
  const hh = hw / 2;
  const by = cy - lift;
  const ty = by - h;
  poly(g, [[cx - hw, by], [cx, by + hh], [cx, ty + hh], [cx - hw, ty]], shade(color, 0.62), alpha, edge, 1);
  poly(g, [[cx + hw, by], [cx, by + hh], [cx, ty + hh], [cx + hw, ty]], shade(color, 0.4), alpha, edge, 1);
  poly(g, [[cx, ty - hh], [cx + hw, ty], [cx, ty + hh], [cx - hw, ty]], shade(color, 1), alpha, edge, 1);
}

/** Deterministic 0..1 hash for scattering decoration. */
export function hash2(a: number, b: number, seed = 0): number {
  let h = (a * 374761393 + b * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * A box on the diamond centred at (cx, cy) with half-width hw, `h` pixels tall and lifted by `lift`,
 * with its own wall and roof colours (walls shaded left and right, roof lit with a thin rim).
 */
export function box(g: G, cx: number, cy: number, hw: number, h: number, lift: number, wall: number, roof: number, alpha = 1, edge = 0x000000): void {
  const hh = hw / 2;
  const by = cy - lift;
  const ty = by - h;
  poly(g, [[cx - hw, by], [cx, by + hh], [cx, ty + hh], [cx - hw, ty]], shade(wall, 0.82), alpha, edge, 1);
  poly(g, [[cx + hw, by], [cx, by + hh], [cx, ty + hh], [cx + hw, ty]], shade(wall, 0.58), alpha, edge, 1);
  poly(g, [[cx, ty - hh], [cx + hw, ty], [cx, ty + hh], [cx - hw, ty]], roof, alpha, edge, 1);
  // roof rim: a slightly darker inset gives the slab thickness seen in the reference art
  const r = 0.72;
  poly(g, [[cx, ty - hh * r], [cx + hw * r, ty], [cx, ty + hh * r], [cx - hw * r, ty]], shade(roof, 1.12), alpha);
}
