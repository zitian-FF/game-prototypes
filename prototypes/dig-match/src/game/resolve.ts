import type { Rng } from 'dig-kit';
import { tune } from '../tune';
import { findRuns, findValidMove, makeBlock, neighbours, wouldMatch } from './board';
import type { Block, Board, Resolution, Step } from './types';

/** Re-colours normal blocks until there are no matches and at least one valid move. */
function reshuffle(board: Board, rng: Rng): { id: number; color: number }[] {
  const normals = board.cells.filter((b): b is Block => !!b && !b.rock);
  for (let attempt = 0; attempt < 200; attempt++) {
    const colors = normals.map((b) => b.color);
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    // After the first few tries stop reusing the old colours and draw fresh ones.
    normals.forEach((b, k) => (b.color = attempt < 100 ? colors[k] : Math.floor(rng() * tune.colors)));
    if (findRuns(board).length === 0 && findValidMove(board)) break;
  }
  return normals.map((b) => ({ id: b.id, color: b.color }));
}

/**
 * Applies cascades to the board until it is stable and returns what happened
 * step by step, so the scene can animate it. Gravity points up: blocks rise
 * toward row 0 and new blocks enter from the bottom.
 */
export function resolveBoard(board: Board, rng: Rng): Resolution {
  const steps: Step[] = [];
  const { cols, rows } = board;
  for (let chain = 1; ; chain++) {
    const runs = findRuns(board);
    if (runs.length === 0) break;
    const clearSet = new Set<number>(runs.flat());
    const step: Step = { chain, runs, cleared: [], chips: [], moves: [], spawns: [] };

    // Rocks next to cleared blocks are chipped once per step; a weak point makes it harder.
    const chipAmount = new Map<number, number>();
    for (const i of clearSet) {
      const weak = board.cells[i]?.weak ?? false;
      for (const n of neighbours(board, i)) {
        const nb = board.cells[n];
        if (!nb || !nb.rock || clearSet.has(n)) continue;
        const base = chipAmount.get(n) ?? tune.hardened.chipPerMatch;
        chipAmount.set(n, weak ? Math.max(base, tune.hardened.chipPerMatch + tune.hardened.weakBonusChip) : base);
      }
    }
    for (const [i, amount] of chipAmount) {
      const rock = board.cells[i]!;
      rock.hp = Math.max(0, rock.hp - amount);
      if (rock.hp === 0) clearSet.add(i);
      else step.chips.push({ idx: i, id: rock.id, hp: rock.hp });
    }

    for (const i of clearSet) {
      step.cleared.push({ idx: i, block: board.cells[i]! });
      board.cells[i] = null;
    }
    board.cleared += step.cleared.length;

    // Rise: per column, the surviving blocks keep their order and move up to the top.
    for (let c = 0; c < cols; c++) {
      let write = 0;
      for (let r = 0; r < rows; r++) {
        const b = board.cells[r * cols + c];
        if (!b) continue;
        if (r !== write) {
          step.moves.push({ id: b.id, from: r * cols + c, to: write * cols + c });
          board.cells[write * cols + c] = b;
          board.cells[r * cols + c] = null;
        }
        write++;
      }
    }
    // Refill the emptied bottom of each column. Placing in row order lets us dodge free matches.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (board.cells[i]) continue;
        let b = makeBlock(board, rng);
        if (!b.rock && rng() >= tune.refill.freeCascadeChance) {
          let guard = 0;
          while (wouldMatch(board, i, b.color) && guard++ < 20) b = { ...b, color: Math.floor(rng() * tune.colors) };
        }
        board.cells[i] = b;
        // Spawn just below the board edge, stacked in the order they were made.
        step.spawns.push({ block: b, to: i, fromRow: rows + (step.spawns.filter((s) => s.to % cols === c).length) });
      }
    }
    steps.push(step);
  }

  let shuffled: Resolution['reshuffle'] = null;
  if (!findValidMove(board)) shuffled = reshuffle(board, rng);
  return { steps, reshuffle: shuffled };
}
