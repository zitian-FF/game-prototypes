export interface TileState {
  hp: number;
  loot: number;
  revealed: boolean;
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
}
