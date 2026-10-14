import type { Rng } from 'dig-kit';
import { tune } from '../tune';
import type { Block, Board } from './types';


export const idx = (board: Board, col: number, row: number): number => row * board.cols + col;
export const colOf = (board: Board, i: number): number => i % board.cols;
export const rowOf = (board: Board, i: number): number => Math.floor(i / board.cols);

export function depthMeters(board: Board): number {
  return board.cleared / tune.depth.blocksPerMeter;
}

export function rockChance(meters: number): number {
  return Math.min(tune.hardened.maxChance, tune.hardened.baseChance + tune.hardened.perMeter * meters);
}

export function makeBlock(board: Board, rng: Rng, color?: number): Block {
  const meters = depthMeters(board);
  const rock = rng() < rockChance(meters);
  const hp = rock ? tune.hardened.hpMin + Math.floor(rng() * (tune.hardened.hpMax - tune.hardened.hpMin + 1)) : 1;
  return {
    id: board.nextId++,
    color: color ?? Math.floor(rng() * tune.colors),
    rock,
    hp,
    weak: !rock && rng() < tune.hardened.weakChance,
  };
}

export function neighbours(board: Board, i: number): number[] {
  const c = colOf(board, i);
  const r = rowOf(board, i);
  const out: number[] = [];
  if (c > 0) out.push(i - 1);
  if (c < board.cols - 1) out.push(i + 1);
  if (r > 0) out.push(i - board.cols);
  if (r < board.rows - 1) out.push(i + board.cols);
  return out;
}

const same = (a: Block | null | undefined, b: Block | null | undefined): boolean =>
  !!a && !!b && !a.rock && !b.rock && a.color === b.color;

/** Would putting `color` (a normal block) at cell i complete a line of 3 with what is already placed? */
export function wouldMatch(board: Board, i: number, color: number): boolean {
  const probe: Block = { id: -1, color, rock: false, hp: 1, weak: false };
  const c = colOf(board, i);
  const r = rowOf(board, i);
  const at = (cc: number, rr: number): Block | null =>
    cc < 0 || rr < 0 || cc >= board.cols || rr >= board.rows ? null : board.cells[rr * board.cols + cc];
  for (const [dc, dr] of [[1, 0], [0, 1]]) {
    for (let off = -2; off <= 0; off++) {
      const cells = [0, 1, 2].map((k) => (k + off === 0 ? probe : at(c + (k + off) * dc, r + (k + off) * dr)));
      if (same(cells[0], cells[1]) && same(cells[1], cells[2])) return true;
    }
  }
  return false;
}

/** Runs of 3 or more same-coloured normal blocks, as lists of cell indices. */
export function findRuns(board: Board): number[][] {
  const runs: number[][] = [];
  for (let r = 0; r < board.rows; r++) {
    let c = 0;
    while (c < board.cols) {
      const b = board.cells[r * board.cols + c];
      let len = 1;
      if (b && !b.rock) while (c + len < board.cols && same(b, board.cells[r * board.cols + c + len])) len++;
      if (len >= 3) runs.push(Array.from({ length: len }, (_, k) => r * board.cols + c + k));
      c += len;
    }
  }
  for (let c = 0; c < board.cols; c++) {
    let r = 0;
    while (r < board.rows) {
      const b = board.cells[r * board.cols + c];
      let len = 1;
      if (b && !b.rock) while (r + len < board.rows && same(b, board.cells[(r + len) * board.cols + c])) len++;
      if (len >= 3) runs.push(Array.from({ length: len }, (_, k) => (r + k) * board.cols + c));
      r += len;
    }
  }
  return runs;
}

export function swapCells(board: Board, a: number, b: number): void {
  const t = board.cells[a];
  board.cells[a] = board.cells[b];
  board.cells[b] = t;
}

export function areAdjacent(board: Board, a: number, b: number): boolean {
  return neighbours(board, a).includes(b);
}

export function canSwap(board: Board, a: number, b: number): boolean {
  const x = board.cells[a];
  const y = board.cells[b];
  return areAdjacent(board, a, b) && !!x && !!y && !x.rock && !y.rock;
}

/** A swap that would make a match, or null. */
export function findValidMove(board: Board): [number, number] | null {
  for (let i = 0; i < board.cells.length; i++) {
    const c = colOf(board, i);
    const r = rowOf(board, i);
    const cands: number[] = [];
    if (c < board.cols - 1) cands.push(i + 1);
    if (r < board.rows - 1) cands.push(i + board.cols);
    for (const j of cands) {
      if (!canSwap(board, i, j)) continue;
      swapCells(board, i, j);
      const ok = findRuns(board).length > 0;
      swapCells(board, i, j);
      if (ok) return [i, j];
    }
  }
  return null;
}

/** A fresh board with no ready-made matches and at least one valid move. */
export function generateBoard(rng: Rng): Board {
  const { cols, rows } = tune.grid;
  for (;;) {
    const board: Board = { cols, rows, cells: new Array(cols * rows).fill(null), nextId: 1, cleared: 0 };
    for (let i = 0; i < board.cells.length; i++) {
      let b = makeBlock(board, rng);
      let guard = 0;
      while (!b.rock && wouldMatch(board, i, b.color) && guard++ < 20) b = { ...b, color: Math.floor(rng() * tune.colors) };
      board.cells[i] = b;
    }
    if (findRuns(board).length === 0 && findValidMove(board)) return board;
  }
}
