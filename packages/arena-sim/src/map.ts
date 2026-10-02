import type { Rng } from './rng';
import { NODE_KINDS } from './types';
import type { MapDef, MapNode, TeamId, Tune, Vec } from './types';

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Squad march speed in map units per second, from the cross-map target. */
export function baseSpeed(map: MapDef, tune: Tune): number {
  return Math.hypot(map.width, map.height) / tune.march.crossMapSeconds;
}

/** Position of an HQ slot on the ring around a node. */
export function ringSlotPos(nodePos: Vec, slot: number, tune: Tune): Vec {
  const angle = (slot / tune.hq.slotsPerNode) * Math.PI * 2;
  const r = tune.hq.slotRingRadius;
  return { x: nodePos.x + Math.cos(angle) * r, y: nodePos.y + Math.sin(angle) * r };
}

/** Fixed position for each HQ index inside a team's safe zone (grid layout). */
export function safeZoneSlotPos(map: MapDef, team: TeamId, index: number, tune: Tune): Vec {
  const zone = map.safeZones[team];
  const spacing = tune.map.safeZoneSlotSpacing;
  const cols = Math.max(1, Math.floor((zone.radius * 2) / spacing));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: zone.center.x - zone.radius + spacing / 2 + col * spacing,
    y: zone.center.y - zone.radius + spacing / 2 + row * spacing,
  };
}

/**
 * Generate a point-symmetric map: nodes are placed in the left half and
 * mirrored through the centre, so both teams get an identical layout. Node
 * counts per kind must be even.
 */
export function generateMap(rng: Rng, tune: Tune): MapDef {
  const m = tune.map;
  const zoneA = { center: { x: m.safeZoneInset, y: m.height / 2 }, radius: m.safeZoneRadius };
  const zoneB = { center: { x: m.width - m.safeZoneInset, y: m.height / 2 }, radius: m.safeZoneRadius };
  const placed: Vec[] = [];
  const nodes: MapNode[] = [];
  const mirror = (p: Vec): Vec => ({ x: m.width - p.x, y: m.height - p.y });

  const fits = (p: Vec, q: Vec): boolean => {
    if (dist(p, q) < m.nodeMinSpacing) return false;
    for (const other of placed) {
      if (dist(p, other) < m.nodeMinSpacing || dist(q, other) < m.nodeMinSpacing) return false;
    }
    return (
      dist(p, zoneA.center) >= m.nodeMinDistFromSafeZone &&
      dist(q, zoneB.center) >= m.nodeMinDistFromSafeZone
    );
  };

  let id = 0;
  for (const kind of NODE_KINDS) {
    const count = m.nodeCounts[kind];
    if (count % 2 !== 0) throw new Error(`nodeCounts.${kind} must be even for a symmetric map`);
    for (let n = 0; n < count / 2; n++) {
      let placedOne = false;
      for (let attempt = 0; attempt < 5000 && !placedOne; attempt++) {
        const p = {
          x: rng.float(m.edgeMargin, m.width / 2 - m.nodeMinSpacing / 2),
          y: rng.float(m.edgeMargin, m.height - m.edgeMargin),
        };
        const q = mirror(p);
        if (!fits(p, q)) continue;
        placed.push(p, q);
        nodes.push({ id: `n${id++}`, kind, pos: p }, { id: `n${id++}`, kind, pos: q });
        placedOne = true;
      }
      if (!placedOne) throw new Error('map generation: could not place all nodes, loosen spacing');
    }
  }
  return { width: m.width, height: m.height, nodes, safeZones: [zoneA, zoneB] };
}
