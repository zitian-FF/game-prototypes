import assert from 'node:assert/strict';
import { ArenaGame, Rng, generateMap, rollPlayers, viewFor } from 'arena-sim';
import { applyPatch, diffViews, sameView, toWire } from '../src/wire';
import { test } from './harness';
import { loadTune } from './helpers';

function playedGame(seed: number, untilMs: number) {
  const tune = loadTune();
  const map = generateMap(new Rng(seed), tune);
  const players = rollPlayers(new Rng(seed + 1), tune, Array.from({ length: 40 }, (_, i) => `p${i}`));
  const g = new ArenaGame({ seed, tune, map, players });
  const r = new Rng(seed + 2);
  const nodeIds = map.nodes.map((n) => n.id);
  let t = 0;
  const snapshots: { game: ArenaGame; time: number }[] = [];
  const views: ReturnType<typeof toWire>[] = [];
  while (t < untilMs) {
    t += r.int(1000, 8000);
    g.advanceTo(t);
    for (let i = r.int(2, 6); i > 0; i--) {
      const p = r.pick(players);
      const squadId = r.pick(g.players.get(p.id)!.squadIds);
      const roll = r.next();
      const target = { kind: 'node', nodeId: r.pick(nodeIds) } as const;
      if (roll < 0.7) g.command({ type: 'march', playerId: p.id, squadId, target });
      else if (roll < 0.85) g.command({ type: 'teleport', playerId: p.id, nodeId: r.pick(nodeIds) });
      else g.command({ type: 'scout', playerId: p.id, scoutIndex: r.int(0, 2), target });
    }
    views.push(toWire(viewFor(g, 0)));
    snapshots.push({ game: g, time: t });
  }
  return { g, views };
}

test('wire: applying each patch to the previous view reproduces the next, all match long', () => {
  const { views } = playedGame(3, 600_000);
  assert.ok(views.length > 50);
  let client = views[0];
  let changes = 0;
  for (let i = 1; i < views.length; i++) {
    const patch = diffViews(views[i - 1], views[i]);
    client = applyPatch(client, patch);
    assert.ok(sameView(client, views[i]), `diverged at step ${i}`);
    changes += Object.values(patch.upsert).reduce((a, v) => a + (v?.length ?? 0), 0);
  }
  assert.ok(changes > 20, 'something actually changed');
});

test('wire: a patch with no changes is tiny (just time and points)', () => {
  const { views } = playedGame(4, 120_000);
  const v = views[views.length - 1];
  const patch = diffViews(v, { ...v, timeMs: v.timeMs + 1000 });
  assert.deepEqual(patch.upsert, {});
  assert.deepEqual(patch.remove, {});
  assert.ok(JSON.stringify(patch).length < 120);
});

test('wire: marching units carry no position so moving does not make patches', () => {
  const { views } = playedGame(5, 300_000);
  for (const v of views) {
    for (const s of v.squads) if (s.state === 'march') assert.equal(s.pos, undefined);
    for (const m of v.enemyMarches) assert.ok(!('pos' in m));
  }
  // A squad that keeps marching between two views is not re-sent.
  for (let i = 1; i < views.length; i++) {
    const a = views[i - 1].squads.filter((s) => s.state === 'march');
    const b = views[i].squads.filter((s) => s.state === 'march');
    const same = a.filter((x) => b.some((y) => JSON.stringify(x) === JSON.stringify(y)));
    if (same.length) {
      const patch = diffViews(views[i - 1], views[i]);
      const resent = (patch.upsert.squads ?? []).filter((s) => same.some((x) => x.id === s.id));
      assert.equal(resent.length, 0);
      return;
    }
  }
  assert.fail('never found a squad marching across two views');
});

test('wire: combat logs are capped on the wire', () => {
  const { views } = playedGame(6, 400_000);
  for (const v of views) assert.ok(v.combatLogs.length <= 50);
});
