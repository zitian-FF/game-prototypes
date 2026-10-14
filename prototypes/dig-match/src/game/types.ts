export interface Block {
  id: number;
  /** Colour index. Ignored for rocks. */
  color: number;
  /** Hardened block: cannot be swapped or matched, chipped by neighbouring matches. */
  rock: boolean;
  hp: number;
  /** Weak point: matching it gives its neighbouring rocks an extra chip. */
  weak: boolean;
}

export interface Board {
  cols: number;
  rows: number;
  /** Row-major, index = row * cols + col. Row 0 is the top (the surface). */
  cells: (Block | null)[];
  nextId: number;
  /** Blocks cleared so far, rocks included. Depth is derived from this. */
  cleared: number;
}

export interface StepClear {
  idx: number;
  block: Block;
}

export interface StepChip {
  idx: number;
  id: number;
  hp: number;
}

export interface StepMove {
  id: number;
  from: number;
  to: number;
}

export interface StepSpawn {
  block: Block;
  to: number;
  /** Row the block starts from, below the visible board. */
  fromRow: number;
}

/** One cascade step: what broke, what was chipped, and how everything settled. */
export interface Step {
  /** 1 for the player's own match, 2 and up for chain reactions. */
  chain: number;
  runs: number[][];
  cleared: StepClear[];
  chips: StepChip[];
  moves: StepMove[];
  spawns: StepSpawn[];
}

export interface Resolution {
  steps: Step[];
  /** Colour changes when the board had no valid move and was reshuffled. */
  reshuffle: { id: number; color: number }[] | null;
}
