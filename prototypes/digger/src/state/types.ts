export interface TileState {
  hp: number;
  revealed: boolean;
  // 8-directional treasure-neighbor count, computed once at board
  // generation (Minesweeper-style), independent of any tile's clear state.
  adjacent: number;
  // Index into GameState.treasures if this tile's cell belongs to a
  // treasure's footprint, otherwise null.
  treasureIndex: number | null;
}

export interface Treasure {
  // Tile indices (row * gridCols + col) making up this treasure's footprint.
  cells: number[];
  // Lump-sum payout, added to currency once, only when every cell in
  // `cells` has been cleared.
  value: number;
  clearedCount: number;
}

export interface GameState {
  energy: number;
  energyTimestamp: number;
  currency: number;
  shipLevel: number;
  depth: number;
  gridCols: number;
  gridRows: number;
  tiles: TileState[];
  treasures: Treasure[];
}
