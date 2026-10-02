import assert from 'node:assert/strict';
import { baseSpeed, dist, generateMap, safeZoneSlotPos } from '../src/map';
import { Rng } from '../src/rng';
import { NODE_KINDS } from '../src/types';
import { test } from './harness';
import { loadTune } from './helpers';

test('map: node counts per kind match tune', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(1), tune);
  for (const kind of NODE_KINDS) {
    assert.equal(map.nodes.filter((n) => n.kind === kind).length, tune.map.nodeCounts[kind], kind);
  }
  assert.equal(new Set(map.nodes.map((n) => n.id)).size, map.nodes.length);
});

test('map: layout is point-symmetric so both teams are even', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(2), tune);
  for (const n of map.nodes) {
    const twin = map.nodes.find((m) => Math.abs(m.pos.x - (map.width - n.pos.x)) < 1e-9 && Math.abs(m.pos.y - (map.height - n.pos.y)) < 1e-9);
    assert.ok(twin, `${n.id} has no mirror`);
    assert.equal(twin!.kind, n.kind);
  }
  assert.ok(Math.abs(map.safeZones[0].center.x + map.safeZones[1].center.x - map.width) < 1e-9);
});

test('map: spacing, margins and safe zone clearance respected', () => {
  const tune = loadTune();
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(new Rng(seed), tune);
    for (let i = 0; i < map.nodes.length; i++) {
      const a = map.nodes[i];
      assert.ok(a.pos.x >= 0 && a.pos.x <= map.width && a.pos.y >= 0 && a.pos.y <= map.height);
      for (let j = i + 1; j < map.nodes.length; j++) {
        assert.ok(dist(a.pos, map.nodes[j].pos) >= tune.map.nodeMinSpacing - 1e-9, `${a.id}/${map.nodes[j].id} too close`);
      }
      for (const z of map.safeZones) assert.ok(dist(a.pos, z.center) >= tune.map.nodeMinDistFromSafeZone - 1e-9);
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
  const diag = Math.hypot(map.width, map.height);
  assert.ok(Math.abs(diag / baseSpeed(map, tune) - 180) < 1e-9);
});

test('map: 20 HQs fit in a safe zone, all distinct and inside it', () => {
  const tune = loadTune();
  const map = generateMap(new Rng(1), tune);
  for (const team of [0, 1] as const) {
    const seen = new Set<string>();
    for (let i = 0; i < tune.match.playersPerTeam; i++) {
      const p = safeZoneSlotPos(map, team, i, tune);
      seen.add(`${p.x},${p.y}`);
      assert.ok(dist(p, map.safeZones[team].center) <= map.safeZones[team].radius * Math.SQRT2, `HQ ${i} outside zone`);
    }
    assert.equal(seen.size, tune.match.playersPerTeam);
  }
});
