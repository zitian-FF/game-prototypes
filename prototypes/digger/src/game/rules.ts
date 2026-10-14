import { tune } from '../tune';
import { aliveLayers, surfaceLayer, topLayer } from './board';
import { pickWeighted, randInt } from './rng';
import type { Board, Cell, Face, Hit, Rng, ToolId } from './types';

export function diceCount(tool: ToolId, rng: Rng): number {
  const t = tune.tools[tool];
  return randInt(rng, t.diceMin, t.diceMax);
}

export function rollFaces(n: number, rng: Rng): Face[] {
  const out: Face[] = [];
  for (let i = 0; i < n; i++) out.push(pickWeighted<Face>(rng, tune.faceWeights));
  return out;
}

function pick<T>(list: T[], rng: Rng): T | null {
  return list.length ? list[Math.floor(rng() * list.length)] : null;
}

function pickTarget(board: Board, face: Face, rng: Rng): Cell | null {
  const top = topLayer(board);
  if (top < 0) return null;
  const topCells = board.cells.filter((c) => surfaceLayer(c) === top);
  switch (face) {
    case 'strike':
    case 'critical':
      return pick(topCells, rng);
    case 'wild':
      return pick(board.cells.filter((c) => surfaceLayer(c) >= 0), rng);
    case 'lucky':
      // Falls back to any top-layer tile when no treasure is left above.
      return pick(topCells.filter((c) => c.treasure !== null), rng) ?? pick(topCells, rng);
    default:
      return null;
  }
}

/**
 * Picks a target for the face and applies the damage. Returns null for a miss
 * or when the board is already cleared. Targets are chosen at resolve time so
 * a roll's later dice see the damage of its earlier ones.
 */
export function resolveFace(board: Board, face: Face, tool: ToolId, rng: Rng): Hit | null {
  if (face === 'miss') return null;
  const cell = pickTarget(board, face, rng);
  if (!cell) return null;
  const layer = surfaceLayer(cell);
  const tile = cell.tiles[layer];
  const base = tune.faceDamage[face];
  // A weak point ignores hardness. Otherwise a tool below the tile's
  // hardness tier only scratches it.
  const glancing = !tile.weak && tune.tools[tool].tier < tile.hardness && base > tune.glancingDamage;
  let dmg = glancing ? tune.glancingDamage : base;
  if (tile.weak) dmg *= tune.weakPointMultiplier;
  tile.hp = Math.max(0, tile.hp - dmg);
  const broke = tile.hp === 0;
  const cleared = broke && aliveLayers(cell) === 0;
  return {
    cell: cell.idx,
    layer,
    face,
    dmg,
    glancing,
    weak: tile.weak,
    broke,
    cleared,
    treasureRevealed: cleared && cell.treasure !== null,
  };
}
