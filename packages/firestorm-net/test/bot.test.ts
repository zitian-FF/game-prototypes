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
    hqs: [{ id: 'h0', owner: 'bot', pos: { x: 100, y: 100 }, pool: 100, nextTeleportAtMs: 0, location: { kind: 'node', nodeId: 'own', slot: 0 } }],
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

test('bots: with caches in view they send a scout to the closest one, whichever team it came from', () => {
  let stole = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const brain = new BotBrain('bot', new Rng(seed));
    const input = { playerId: 'bot', team: 0 as const, view: view(), tune: { map: { cellSize: 40 }, garrison: { maxSquads: 20, maxPerCommander: 1 }, hq: { slotsPerNode: 8 }, nodes: { points: { visionRadiusCells: 6 } } } as unknown as Tune, speed: 1, nowMs: 0 };
    brain.think(input); // starts the timer
    const cmds = brain.think({ ...input, nowMs: 60_000 });
    for (const c of cmds) {
      if (c.type === 'scout' && c.target.kind === 'cache') {
        assert.equal(c.target.cacheId, 'friendly', 'the closest cache, even one from its own team lost pool');
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

test('bots: a cache a closer friendly scout is already flying to is left alone, so the team does not swarm it', () => {
  const v = view();
  const closest = v.caches.find((c) => c.id === 'friendly')!;
  // A teammate scout, almost there (30 units away), already heading for the closest cache.
  (v as unknown as { scouts: unknown[] }).scouts = [
    { owner: 'bot', index: 0, state: 'home' },
    { owner: 'mate', index: 0, state: 'out', from: { x: 1000, y: 100 }, to: closest.pos, startMs: 0, arriveMs: 100_000 },
  ];
  const picks = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) {
    const brain = new BotBrain('bot', new Rng(seed));
    const input = { playerId: 'bot', team: 0 as const, view: v, tune: { map: { cellSize: 40 }, garrison: { maxSquads: 20, maxPerCommander: 1 }, hq: { slotsPerNode: 8 }, nodes: { points: { visionRadiusCells: 6 } } } as unknown as Tune, speed: 1, nowMs: 0 };
    brain.think(input);
    for (const c of brain.think({ ...input, nowMs: 99_000 })) if (c.type === 'scout' && c.target.kind === 'cache') picks.add(c.target.cacheId);
  }
  assert.ok(picks.size > 0, 'bots still go for the other caches');
  assert.ok(!picks.has('friendly'), 'but not the one a nearer friendly scout will reach first');
  // Within one decision round, the team shares claims: the first bot's claim keeps the second away.
  const claims = new Map<string, number>();
  const fresh = view();
  const results: string[] = [];
  for (let seed = 1; seed <= 6; seed++) {
    const brain = new BotBrain('bot', new Rng(seed));
    const input = { playerId: 'bot', team: 0 as const, view: fresh, tune: { map: { cellSize: 40 }, garrison: { maxSquads: 20, maxPerCommander: 1 }, hq: { slotsPerNode: 8 }, nodes: { points: { visionRadiusCells: 6 } } } as unknown as Tune, speed: 1, nowMs: 0, claims };
    brain.think(input);
    for (const c of brain.think({ ...input, nowMs: 60_000 })) if (c.type === 'scout' && c.target.kind === 'cache') results.push(c.target.cacheId);
  }
  assert.equal(results.filter((id) => id === 'friendly').length, 1, 'only one bot of the round takes the closest cache');
});

// ------------------------------------------------------------ HQ fights and teleporting

const TUNE = { map: { cellSize: 40 }, garrison: { maxSquads: 20, maxPerCommander: 1 }, hq: { slotsPerNode: 8 }, nodes: { points: { visionRadiusCells: 6 }, portal: { visionRadiusCells: 1.5 } } } as unknown as Tune;

function base(over: Record<string, unknown> = {}): TeamView {
  return {
    timeMs: 0,
    points: [0, 0],
    nodes: [{ id: 'own', kind: 'points', tier: 1, pos: { x: 600, y: 100 }, owner: 0, explored: true, visible: true, garrisonCount: 1 }],
    squads: [{ id: 's1', owner: 'bot', type: 'tank', rank: 5, power: 70, troops: 3000, maxTroops: 3000, defend: true, state: 'hq' }],
    hqs: [{ id: 'h0', owner: 'bot', pos: { x: 100, y: 100 }, pool: 100, nextTeleportAtMs: 0, location: { kind: 'node', nodeId: 'own', slot: 0 }, garrisonCount: 0 }],
    scouts: [],
    enemyScouts: [],
    enemyMarches: [],
    enemyHqs: [],
    scoutReports: [],
    caches: [],
    combatLogs: [],
    ...over,
  } as unknown as TeamView;
}

/** Everything a bot does over many decisions, for the commands that match. */
function decisions(v: TeamView, seeds: number, speed = 120): ReturnType<BotBrain['think']>[number][] {
  const out: ReturnType<BotBrain['think']>[number][] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const brain = new BotBrain('bot', new Rng(seed));
    const input = { playerId: 'bot', team: 0 as const, view: v, tune: TUNE, speed, nowMs: 100_000 };
    brain.think(input);
    out.push(...brain.think({ ...input, nowMs: 160_000 }));
  }
  return out;
}

test('bots: an ally HQ under attack that they can reach in time gets a garrison squad', () => {
  const allyHq = { id: 'ally', owner: 'mate', pos: { x: 600, y: 140 }, hp: 4, maxHp: 4, pool: 0, poolMax: 0, burning: false, location: { kind: 'node', nodeId: 'own', slot: 0 }, nextTeleportAtMs: 0, garrisonCount: 0 };
  // An enemy march 90% of the way to the ally HQ (inside our vision), landing in about 6 seconds.
  const march = { id: 'e1', type: 'tank', owner: 'foe', burning: false, march: { from: { x: 600, y: 1100 }, to: { x: 600, y: 140 }, startMs: 160_000 - 54_000, arriveMs: 160_000 + 6_000, speed: 1 } };
  const v = base({ hqs: [...base().hqs, allyHq], enemyMarches: [march] });
  const sent = decisions(v, 40).filter((c) => c.type === 'march' && c.target.kind === 'hq' && c.target.hqId === 'ally');
  assert.ok(sent.length >= 15, `loyal bots rush to help (${sent.length} of 40)`);
  assert.ok(sent.length < 40, 'not every bot does');
  // Too far to arrive before the fight: nobody goes.
  assert.equal(decisions(v, 40, 1).filter((c) => c.type === 'march' && c.target.kind === 'hq' && c.target.hqId === 'ally').length, 0);
  // Already helping: no second squad from the same commander.
  const helping = base({ hqs: [...base().hqs, allyHq], enemyMarches: [march], squads: [...(base().squads as unknown as object[]), { id: 's2', owner: 'bot', state: 'march', troops: 3000, maxTroops: 3000, power: 60, march: { purpose: 'hq', hqId: 'ally' } }] });
  assert.equal(decisions(helping, 40).filter((c) => c.type === 'march' && c.squadId === 's1' && c.target.kind === 'hq' && c.target.hqId === 'ally').length, 0);
});

test('bots: they assault an enemy HQ only when confident', () => {
  const enemy = { id: 'eh', owner: 'foe', pos: { x: 500, y: 300 }, burning: false };
  const toHq = (v: TeamView) => decisions(v, 40).filter((c) => c.type === 'march' && c.target.kind === 'hq' && c.target.hqId === 'eh').length;
  // A strong squad and no report: confident enough, though bots differ in appetite.
  const strong = toHq(base({ enemyHqs: [enemy] }));
  assert.ok(strong >= 10 && strong < 40, `strong squad goes in (${strong} of 40)`);
  // A weak squad does not, unless the HQ is damaged and the squad is not too weak.
  const weakSquads = [{ id: 's1', owner: 'bot', type: 'tank', rank: 5, power: 55, troops: 3000, maxTroops: 3000, defend: true, state: 'hq' }];
  assert.equal(toHq(base({ enemyHqs: [enemy], squads: weakSquads })), 0, 'weak and unscouted: stays away');
  // A live scout report decides: weak defenders invite an attack even from a modest squad, a strong one does not.
  const report = (power: number) => [{ id: 1, team: 0, target: { kind: 'hq', hqId: 'eh' }, empty: false, takenAtMs: 150_000, expiresAtMs: 210_000, defenders: [{ squadId: 'x', type: 'tank', effectivePower: power, commander: 'foe' }] }];
  assert.ok(toHq(base({ enemyHqs: [enemy], squads: weakSquads, scoutReports: report(45) })) >= 5, 'a scouted weak defender is worth a go');
  assert.equal(toHq(base({ enemyHqs: [enemy], scoutReports: report(78) })), 0, 'a scouted stronger defender is not');
});

test('bots: still in the safe zone with a node of their own, they move the HQ out', () => {
  const safe = base({ hqs: [{ ...(base().hqs[0] as object), location: { kind: 'safe', index: 0 } }] });
  const tele = decisions(safe, 40).filter((c) => c.type === 'teleport');
  assert.ok(tele.length >= 25, `most bots teleport onto their node (${tele.length} of 40)`);
  assert.equal(decisions(base(), 40).filter((c) => c.type === 'teleport').length, 0, 'an HQ already on a node stays unless threatened');
});

test('bots: scouts only go to enemy-held nodes, never neutral, friendly or portal ones', () => {
  const node = (id: string, kind: string, owner: 0 | 1 | null, x: number, y: number) => ({ id, kind, tier: 1, pos: { x, y }, owner, explored: true, visible: owner === 0 });
  const v = base({
    nodes: [node('own', 'points', 0, 600, 100), node('neu', 'points', null, 900, 100), node('foe', 'points', 1, 1200, 100), node('p', 'portal', null, 800, 400)],
    scouts: [{ owner: 'bot', index: 0, state: 'home' }],
  });
  const targets = new Set<string>();
  for (let seed = 1; seed <= 300; seed++) {
    const brain = new BotBrain('bot', new Rng(seed));
    const input = { playerId: 'bot', team: 0 as const, view: v, tune: TUNE, speed: 120, nowMs: 0 };
    brain.think(input);
    for (let i = 1; i <= 8; i++) for (const c of brain.think({ ...input, nowMs: i * 30_000 })) if (c.type === 'scout' && c.target.kind === 'node') targets.add(c.target.nodeId);
  }
  assert.deepEqual([...targets], ['foe']);
});

test('bots: they creep the front forward from nodes they hold, and about one decision in ten raids a distant node', () => {
  const node = (id: string, kind: string, owner: 0 | 1 | null, x: number, y: number) => ({ id, kind, tier: 1, pos: { x, y }, owner, explored: true, visible: owner === 0 });
  const v = base({
    nodes: [node('own', 'points', 0, 600, 100), node('near', 'points', null, 760, 100), node('far', 'points', null, 2000, 1400), node('p', 'portal', null, 800, 400)],
    // This commander already holds its own node, so reinforcing it is off the table.
    squads: [...(base().squads as unknown as object[]), { id: 's2', owner: 'bot', type: 'tank', rank: 5, power: 60, troops: 3000, maxTroops: 3000, defend: true, state: 'garrison', nodeId: 'own' }],
  });
  const picked: Record<string, number> = {};
  let total = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const brain = new BotBrain('bot', new Rng(seed));
    const input = { playerId: 'bot', team: 0 as const, view: v, tune: TUNE, speed: 120, nowMs: 0 };
    brain.think(input);
    for (const c of brain.think({ ...input, nowMs: 60_000 })) {
      if (c.type === 'march' && c.target.kind === 'node') {
        picked[c.target.nodeId] = (picked[c.target.nodeId] ?? 0) + 1;
        total++;
      }
    }
  }
  assert.equal(picked['p'], undefined, 'a portal cannot be captured');
  assert.ok((picked['near'] ?? 0) > total * 0.5, `the front creeps toward the node beside ours (${JSON.stringify(picked)})`);
  const raids = (picked['far'] ?? 0) / total;
  assert.ok(raids > 0.03 && raids < 0.3, `roughly one in ten reaches for the distant node (${(raids * 100).toFixed(0)}%)`);
});
