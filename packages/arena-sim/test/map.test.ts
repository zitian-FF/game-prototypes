import assert from 'node:assert/strict';
import { RING_OFFSETS, baseSpeed, cellCenter, dist, generateMap, ringSlotPos, safeZoneSlotPos } from '../src/map';
import { Rng } from '../src/rng';
import { test } from './harness';
import { loadTune } from './helpers';

const kindsIn = (nodes: { kind: string; tier: number }[], tier: number) => {
  const out: Record<string, number> = {};
  for (const n of nodes.filter((x) => x.tier === tier)) out[n.kind] = (out[n.kind] ?? 0) + 1;
  return out;
};

test('map: node counts per ring and kind match tune, tiers match their rings', () => {
  const tune = loadTune();
  for (const seed of [1, 2, 3]) {
    const map = generateMap(new Rng(seed), tune);
    // Expected per tier: a ring's kinds sit at the ring's tier unless kindTiers says otherwise.
    const want: Record<number, Record<string, number>> = {};
    for (const ring of tune.map.rings) {
      for (const [kind, count] of Object.entries(ring.nodes)) {
        const tier = ring.kindTiers?.[kind as keyof typeof ring.kindTiers] ?? ring.tier;
        (want[tier] ??= {})[kind] = ((want[tier] ??= {})[kind] ?? 0) + (count ?? 0);
      }
    }
    for (const [tier, kinds] of Object.entries(want)) {
      assert.deepEqual(kindsIn(map.nodes, Number(tier)), kinds, `seed ${seed} tier ${tier}`);
    }
    assert.equal(new Set(map.nodes.map((n) => n.id)).size, map.nodes.length);
  }
  const total = tune.map.rings.reduce((a, r) => a + Object.values(r.nodes).reduce((x, y) => x + (y ?? 0), 0), 0);
  assert.equal(generateMap(new Rng(1), tune).nodes.length, total);
});

test('map: everything is on the grid, centre cell holds the single tier 4 node', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(4), tune);
  const s = tune.map.cellSize;
  for (const n of map.nodes) {
    assert.ok(Number.isInteger(n.cell.cx) && Number.isInteger(n.cell.cy));
    assert.deepEqual(n.pos, cellCenter(n.cell, tune));
    assert.ok(n.cell.cx >= 0 && n.cell.cx < tune.map.widthCells && n.cell.cy >= 0 && n.cell.cy < tune.map.heightCells);
  }
  const t4 = map.nodes.filter((n) => n.tier === 4);
  assert.equal(t4.length, 1);
  assert.deepEqual(t4[0].cell, { cx: (tune.map.widthCells - 1) / 2, cy: (tune.map.heightCells - 1) / 2 });
  assert.equal(t4[0].kind, 'points');
  assert.equal(map.width, tune.map.widthCells * s);
});

test('map: rings run outside in, tier 4 in the middle, tier 1 on the outside', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(5), tune);
  const c = { x: map.width / 2, y: map.height / 2 };
  const meanR = (tier: number) => {
    const ns = map.nodes.filter((n) => n.tier === tier);
    return ns.reduce((a, n) => a + dist(n.pos, c), 0) / ns.length;
  };
  assert.ok(meanR(4) < meanR(3) && meanR(3) < meanR(1));
  // Tier 3 is the missile turrets, tier 4 the silo; refineries are tier 2.
  for (const n of map.nodes) if (n.tier >= 3) assert.ok(n.kind === 'points' || n.kind === 'turret');
});

test('map: layout is point-symmetric so both teams are even', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(2), tune);
  for (const n of map.nodes) {
    const twin = map.nodes.find((m) => m.cell.cx === tune.map.widthCells - 1 - n.cell.cx && m.cell.cy === tune.map.heightCells - 1 - n.cell.cy);
    assert.ok(twin, `${n.id} has no mirror`);
    assert.equal(twin!.kind, n.kind);
    assert.equal(twin!.tier, n.tier);
  }
  const [a, b] = map.safeZones;
  assert.ok(Math.abs(a.center.x + b.center.x - map.width) < 1e-9 && Math.abs(a.center.y + b.center.y - map.height) < 1e-9);
});

