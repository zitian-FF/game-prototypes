import assert from 'node:assert/strict';
import { Rng } from 'arena-sim';
import type { TeamView, Tune } from 'arena-sim';
import { BotBrain } from '../src/bot';
import { test } from './harness';

/** The smallest view the bot's stealing step reads. */
function view(): TeamView {
  const node = (id: string, owner: 0 | 1, x: number) => ({ id, kind: 'points', tier: 1, pos: { x, y: 100 }, owner, explored: true, visible: true });
  return {
    timeMs: 0,
    points: [0, 0],
    nodes: [node('own', 0, 300), node('foeNear', 1, 500), node('foeFar', 1, 1500)],
    squads: [],
    hqs: [{ id: 'h0', owner: 'bot', pos: { x: 100, y: 100 }, pool: 100, nextTeleportAtMs: 0, location: { kind: 'safe', index: 0 } }],
    scouts: [{ owner: 'bot', index: 0, state: 'home' }],
    enemyMarches: [],
    enemyHqs: [],
    scoutReports: [],
    caches: [
      { id: 'friendly', nodeId: 'own', pos: { x: 150, y: 100 }, value: 300 },
      { id: 'far', nodeId: 'foeFar', pos: { x: 1400, y: 100 }, value: 300 },
      { id: 'near', nodeId: 'foeNear', pos: { x: 450, y: 100 }, value: 300 },
    ],
    combatLogs: [],
  } as unknown as TeamView;
}

test('bots: with enemy caches in view they send a scout to the closest one and leave friendly caches alone', () => {
  let stole = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const brain = new BotBrain('bot', new Rng(seed));
    const input = { playerId: 'bot', team: 0 as const, view: view(), tune: { map: { cellSize: 40 }, garrison: { maxSquads: 20, maxPerCommander: 1 }, hq: { slotsPerNode: 8 }, nodes: { points: { visionRadiusCells: 6 } } } as unknown as Tune, speed: 1, nowMs: 0 };
    brain.think(input); // starts the timer
    const cmds = brain.think({ ...input, nowMs: 60_000 });
    for (const c of cmds) {
      if (c.type === 'scout' && c.target.kind === 'cache') {
        assert.notEqual(c.target.cacheId, 'friendly', 'never collects a cache of a node its own team holds');
        assert.equal(c.target.cacheId, 'near', 'goes for the closest enemy cache');
        stole++;
      }
    }
  }
  // Bots differ in appetite: some go for caches nearly every time, others rarely.
  assert.ok(stole >= 8 && stole <= 36, `bots differ, they do not all go for the cache (${stole} of 40)`);
  const perBot: number[] = [];
  for (let seed = 1; seed <= 12; seed++) {
    let n = 0;
    const brain = new BotBrain('bot', new Rng(seed));
    const input = { playerId: 'bot', team: 0 as const, view: view(), tune: { map: { cellSize: 40 }, garrison: { maxSquads: 20, maxPerCommander: 1 }, hq: { slotsPerNode: 8 }, nodes: { points: { visionRadiusCells: 6 } } } as unknown as Tune, speed: 1, nowMs: 0 };
    brain.think(input);
    for (let i = 1; i <= 60; i++) {
      for (const c of brain.think({ ...input, nowMs: i * 30_000 })) if (c.type === 'scout' && c.target.kind === 'cache') n++;
    }
    perBot.push(n);
  }
  assert.ok(Math.max(...perBot) - Math.min(...perBot) >= 8, `appetites differ between bots: ${perBot.join(',')}`);
});

test('bots: at most two scouts of a team head for the same cache', () => {
  const v = view();
  const near = v.caches.find((c) => c.id === 'near')!;
  (v as unknown as { scouts: unknown[] }).scouts = [
    { owner: 'bot', index: 0, state: 'home' },
    { owner: 'mate1', index: 0, state: 'out', to: near.pos },
    { owner: 'mate2', index: 0, state: 'out', to: near.pos },
  ];
  for (let seed = 1; seed <= 40; seed++) {
    const brain = new BotBrain('bot', new Rng(seed));
    const input = { playerId: 'bot', team: 0 as const, view: v, tune: { map: { cellSize: 40 }, garrison: { maxSquads: 20, maxPerCommander: 1 }, hq: { slotsPerNode: 8 }, nodes: { points: { visionRadiusCells: 6 } } } as unknown as Tune, speed: 1, nowMs: 0 };
    brain.think(input);
    for (const c of brain.think({ ...input, nowMs: 60_000 })) {
      if (c.type === 'scout' && c.target.kind === 'cache') assert.equal(c.target.cacheId, 'far', 'the crowded cache is skipped');
    }
  }
});
