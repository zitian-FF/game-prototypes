import { mulberry32 } from 'dig-kit';
import { tune } from '../tune';

export interface TerrainCell {
  hp: number;
  maxHp: number;
  /** Index into the strata palette. */
  strata: number;
  /** Gem value buried under this block, 0 for none. */
  gem: number;
  broken: boolean;
}

export interface HitResult {
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  broke: boolean;
  gem: number;
}

export const STRATA_COUNT = 7;

/**
 * The wall being dug: an endless stack of rows, tune.terrain.cols blocks wide.
 * Each column is dug on its own. Rows are generated on demand from the seed,
 * so the same seed gives the same wall.
 */
export class Terrain {
  private rows = new Map<number, TerrainCell[]>();
  /** First unbroken row in each column. */
  readonly front: number[];
  blocksDug = 0;

  constructor(private seed: number) {
    this.front = new Array(tune.terrain.cols).fill(0);
  }

  strataOf(row: number): number {
    return Math.floor(row / tune.terrain.bandRows) % STRATA_COUNT;
  }

  row(r: number): TerrainCell[] {
    let cells = this.rows.get(r);
    if (!cells) {
      const rng = mulberry32((this.seed + Math.imul(r + 1, 9973)) >>> 0);
      const hp = Math.max(1, Math.round(tune.terrain.hpBase + r * tune.terrain.hpPerRow));
      const band = Math.floor(r / tune.terrain.bandRows);
      cells = Array.from({ length: tune.terrain.cols }, () => ({
        hp,
        maxHp: hp,
        strata: this.strataOf(r),
        gem: rng() < tune.terrain.treasureChance ? tune.terrain.gemBase + band * tune.terrain.gemPerBand : 0,
        broken: false,
      }));
      this.rows.set(r, cells);
    }
    return cells;
  }

  cell(row: number, col: number): TerrainCell {
    return this.row(row)[col];
  }

  minFront(): number {
    return Math.min(...this.front);
  }

  /** Depth reached by the shallowest column, in metres. */
  depthMeters(): number {
    return this.minFront() * tune.terrain.metersPerRow;
  }

  /**
   * The column a hit for `col` really digs. A column may only lead the
   * shallowest one by maxLead rows; beyond that the hit goes to the shallowest.
   */
  targetColumn(col: number): number {
    const min = this.minFront();
    if (this.front[col] - min < tune.terrain.maxLead) return col;
    let best = col;
    let bestDist = Infinity;
    for (let c = 0; c < this.front.length; c++) {
      if (this.front[c] !== min) continue;
      const d = Math.abs(c - col);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    return best;
  }

  /** Applies one hit for `col`; returns what happened. */
  hit(col: number): HitResult {
    const c = this.targetColumn(col);
    const row = this.front[c];
    const cell = this.cell(row, c);
    cell.hp = Math.max(0, cell.hp - tune.dig.damage);
    const broke = cell.hp === 0;
    if (broke) {
      cell.broken = true;
      this.front[c]++;
      this.blocksDug++;
    }
    return { col: c, row, hp: cell.hp, maxHp: cell.maxHp, broke, gem: broke ? cell.gem : 0 };
  }
}
