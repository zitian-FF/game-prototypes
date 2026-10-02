import type Phaser from 'phaser';
import type { Tune, Vec } from 'arena-sim';
import { clientTune } from '../clientTune';
import { shade } from '../theme';

type G = Phaser.GameObjects.Graphics;

/** World units (sim coordinates) <-> isometric map pixels. */
export class Iso {
  readonly tw: number;
  readonly th: number;
  readonly cell: number;
  readonly ox: number;
  readonly pxW: number;
  readonly pxH: number;
  readonly cols: number;
  readonly rows: number;

  constructor(tune: Tune) {
    this.tw = clientTune.iso.tileWidth;
    this.th = this.tw / 2;
    this.cell = tune.map.cellSize;
    this.cols = tune.map.widthCells;
    this.rows = tune.map.heightCells;
    this.ox = this.rows * (this.tw / 2);
    this.pxW = (this.cols + this.rows) * (this.tw / 2);
    this.pxH = (this.cols + this.rows) * (this.th / 2);
  }

  /** World position to map pixels. */
  p(x: number, y: number): Vec {
    const u = x / this.cell;
    const v = y / this.cell;
    return { x: (u - v) * (this.tw / 2) + this.ox, y: (u + v) * (this.th / 2) };
  }

  /** Map pixels back to world position. */
  unproject(sx: number, sy: number): Vec {
    const a = ((sx - this.ox) * 2) / this.tw; // u - v
    const b = (sy * 2) / this.th; // u + v
    return { x: ((a + b) / 2) * this.cell, y: ((b - a) / 2) * this.cell };
  }

  /** Painter's order: further from the viewer (smaller u + v) first. */
  depth(x: number, y: number): number {
    return (x + y) / this.cell;
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
