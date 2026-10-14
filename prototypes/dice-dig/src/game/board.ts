import { tune } from '../tune';
import { type Rng, pickWeighted } from 'dig-kit';
import type { Board, Cell, Tile, TileKind } from './types';

const MAX_LAYERS = 3;

function layerKey(layer: number): 'layer1' | 'layer2' | 'layer3' {
  return `layer${Math.min(layer, MAX_LAYERS - 1) + 1}` as 'layer1' | 'layer2' | 'layer3';
}

function makeTile(rng: Rng, layer: number): Tile {
  const kind = pickWeighted<TileKind>(rng, tune.mix[layerKey(layer)]);
  const def = tune.tiles[kind];
  const hp = Math.max(1, Math.round(def.hp * tune.layerHpMultiplier[layerKey(layer)]));
  return {
    kind,
    hp,
    maxHp: hp,
    hardness: def.hardness + tune.layerHardnessBonus[layerKey(layer)],
    weak: rng() < tune.weakPointChance,
  };
}

export function generateBoard(rng: Rng): Board {
  const { cols, rows } = tune.grid;
  const layers = Math.max(1, Math.min(MAX_LAYERS, Math.round(tune.grid.layers)));
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tiles: Tile[] = [];
      for (let l = 0; l < layers; l++) tiles.push(makeTile(rng, l));
      cells.push({ idx: cells.length, col, row, tiles, treasure: null });
    }
  }
  const treasures: Board['treasures'] = [];
  const pool = cells.map((c) => c.idx);
  const count = Math.min(tune.treasureCount, pool.length);
  for (let i = 0; i < count; i++) {
    const pick = Math.floor(rng() * pool.length);
    const cellIdx = pool.splice(pick, 1)[0];
    cells[cellIdx].treasure = treasures.length;
    treasures.push({ cell: cellIdx });
  }
  return { cols, rows, layers, cells, treasures };
}

/** Index of the first unbroken tile in the cell, or -1 when fully cleared. */
export function surfaceLayer(cell: Cell): number {
  for (let i = 0; i < cell.tiles.length; i++) if (cell.tiles[i].hp > 0) return i;
  return -1;
}

export function aliveLayers(cell: Cell): number {
  let n = 0;
  for (const t of cell.tiles) if (t.hp > 0) n++;
  return n;
}

/** Shallowest layer index that still has an unbroken surface tile, or -1. */
export function topLayer(board: Board): number {
  let best = Infinity;
  for (const c of board.cells) {
    const s = surfaceLayer(c);
    if (s >= 0 && s < best) best = s;
  }
  return best === Infinity ? -1 : best;
}

export function tilesLeft(board: Board): number {
  let n = 0;
  for (const c of board.cells) n += aliveLayers(c);
  return n;
}

export function isCleared(board: Board): boolean {
  return board.cells.every((c) => surfaceLayer(c) < 0);
}
