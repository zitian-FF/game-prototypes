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
    for (const ring of tune.map.rings) {
      assert.deepEqual(kindsIn(map.nodes, ring.tier), ring.nodes, `seed ${seed} tier ${ring.tier}`);
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
  assert.ok(meanR(4) < meanR(3) && meanR(3) < meanR(2) && meanR(2) < meanR(1));
  // Power nodes only live in tiers 1 and 2, and tiers 3 and 4 are pure points.
  for (const n of map.nodes) if (n.tier >= 3) assert.equal(n.kind, 'points');
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

test('map: crossing the whole map takes about 3 minutes at base speed', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(1), tune);
  assert.ok(Math.abs(Math.hypot(map.width, map.height) / baseSpeed(map, tune) - 180) < 1e-9);
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
