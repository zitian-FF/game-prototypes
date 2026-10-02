import type { Rng } from './rng';
import type { Cell, MapDef, MapNode, NodeKind, SafeZone, TeamId, Tune, Vec } from './types';

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** World position of the centre of a grid cell. */
export function cellCenter(cell: Cell, tune: Tune): Vec {
  const s = tune.map.cellSize;
  return { x: (cell.cx + 0.5) * s, y: (cell.cy + 0.5) * s };
}

/** Squad march speed in map units per second, from the cross-map target. */
export function baseSpeed(map: MapDef, tune: Tune): number {
  return Math.hypot(map.width, map.height) / tune.march.crossMapSeconds;
}

/**
 * The 8 cells around a node, in slot order: E, SE, S, SW, W, NW, N, NE.
 * Slot 0 is straight east, so a node's HQ ring is its 3x3 block.
 */
export const RING_OFFSETS: readonly Cell[] = [
  { cx: 1, cy: 0 },
  { cx: 1, cy: 1 },
  { cx: 0, cy: 1 },
  { cx: -1, cy: 1 },
  { cx: -1, cy: 0 },
  { cx: -1, cy: -1 },
  { cx: 0, cy: -1 },
  { cx: 1, cy: -1 },
];

/** Position of an HQ slot: the centre of one of the node's 8 neighbouring cells. */
export function ringSlotPos(nodePos: Vec, slot: number, tune: Tune): Vec {
  const o = RING_OFFSETS[slot];
  const s = tune.map.cellSize;
  return { x: nodePos.x + o.cx * s, y: nodePos.y + o.cy * s };
}

/** Fixed cell for each HQ index inside a team's safe zone block. */
export function safeZoneSlotPos(map: MapDef, team: TeamId, index: number, tune: Tune): Vec {
  const zone = map.safeZones[team];
  const col = index % zone.cols;
  const row = Math.floor(index / zone.cols);
  return cellCenter({ cx: zone.origin.cx + col, cy: zone.origin.cy + row }, tune);
}

function safeZoneBlocks(tune: Tune): [SafeZone, SafeZone] {
  const m = tune.map;
  const z = m.safeZone;
  const rowStart = Math.floor((m.heightCells - z.rows) / 2);
  const left: Cell = { cx: z.insetCells, cy: rowStart };
  // Point reflection of the left block, so the two zones mirror exactly.
  const right: Cell = {
    cx: m.widthCells - 1 - (left.cx + z.cols - 1),
    cy: m.heightCells - 1 - (left.cy + z.rows - 1),
  };
  const make = (origin: Cell): SafeZone => ({
    origin,
    cols: z.cols,
    rows: z.rows,
    center: cellCenter({ cx: origin.cx + (z.cols - 1) / 2, cy: origin.cy + (z.rows - 1) / 2 }, tune),
  });
  return [make(left), make(right)];
}

/** Cells (Chebyshev) between a cell and a safe zone block; 0 if inside it. */
function cellsFromZone(cell: Cell, zone: SafeZone): number {
  const dx = Math.max(zone.origin.cx - cell.cx, 0, cell.cx - (zone.origin.cx + zone.cols - 1));
  const dy = Math.max(zone.origin.cy - cell.cy, 0, cell.cy - (zone.origin.cy + zone.rows - 1));
  return Math.max(dx, dy);
}

/** 0 at the centre of the map, 1 at the middle of an edge. */
function ringRadius(cell: Cell, tune: Tune): number {
  const m = tune.map;
  const mx = (m.widthCells - 1) / 2;
  const my = (m.heightCells - 1) / 2;
  return Math.hypot((cell.cx - mx) / (mx + 0.5), (cell.cy - my) / (my + 0.5));
}

/**
 * Generate a point-symmetric, grid-aligned map. Nodes sit on cell centres in
 * concentric rings (tier 1 outside, tier 4 in the middle), each ring's nodes
 * placed in the left half and mirrored through the centre so both teams get
 * an identical layout. Each node keeps a 3x3 block free for its HQ slots.
 */
export function generateMap(rng: Rng, tune: Tune): MapDef {
  const m = tune.map;
  if (m.widthCells % 2 === 0 || m.heightCells % 2 === 0) {
    throw new Error('map width and height in cells must be odd so there is a centre cell');
  }
  const zones = safeZoneBlocks(tune);
  const mirror = (c: Cell): Cell => ({ cx: m.widthCells - 1 - c.cx, cy: m.heightCells - 1 - c.cy });
  const centerCell: Cell = { cx: (m.widthCells - 1) / 2, cy: (m.heightCells - 1) / 2 };
  const placed: Cell[] = [];
  const nodes: MapNode[] = [];
  let id = 0;

  const cheb = (a: Cell, b: Cell) => Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy));
  const clear = (c: Cell) =>
    placed.every((o) => cheb(c, o) >= m.nodeMinSpacingCells) &&
    cellsFromZone(c, zones[0]) >= m.nodeMinDistFromSafeZoneCells &&
    cellsFromZone(c, zones[1]) >= m.nodeMinDistFromSafeZoneCells;

  const add = (kind: NodeKind, tier: number, cell: Cell) => {
    placed.push(cell);
    nodes.push({ id: `n${id++}`, kind, tier, cell, pos: cellCenter(cell, tune) });
  };

  for (const ring of m.rings) {
    if (ring.center) {
      for (const [kind, count] of Object.entries(ring.nodes) as [NodeKind, number][]) {
        if (count !== 1) throw new Error('the centre ring holds exactly one node');
        add(kind, ring.tier, centerCell);
      }
      continue;
    }
    for (const [kind, count] of Object.entries(ring.nodes) as [NodeKind, number][]) {
      if (count % 2 !== 0) throw new Error(`ring tier ${ring.tier}: ${kind} count must be even for a symmetric map`);
      for (let n = 0; n < count / 2; n++) {
        let ok = false;
        for (let attempt = 0; attempt < 8000 && !ok; attempt++) {
          const cell: Cell = {
            cx: rng.int(m.edgeMarginCells, centerCell.cx - 1),
            cy: rng.int(m.edgeMarginCells, m.heightCells - 1 - m.edgeMarginCells),
          };
          const r = ringRadius(cell, tune);
          if (r < ring.minR || r > ring.maxR) continue;
          const twin = mirror(cell);
          if (cheb(cell, twin) < m.nodeMinSpacingCells) continue;
          if (!clear(cell)) continue;
          placed.push(cell);
          const ok2 = clear(twin);
          placed.pop();
          if (!ok2) continue;
          add(kind, ring.tier, cell);
          add(kind, ring.tier, twin);
          ok = true;
        }
        if (!ok) throw new Error(`map generation: could not place ${kind} in ring tier ${ring.tier}, loosen the rings or spacing`);
      }
    }
  }
  return { width: m.widthCells * m.cellSize, height: m.heightCells * m.cellSize, nodes, safeZones: zones };
}
