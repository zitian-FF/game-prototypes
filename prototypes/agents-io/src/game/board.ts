// Blueprint geometry. Everything snaps to a grid of CELL logical pixels; nodes and wire
// corners sit on grid lines, so ports always line up with the wires that reach them.
// The flow runs left to right: inputs on a node's left edge, outputs on its right edge.
export const CELL = 24;
export const COLS = 44;
export const ROWS = 30;
export const BOARD_W = COLS * CELL;
export const BOARD_H = ROWS * CELL;

export const AGENT_CELLS = { w: 8, h: 4 };
/** INPUT and DELIVER are tall cards at the two ends of the board. */
export const END_CELLS = { w: 6, h: 6 };
export const IN_ANCHOR = { x: 1, y: 12 };
export const OUT_ANCHOR = { x: 37, y: 12 };

/** A rectangle in grid cells. */
export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Empty cells that must stay free around a node, so wires and ports have room. */
const GAP = 1;

export function rectsClash(a: CellRect, b: CellRect): boolean {
  return a.x - GAP < b.x + b.w && a.x + a.w + GAP > b.x && a.y - GAP < b.y + b.h && a.y + a.h + GAP > b.y;
}

export const inBounds = (r: CellRect): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= COLS && r.y + r.h <= ROWS;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Top-left cell for an agent whose centre sits on the cell under a click. */
export const anchorAround = (bx: number, by: number): { x: number; y: number } => ({
  x: clamp(Math.floor(bx / CELL) - AGENT_CELLS.w / 2, 0, COLS - AGENT_CELLS.w),
  y: clamp(Math.floor(by / CELL) - AGENT_CELLS.h / 2, 0, ROWS - AGENT_CELLS.h),
});

/** Top-left cell for a dragged agent, from where its top-left corner is in board pixels. */
export const anchorNear = (bx: number, by: number): { x: number; y: number } => ({
  x: clamp(Math.round(bx / CELL), 0, COLS - AGENT_CELLS.w),
  y: clamp(Math.round(by / CELL), 0, ROWS - AGENT_CELLS.h),
});

/** Cell offsets (from a node's top edge) for n ports down a side that is `len` cells tall, on grid lines. */
export const portCells = (n: number, len: number): number[] => {
  const mid = len / 2;
  return n >= 3 ? [mid - 2, mid, mid + 2] : n === 2 ? [mid - 1, mid + 1] : [mid];
};
