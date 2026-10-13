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
  d: number; // distance from the player along the approach line (lane units)
  ang: number; // bearing from straight above the player, radians, fixed per zombie
  hp: number;
  speed: number; // walk speed, lane units per second, fixed at spawn (later zombies are faster)
  hurt: number; // frames left of the hit reaction
  state: EnemyState;
  frame: number;
  side: number; // which way it moves off after punching, -1 or 1
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
  | { kind: 'sweet'; zone: 'head' | 'body'; points: number; dmg: number; hp: number; killed: boolean; combo: number; enemy: number; d: number }
  | { kind: 'sour'; dmg: number; hp: number; killed: boolean; enemy: number; d: number }
  | { kind: 'punch'; type: PunchType }
  | { kind: 'whiff'; type: PunchType }
  | { kind: 'playerHit'; enemy: number }
  | { kind: 'spawn'; enemy: number; ang: number; index: number }
  | { kind: 'end'; reason: 'time' | 'dead' };

export interface SimState {
  frame: number;
  hp: number;
  score: number;
  ended: null | 'time' | 'dead';
  punch: PunchState | null;
  buffered: { type: PunchType; left: number } | null;
  enemies: Enemy[];
  spawned: number;
  nextId: number;
  hurtFrames: number;
  combo: number; // consecutive sweet hits; broken by a sour hit, a miss or taking a punch
  bestCombo: number;
  kills: number;
}

export const FPS = 60;

// Fixed spawn plan, the same every run so every player gets the same fight:
// zombieCount spawns from firstSpawnSec, with the gap between spawns shrinking
// steadily from startGapSec to endGapSec so the pace builds. They enter from
// `lanes` off-screen positions in a set shuffled order.
export function spawnFrame(tune: Tune, i: number): number {
  const n = tune.run.zombieCount;
  const { startGapSec: g0, endGapSec: g1 } = tune.run;
  // Sum of the first i gaps, gap j = g0 + (g1 - g0) * j / (n - 2).
  const slope = n > 2 ? (g1 - g0) / (n - 2) : 0;
  const t = tune.run.firstSpawnSec + i * g0 + (slope * i * (i - 1)) / 2;
  return Math.round(t * FPS);
}

// Walk speed for zombie i: rises steadily from walkSpeed to walkSpeedEnd.
export function spawnSpeed(tune: Tune, i: number): number {
  const n = tune.run.zombieCount;
  const u = n > 1 ? i / (n - 1) : 0;
  return tune.enemy.walkSpeed + (tune.enemy.walkSpeedEnd - tune.enemy.walkSpeed) * u;
}

export function spawnBearing(tune: Tune, i: number): number {
  const lanes = Math.max(1, Math.round(tune.enemy.lanes));
  if (lanes === 1) return 0;
  let stride = 2;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  while (stride < lanes && gcd(stride, lanes) !== 1) stride++;
  const lane = (i * (stride >= lanes ? 1 : stride)) % lanes;
  return (((lane / (lanes - 1)) * 2 - 1) * tune.enemy.maxBearingDeg * Math.PI) / 180;
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

export function createSim(tune: Tune) {
  const s: SimState = {
    frame: 0,
    hp: tune.run.playerHp,
    score: 0,
    ended: null,
    punch: null,
    buffered: null,
    enemies: [],
    spawned: 0,
    nextId: 1,
    hurtFrames: 0,
    combo: 0,
    bestCombo: 0,
    kills: 0,
  };

  let started: PunchType | null = null; // reported as a 'punch' event at the end of the step
  const startPunch = (type: PunchType) => {
    s.punch = { type, frame: 0, resolved: false, whiff: false };
    started = type;
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
          if (v === 'sour' || v === 'head' || v === 'body') {
            p.resolved = true;
            // Sweet hits do full damage and score, sour hits do reduced damage and no score.
            const sweet = v !== 'sour';
            const dmg = c.damage * (sweet ? 1 : tune.punch.sourDamageMult);
            t.hp -= dmg;
            t.hurt = tune.view.hitFlashFrames;
            const killed = t.hp <= 0;
            if (killed) s.kills++;
            if (sweet) s.bestCombo = Math.max(s.bestCombo, ++s.combo);
            else s.combo = 0;
            if (killed) {
              t.state = 'knocked';
              t.frame = 0;
            } else if (sweet) {
              // A sweet hit that does not defeat the zombie staggers it: pushed back, punch interrupted.
              t.d = Math.min(tune.enemy.spawnDistance, t.d + tune.enemy.staggerPush);
              t.state = 'walk';
              t.frame = 0;
            }
            if (sweet) {
              const points = tune.points[v];
              s.score += points;
              ev.push({ kind: 'sweet', zone: v, points, dmg, hp: Math.max(0, t.hp), killed, combo: s.combo, enemy: t.id, d: t.d });
            } else {
              ev.push({ kind: 'sour', dmg, hp: Math.max(0, t.hp), killed, enemy: t.id, d: t.d });
            }
          }
        }
      }
      if (!p.resolved && !p.whiff && phase === 'recovery') {
        p.whiff = true;
        s.combo = 0;
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

    // Spawning: a fixed number of zombies on a fixed schedule. They may overlap.
    while (s.spawned < tune.run.zombieCount && s.frame >= spawnFrame(tune, s.spawned)) {
      const ang = spawnBearing(tune, s.spawned);
      const e: Enemy = { id: s.nextId++, d: tune.enemy.spawnDistance, ang, hp: tune.enemy.hp, speed: spawnSpeed(tune, s.spawned), hurt: 0, state: 'walk', frame: 0, side: ang >= 0 ? 1 : -1 };
      s.enemies.push(e);
      s.spawned++;
      ev.push({ kind: 'spawn', enemy: e.id, ang, index: s.spawned - 1 });
    }

    // Enemies, nearest first so the queue holds its spacing.
    const order = [...s.enemies].sort((a, b) => a.d - b.d);
    let ahead: Enemy | null = null;
    for (const e of order) {
      e.frame++;
      if (e.hurt > 0) e.hurt--;
      if (e.state === 'walk') {
        let d = e.d - e.speed / FPS;
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
          s.combo = 0;
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

    if (started) {
      ev.push({ kind: 'punch', type: started });
      started = null;
    }

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