test('map: spacing keeps every node 3x3 slot block free, safe zones clear', () => {
  const tune = loadTune();
  const m = tune.map;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const map = generateMap(new Rng(seed), tune);
    for (let i = 0; i < map.nodes.length; i++) {
      const a = map.nodes[i];
      for (let j = i + 1; j < map.nodes.length; j++) {
        const b = map.nodes[j];
        const cheb = Math.max(Math.abs(a.cell.cx - b.cell.cx), Math.abs(a.cell.cy - b.cell.cy));
        assert.ok(cheb >= m.nodeMinSpacingCells, `${a.id}/${b.id} only ${cheb} cells apart`);
      }
      for (const z of map.safeZones) {
        const dx = Math.max(z.origin.cx - a.cell.cx, 0, a.cell.cx - (z.origin.cx + z.cols - 1));
        const dy = Math.max(z.origin.cy - a.cell.cy, 0, a.cell.cy - (z.origin.cy + z.rows - 1));
        assert.ok(Math.max(dx, dy) >= m.nodeMinDistFromSafeZoneCells, `${a.id} too near a safe zone`);
      }
    }
  }
});

test('map: same seed gives the same map', () => {
  const tune = loadTune();
  assert.deepEqual(generateMap(new Rng(9), tune), generateMap(new Rng(9), tune));
});

test('map: crossing the whole map takes the tuned edge-to-edge time at base speed', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(1), tune);
  assert.ok(Math.abs(Math.max(map.width, map.height) / baseSpeed(map, tune) - tune.march.edgeToEdgeSeconds) < 1e-9);
});

test('map: the 8 HQ slots are exactly the 8 cells around the node', () => {
  const tune = loadTune();
  const s = tune.map.cellSize;
  const node = { x: 20 * s + s / 2, y: 10 * s + s / 2 };
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) {
    const p = ringSlotPos(node, i, tune);
    seen.add(`${p.x},${p.y}`);
    const dx = Math.round((p.x - node.x) / s);
    const dy = Math.round((p.y - node.y) / s);
    assert.deepEqual({ cx: dx, cy: dy }, RING_OFFSETS[i]);
    assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) === 1);
  }
  assert.equal(seen.size, 8);
  assert.deepEqual(ringSlotPos(node, 0, tune), { x: node.x + s, y: node.y }, 'slot 0 is straight east');
});

test('map: 20 HQs fit in a safe zone block, one per cell, none overlapping', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(1), tune);
  for (const team of [0, 1] as const) {
    const seen = new Set<string>();
    const z = map.safeZones[team];
    for (let i = 0; i < tune.match.playersPerTeam; i++) {
      const p = safeZoneSlotPos(map, team, i, tune);
      seen.add(`${p.x},${p.y}`);
      assert.ok(p.x >= z.origin.cx * tune.map.cellSize && p.x <= (z.origin.cx + z.cols) * tune.map.cellSize);
      assert.ok(p.y >= z.origin.cy * tune.map.cellSize && p.y <= (z.origin.cy + z.rows) * tune.map.cellSize);
    }
    assert.equal(seen.size, tune.match.playersPerTeam);
  }
});

