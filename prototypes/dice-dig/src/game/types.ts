export type Face = 'miss' | 'strike' | 'critical' | 'wild' | 'lucky';
export type TileKind = 'soft' | 'normal' | 'hardened';
export type ToolId = 'pickaxe' | 'hammer' | 'c4';

export const FACES: Face[] = ['miss', 'strike', 'critical', 'wild', 'lucky'];
export const TOOLS: ToolId[] = ['pickaxe', 'hammer', 'c4'];
export const TOOL_LABEL: Record<ToolId, string> = { pickaxe: 'Pickaxe', hammer: 'Hammer', c4: 'C4' };

export interface Tile {
  kind: TileKind;
  hp: number;
  maxHp: number;
  hardness: number;
  weak: boolean;
}

export interface Cell {
  idx: number;
  col: number;
  row: number;
  /** tiles[0] is the top layer. A tile with hp 0 is broken. */
  tiles: Tile[];
  /** Index into Board.treasures, or null. Treasures sit under every layer. */
  treasure: number | null;
}

export interface Treasure {
  cell: number;
}

export interface Board {
  cols: number;
  rows: number;
  layers: number;
  cells: Cell[];
  treasures: Treasure[];
}

export interface Hit {
  cell: number;
  layer: number;
  face: Face;
  dmg: number;
  glancing: boolean;
  weak: boolean;
  broke: boolean;
  /** True when this hit removed the last layer of the cell. */
  cleared: boolean;
  treasureRevealed: boolean;
}
