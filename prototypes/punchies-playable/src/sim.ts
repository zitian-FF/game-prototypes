import type { Tune } from './tune';

// Lane rules for the playable. Pure and deterministic (no Phaser, no DOM),
// 60 Hz fixed steps. Distances are lane units: centre to centre between the
// player and an enemy, the same units as the main game's reach bands.
// Own rule set, not shared with prototypes/punchies/src/sim.

export type PunchType = 'jab' | 'cross';
export type Verdict = 'head' | 'body' | 'sour';
export type EnemyState = 'walk' | 'windup' | 'strike' | 'leave' | 'knocked';
export type PunchPhase = 'startup' | 'early' | 'sweet' | 'recovery';

export interface Enemy {
  id: number;
  d: number;
  state: EnemyState;
  frame: number;
  side: number;
}

export interface PunchState {
  type: PunchType;
  frame: number;
  resolved: boolean;
  whiff: boolean;
}

export interface Input {
  jab: boolean;
  cross: boolean;
}

export type SimEvent =
  | { kind: 'sweet'; zone: 'head' | 'body'; points: number; enemy: number; d: number }
  | { kind: 'sour'; enemy: number; d: number }
  | { kind: 'whiff'; type: PunchType }
  | { kind: 'playerHit'; enemy: number }
  | { kind: 'spawn'; enemy: number }
  | { kind: 'end'; reason: 'time' | 'dead' };

export interface SimState {
  frame: number;
  hp: number;
  score: number;
  ended: null | 'time' | 'dead';
  punch: PunchState | null;
  buffered: { type: PunchType; left: number } | null;
  enemies: Enemy[];
  spawnIn: number;
  nextId: number;
  hurtFrames: number;
}

export const FPS = 60;

// mulberry32: tiny seeded generator so runs are reproducible in tests.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function punchPhase(tune: Tune, p: PunchState): PunchPhase {
  const c = tune.punch[p.type];
  if (p.frame < c.startup) return 'startup';
  if (p.frame < c.startup + c.sourEarly) return 'early';
  if (p.frame < c.startup + c.sourEarly + c.sweet) return 'sweet';
  return 'recovery';
}

export function punchTotal(tune: Tune, p: PunchState): number {
  const c = tune.punch[p.type];
  return c.startup + c.sourEarly + c.sweet + c.recovery + (p.whiff ? c.whiffRecovery : 0);
}

// The enemy a punch is aimed at: the closest one still in the fight.
export function frontEnemy(s: SimState): Enemy | null {
  let best: Enemy | null = null;
  for (const e of s.enemies) {
    if (e.state !== 'walk' && e.state !== 'windup' && e.state !== 'strike') continue;
    if (!best || e.d < best.d) best = e;
  }
  return best;
}

// Where a contact at distance d lands for this punch.
export function classify(tune: Tune, type: PunchType, d: number): Verdict | 'out' {
  const c = tune.punch[type];
  if (d > c.bodyMax) return 'out';
  if (d < c.sourBelow) return 'sour';
  return d <= c.headMax ? 'head' : 'body';
}