test('map: the real layout has the silo, 2 refineries (tier 2), 2 turrets (tier 3), 2 radars, 4 boosts and 4 hospitals', () => {
  const tune = loadTune();
  for (const seed of [1, 2, 3, 4]) {
    const map = generateMap(new Rng(seed), tune);
    const count = (kind: string, tier?: number) => map.nodes.filter((n) => n.kind === kind && (tier === undefined || n.tier === tier)).length;
    assert.equal(map.nodes.length, 23, `seed ${seed}`);
    assert.equal(count('portal'), 4, 'portal nexus');
    assert.equal(count('points', 4), 1, 'nuclear silo');
    assert.equal(count('points', 2), 2, 'oil refineries are tier 2');
    assert.equal(count('turret', 3), 2, 'missile turrets are tier 3');
    assert.equal(count('largeVision', 2), 2, 'radar towers');
    for (const kind of ['attackBoost', 'defenseBoost', 'speedBoost', 'teleportCooldown']) assert.equal(count(kind, 1), 2, kind);
    assert.equal(count('hospital', 1), 4, 'two hospitals each side');
    // One of each outer building per side of the map.
    const mid = map.width / 2;
    for (const kind of ['attackBoost', 'defenseBoost', 'speedBoost', 'teleportCooldown', 'hospital', 'largeVision', 'turret', 'portal']) {
      const left = map.nodes.filter((n) => n.kind === kind && n.pos.x < mid).length;
      assert.equal(left, kind === 'hospital' || kind === 'portal' ? 2 : 1, `${kind} per half`);
    }
  }
});

test('map: radar towers are placed to see the tier 3 and 4 nodes first', () => {
  const tune = loadTune();
  const reach = tune.nodes.largeVision.visionRadiusCells * tune.map.cellSize;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const map = generateMap(new Rng(seed), tune);
    const high = map.nodes.filter((n) => n.tier >= 3);
    for (const radar of map.nodes.filter((n) => n.kind === 'largeVision')) {
      const seenHigh = high.filter((o) => dist(o.pos, radar.pos) <= reach).length;
      assert.ok(seenHigh >= 2, `seed ${seed}: radar ${radar.id} sees only ${seenHigh} of the ${high.length} high tier nodes`);
    }
  }
});

test('map: tier 1 and 2 nodes sit toward their own spawn side so there is early action', () => {
  const tune = loadTune();
  const hi = (tune.map.widthCells - 1) / 2;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const map = generateMap(new Rng(seed), tune);
    for (const n of map.nodes.filter((x) => x.tier <= 2 && x.kind !== 'largeVision')) {
      const own = Math.min(n.cell.cx, tune.map.widthCells - 1 - n.cell.cx); // columns from its nearest edge
      const ring = tune.map.rings.find((r) => (r.kindTiers?.[n.kind] ?? r.tier) === n.tier && r.nodes[n.kind])!;
      assert.ok(own <= Math.round((hi - 1) * (ring.spawnBand?.[1] ?? 1)) + 1, `seed ${seed}: ${n.kind} at column ${own}`);
    }
  }
});

test('map: tier 1 and 2 nodes are evenly spaced, never crowded together', () => {
  const tune = loadTune();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const map = generateMap(new Rng(seed), tune);
    const low = map.nodes.filter((n) => n.tier <= 2);
    const nearest = low.map((a) => Math.min(...map.nodes.filter((b) => b !== a).map((b) => Math.hypot(a.cell.cx - b.cell.cx, a.cell.cy - b.cell.cy))));
    assert.ok(Math.min(...nearest) >= 4, `seed ${seed}: two nodes only ${Math.min(...nearest).toFixed(1)} cells apart`);
    assert.ok(nearest.reduce((a, b) => a + b, 0) / nearest.length >= 6, `seed ${seed}: mean gap too small`);
  }
});

test('map: the map is a square, and the first nodes are within a couple of minutes of every spawn', () => {
  const tune = loadTune();
  assert.equal(tune.map.widthCells, tune.map.heightCells, 'square');
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const map = generateMap(new Rng(seed), tune);
    const speed = Math.max(map.width, map.height) / tune.march.edgeToEdgeSeconds; // units per second
    for (const zone of map.safeZones) {
      const secondsTo = map.nodes
        .filter((n) => n.kind !== 'portal' && n.tier <= 2)
        .map((n) => dist(zone.center, n.pos) / speed)
        .sort((a, b) => a - b);
      // At least four capturable nodes are under two minutes away from each spawn.
      assert.ok(secondsTo[3] <= 120, `seed ${seed}: fourth nearest node is ${Math.round(secondsTo[3])}s away`);
    }
  }
});
