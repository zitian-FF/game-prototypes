import Phaser from 'phaser';
import type { TileState, Treasure } from './types';
import tune from '../../tune.json';

// Depth-scaled base HP, jittered by the same +/-1 spread the original
// Phaser.Math.Between(1, 3) placeholder used (there min 1, center 2).
function rollTileHp(depth: number): number {
  const base = tune.baseTileHp * Math.pow(tune.tileHpDepthMultiplier, depth);
  const jitter = Phaser.Math.Between(-1, 1);
  return Math.max(1, Math.round(base) + jitter);
}

// Treasure footprint shapes, as relative (col, row) offsets from an anchor
// cell. Structural shapes, not sliders, so these live as a code constant
// rather than tune.json. Only the L-tromino (last entry) gets randomly
// rotated at placement time -- the other three are already listed in both
// orientations where that matters (horizontal/vertical) or are rotation-
// symmetric (the square).
type Offset = readonly [number, number];
type Shape = readonly Offset[];

const TREASURE_SHAPES: Shape[] = [
  [
    [0, 0],
    [1, 0],
  ], // 2x1 horizontal
  [
    [0, 0],
    [0, 1],
  ], // 2x1 vertical
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ], // 2x2 square
  [
    [0, 0],
    [1, 0],
    [0, 1],
  ], // L-tromino
];
const L_TROMINO_SHAPE_INDEX = TREASURE_SHAPES.length - 1;

// Rotates a shape 90deg clockwise `rotations` times, then normalizes it back
// to non-negative offsets from its own bounding box's top-left corner, so
// the rotated shape still composes with an anchor cell the same way the
// original does.
function rotateShape(shape: Shape, rotations: number): Shape {
  let cells: Offset[] = shape.map(([col, row]) => [col, row]);
  for (let i = 0; i < rotations; i++) {
    cells = cells.map(([col, row]) => [-row, col] as Offset);
  }
  const minCol = Math.min(...cells.map(([col]) => col));
  const minRow = Math.min(...cells.map(([, row]) => row));
  return cells.map(([col, row]) => [col - minCol, row - minRow] as Offset);
}

const TREASURE_PLACEMENT_RETRIES = 20;

interface TreasurePlacement {
  cells: number[];
  value: number;
}

// Picks a random treasure count within [countMin, countMax] and tries to
// place each one at a random shape/rotation/anchor, retrying on collision
// or out-of-bounds up to TREASURE_PLACEMENT_RETRIES times. A treasure that
// never finds a valid spot is simply skipped -- the board ends up with
// fewer treasures than requested rather than looping indefinitely.
function placeTreasures(cols: number, rows: number, depth: number): TreasurePlacement[] {
  const count = Phaser.Math.Between(tune.treasure.countMin, tune.treasure.countMax);
  const claimed = new Set<number>();
  const placements: TreasurePlacement[] = [];

  for (let t = 0; t < count; t++) {
    for (let attempt = 0; attempt < TREASURE_PLACEMENT_RETRIES; attempt++) {
      const shapeIndex = Phaser.Math.Between(0, TREASURE_SHAPES.length - 1);
      const shape =
        shapeIndex === L_TROMINO_SHAPE_INDEX
          ? rotateShape(TREASURE_SHAPES[shapeIndex], Phaser.Math.Between(0, 3))
          : TREASURE_SHAPES[shapeIndex];

      const anchorCol = Phaser.Math.Between(0, cols - 1);
      const anchorRow = Phaser.Math.Between(0, rows - 1);

      const cells: number[] = [];
      let valid = true;
      for (const [dCol, dRow] of shape) {
        const col = anchorCol + dCol;
        const row = anchorRow + dRow;
        if (col < 0 || col >= cols || row < 0 || row >= rows) {
          valid = false;
          break;
        }
        const index = row * cols + col;
        if (claimed.has(index)) {
          valid = false;
          break;
        }
        cells.push(index);
      }
      if (!valid) continue;

      for (const index of cells) claimed.add(index);
      const value = Math.round(
        tune.treasure.valuePerCellBase * cells.length * Math.pow(tune.treasure.valueDepthMultiplier, depth)
      );
      placements.push({ cells, value });
      break;
    }
  }

  return placements;
}

// Minesweeper-style 8-directional neighbor count: for every cell, how many
// of its up-to-8 surrounding cells belong to any treasure's footprint.
// Computed once from the fixed layout, not recalculated as tiles clear.
function computeAdjacency(cols: number, rows: number, claimed: ReadonlySet<number>): number[] {
  const adjacency: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let count = 0;
      for (let dRow = -1; dRow <= 1; dRow++) {
        for (let dCol = -1; dCol <= 1; dCol++) {
          if (dCol === 0 && dRow === 0) continue;
          const neighborCol = col + dCol;
          const neighborRow = row + dRow;
          if (neighborCol < 0 || neighborCol >= cols || neighborRow < 0 || neighborRow >= rows) continue;
          if (claimed.has(neighborRow * cols + neighborCol)) count++;
        }
      }
      adjacency.push(count);
    }
  }
  return adjacency;
}

export interface GeneratedBoard {
  tiles: TileState[];
  treasures: Treasure[];
}

export function generateBoard(depth: number): GeneratedBoard {
  const cols = tune.gridCols;
  const rows = tune.gridRowsBase;

  const placements = placeTreasures(cols, rows, depth);
  const claimed = new Set<number>();
  for (const placement of placements) {
    for (const index of placement.cells) claimed.add(index);
  }
  const adjacency = computeAdjacency(cols, rows, claimed);

  const tiles: TileState[] = [];
  for (let i = 0; i < cols * rows; i++) {
    tiles.push({ hp: rollTileHp(depth), revealed: false, adjacent: adjacency[i], treasureIndex: null });
  }

  const treasures: Treasure[] = placements.map((placement, treasureIndex) => {
    for (const index of placement.cells) tiles[index].treasureIndex = treasureIndex;
    return { cells: placement.cells, value: placement.value, clearedCount: 0 };
  });

  return { tiles, treasures };
}

export function shipDamage(shipLevel: number): number {
  return tune.baseDamage + (shipLevel - 1) * tune.damagePerLevel;
}

export function upgradeCost(shipLevel: number): number {
  return Math.round(tune.upgradeCostBase * Math.pow(tune.upgradeCostGrowth, shipLevel - 1));
}