export function createSim(tune: Tune, seed = 1) {
  const rng = makeRng(seed);
  const s: SimState = {
    frame: 0,
    hp: tune.run.playerHp,
    score: 0,
    ended: null,
    punch: null,
    buffered: null,
    enemies: [],
    spawnIn: Math.round(tune.run.firstSpawnSec * FPS),
    nextId: 1,
    hurtFrames: 0,
  };

  const startPunch = (type: PunchType) => {
    s.punch = { type, frame: 0, resolved: false, whiff: false };
  };

  function step(input: Input): SimEvent[] {
    const ev: SimEvent[] = [];
    if (s.ended) return ev;
    s.frame++;
    if (s.hurtFrames > 0) s.hurtFrames--;

    // Intents: jab and cross. A press during a punch is remembered briefly.
    const pressed: PunchType | null = input.cross ? 'cross' : input.jab ? 'jab' : null;
    if (pressed) {
      if (!s.punch) startPunch(pressed);
      else s.buffered = { type: pressed, left: tune.punch.bufferFrames };
    }
    if (s.buffered && !pressed && --s.buffered.left < 0) s.buffered = null;

    // Player punch.
    if (s.punch) {
      const p = s.punch;
      const phase = punchPhase(tune, p);
      const c = tune.punch[p.type];
      if (!p.resolved && (phase === 'early' || phase === 'sweet')) {
        const t = frontEnemy(s);
        if (t) {
          const v = phase === 'early' ? (t.d < c.sourBelow ? 'sour' : 'out') : classify(tune, p.type, t.d);
          if (v === 'sour') {
            p.resolved = true;
            ev.push({ kind: 'sour', enemy: t.id, d: t.d });
          } else if (v === 'head' || v === 'body') {
            p.resolved = true;
            const points = tune.points[v];
            s.score += points;
            t.state = 'knocked';
            t.frame = 0;
            ev.push({ kind: 'sweet', zone: v, points, enemy: t.id, d: t.d });
          }
        }
      }
      if (!p.resolved && !p.whiff && phase === 'recovery') {
        p.whiff = true;
        ev.push({ kind: 'whiff', type: p.type });
      }
      p.frame++;
      if (p.frame >= punchTotal(tune, p)) {
        s.punch = null;
        if (s.buffered) {
          startPunch(s.buffered.type);
          s.buffered = null;
        }
      }
    }

    // Spawning, on a timer. Enemies may overlap on screen.
    if (--s.spawnIn <= 0) {
      const e: Enemy = { id: s.nextId++, d: tune.enemy.spawnDistance, state: 'walk', frame: 0, side: rng() < 0.5 ? -1 : 1 };
      s.enemies.push(e);
      ev.push({ kind: 'spawn', enemy: e.id });
      const gap = tune.run.spawnMinSec + rng() * Math.max(0, tune.run.spawnMaxSec - tune.run.spawnMinSec);
      s.spawnIn = Math.max(1, Math.round(gap * FPS));
    }

    // Enemies, nearest first so the queue holds its spacing.
    const order = [...s.enemies].sort((a, b) => a.d - b.d);
    let ahead: Enemy | null = null;
    for (const e of order) {
      e.frame++;
      if (e.state === 'walk') {
        let d = e.d - tune.enemy.walkSpeed / FPS;
        if (ahead) d = Math.max(d, ahead.d + tune.enemy.minGap);
        if (d <= tune.enemy.attackDistance) {
          d = tune.enemy.attackDistance;
          e.state = 'windup';
          e.frame = 0;
        }
        e.d = d;
      } else if (e.state === 'windup') {
        if (e.frame >= tune.enemy.windupFrames) {
          e.state = 'strike';
          e.frame = 0;
        }
      } else if (e.state === 'strike') {
        if (e.frame >= tune.enemy.strikeFrames) {
          s.hp = Math.max(0, s.hp - tune.enemy.damage);
          s.hurtFrames = tune.view.hitFlashFrames;
          ev.push({ kind: 'playerHit', enemy: e.id });
          e.state = 'leave';
          e.frame = 0;
        }
      }
      if (e.state === 'walk' || e.state === 'windup' || e.state === 'strike') ahead = e;
    }
    s.enemies = s.enemies.filter(
      (e) => !((e.state === 'leave' && e.frame >= tune.enemy.leaveFrames) || (e.state === 'knocked' && e.frame >= tune.enemy.knockFrames)),
    );

    if (s.hp <= 0) {
      s.ended = 'dead';
      ev.push({ kind: 'end', reason: 'dead' });
    } else if (s.frame >= tune.run.durationSec * FPS) {
      s.ended = 'time';
      ev.push({ kind: 'end', reason: 'time' });
    }
    return ev;
  }

  return { state: s, step };
}

export type Sim = ReturnType<typeof createSim>;
