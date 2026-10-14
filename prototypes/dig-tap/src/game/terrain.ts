import { mulberry32 } from 'dig-kit';
import { tune } from '../tune';

export interface TerrainCell {
  hp: number;
  maxHp: number;
  /** Index into the strata palette. */
  strata: number;
  /** Gem value buried under this block (before upgrades), 0 for none. */
  gem: number;
  broken: boolean;
}

export interface HitResult {
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  broke: boolean;
  gem: number;
  /** True when this break finished the whole row. */
  rowCleared: boolean;
}

export const STRATA_COUNT = 7;

export interface TerrainSave {
  seed: number;
  blocksDug: number;
  /** Damaged or broken cells as [row, col, hp]. */
  cells: [number, number, number][];
}

/**
 * The wall being dug: an endless stack of rows, tune.terrain.cols blocks wide.
 * Rows are generated on demand from the seed, so the same seed gives the same
 * wall, and only damage has to be saved.
 */
export class Terrain {
  private rows = new Map<number, TerrainCell[]>();
  blocksDug = 0;
  private top = 0;

  constructor(readonly seed: number) {}

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

  /** First row that still has an unbroken block. */
  topOpenRow(): number {
    while (this.row(this.top).every((c) => c.broken)) this.top++;
    return this.top;
  }

  depthMeters(): number {
    return this.topOpenRow() * tune.terrain.metersPerRow;
  }

  /** Applies `damage` to one block. Returns null if it is already broken. */
  hit(row: number, col: number, damage: number): HitResult | null {
    const cell = this.cell(row, col);
    if (cell.broken) return null;
    cell.hp = Math.max(0, cell.hp - damage);
    const broke = cell.hp === 0;
    let rowCleared = false;
    if (broke) {
      cell.broken = true;
      this.blocksDug++;
      rowCleared = this.row(row).every((c) => c.broken);
    }
    return { row, col, hp: cell.hp, maxHp: cell.maxHp, broke, gem: broke ? cell.gem : 0, rowCleared };
  }

  /**
   * Digs without any visuals, for offline progress: `taps` taps of `damage`,
   * always on the first unbroken block from the top left. Returns the summed
   * gem values found (before upgrades).
   */
  autoDig(taps: number, damage: number): { gems: number; blocks: number } {
    let gems = 0;
    let blocks = 0;
    let left = taps;
    while (left > 0) {
      const row = this.topOpenRow();
      const col = this.row(row).findIndex((c) => !c.broken);
      const cell = this.cell(row, col);
      const need = Math.ceil(cell.hp / damage);
      if (need > left) {
        cell.hp = Math.max(1, cell.hp - left * damage);
        break;
      }
      left -= need;
      const res = this.hit(row, col, cell.hp)!;
      gems += res.gem;
      blocks++;
    }
    return { gems, blocks };
  }

  serialize(): TerrainSave {
    const cells: TerrainSave['cells'] = [];
    for (const [r, row] of this.rows) row.forEach((c, i) => c.hp < c.maxHp && cells.push([r, i, c.hp]));
    return { seed: this.seed, blocksDug: this.blocksDug, cells };
  }

  static restore(save: TerrainSave): Terrain {
    const t = new Terrain(save.seed);
    t.blocksDug = save.blocksDug;
    for (const [r, c, hp] of save.cells) {
      const cell = t.cell(r, c);
      cell.hp = hp;
      cell.broken = hp <= 0;
    }
    return t;
  }
}
