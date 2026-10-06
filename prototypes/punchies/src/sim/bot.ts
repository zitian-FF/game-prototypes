import { tune } from './tune';
import { punchCfg } from './character';
import { fatigueLevel, phaseOf } from './sim';
import { EasyAI } from './ai';
import { NEUTRAL_INPUT, type FrameInput, type PunchType, type SimState } from './types';

// Scripted opponents. Like EasyAI they only emit FrameInputs, so they play
// by every rule of the sim, and they only "see" the foe `reactionFrames`
// late (a delay queue of foe snapshots). Local-only, never used online.
//
//   easy   = EasyAI (unchanged).
//   medium = spacing by each punch's real range, punishes whiffs / recovery,
//            uses the uppercut, guards or dodges some punches.
//   hard   = medium plus frame-aware defence (timed Perfect Guards, dodging
//            the uppercut), jab-interrupts into the foe's startup, and ring
//            awareness. Reacts faster.
// Per-level numbers live in tune.ai.medium / tune.ai.hard.

// Centre distance at which a punch's fist just touches the foe's hurt circle.
function connect(c: { reach: number; hitRadius: number }): number {
  return c.reach + c.hitRadius + tune.body.hurtRadius;
}

export type BotLevel = 'easy' | 'medium' | 'hard';
export const BOT_LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

export interface Bot {
  think(s: SimState): FrameInput;
}

export function makeBot(level: BotLevel, idx: 0 | 1, seed?: number): Bot {
  return level === 'easy' ? new EasyAI(idx, seed) : new ScriptedBot(level, idx, seed);
}

interface FoeView {
  x: number;
  y: number;
  punch: { type: PunchType; frame: number; startup: number; sourEarly: number; reach: number; recovering: boolean; active: boolean } | null;
  open: boolean; // exposed: recovering, exhausted, stunned or after a dodge
  stars: number;
  guarding: boolean;
  stamina: number; // the foe's meter, as a player would read it off the HUD
}

const ATTACKS: PunchType[] = ['jab', 'cross', 'hook'];

export class ScriptedBot implements Bot {
  private hist: FoeView[] = [];
  private cooldown = 0;
  private guardHold = 0;
  // Perfect Guard plan for the punch currently incoming (rolled once).
  private pgKey = '';
  private pgPlan: 'none' | 'perfect' | 'early' = 'none';
  private holdOffUntil = 0;
  // Recovery mode: low on stamina, so go somewhere safe and stand still.
  private recovering = false;
  private rng: () => number;

  constructor(
    private level: Exclude<BotLevel, 'easy'>,
    private idx: 0 | 1,
    seed = Date.now(),
  ) {
    let a = seed >>> 0;
    this.rng = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private get L() {
    return tune.ai[this.level];
  }

  think(s: SimState): FrameInput {
    const L = this.L;
    const me = s.fighters[this.idx];
    const foe = s.fighters[this.idx === 0 ? 1 : 0];
    const input: FrameInput = { ...NEUTRAL_INPUT };
    if (this.cooldown > 0) this.cooldown--;

    // --- perception: the foe as it was `reactionFrames` ago -------------
    const fp = foe.punch;
    const phase = fp ? phaseOf(fp) : null;
    this.hist.push({
      x: foe.x,
      y: foe.y,
      punch: fp
        ? { type: fp.type, frame: fp.frame, startup: fp.startup, sourEarly: fp.sourEarly, reach: fp.reach, recovering: phase === 'recovery', active: phase === 'sweet' || phase === 'sour' }
        : null,
      open: phase === 'recovery' || foe.exhausted || foe.stunTimer > 0 || foe.postDodgeVulnerable > 0 || foe.guardPenalty > 0,
      stars: foe.stars,
      guarding: foe.guarding,
      stamina: foe.exhausted ? 0 : foe.stamina,
    });
    const delay = Math.max(0, Math.round(L.reactionFrames));
    while (this.hist.length > delay + 1) this.hist.shift();
    const view = this.hist.length > delay ? this.hist[0] : null;
    if (!view) return input;

    // Distance now (own position is always current; the foe's is the seen one).
    const vdx = view.x - me.x;
    const vdy = view.y - me.y;
    const dist = Math.sqrt(vdx * vdx + vdy * vdy);
    const nx = dist > 0.001 ? vdx / dist : 1;
    const ny = dist > 0.001 ? vdy / dist : 0;
    const busy = me.punch !== null || me.dodge !== null;
    // Low on stamina (or exhausted): recover until well topped up again, so the
    // bot does not flip in and out of the fight at the edge of the threshold.
    if (!this.recovering && (me.exhausted || me.stamina < L.retreatStaminaBelow)) this.recovering = true;
    else if (this.recovering && !me.exhausted && me.stamina >= L.recoverUntil) this.recovering = false;
    const tired = this.recovering;
    // Watch the tank: below conserveBelow the bot throws less, and cheaper.
    const reserve = L.retreatStaminaBelow;
    const careful = me.stamina < L.conserveBelow;
    // Pressure: the foe is running on empty, so close in and make them pay for it.
    const pressing = !tired && L.pressureFoeBelow > 0 && view.stamina < L.pressureFoeBelow && me.stamina > reserve;
    const conserve = careful ? Math.max(0.2, (me.stamina - reserve) / Math.max(1, L.conserveBelow - reserve)) : 1;

    // A dodge costs real stamina; a bot that cannot pay it must block instead.
    const canDodge = me.stamina >= tune.dodge.staminaCost + 2;

    // --- defence --------------------------------------------------------
    const vp = view.punch;
    if (!busy && vp && !vp.recovering && !vp.active) {
      // Frames until that punch connects, corrected for how stale the view is.
      const remaining = vp.startup + vp.sourEarly - vp.frame - delay;
      const foeMax = connect({ reach: vp.reach, hitRadius: tune.punches[vp.type].hitRadius }) - 4;
      if (dist < foeMax + 14) {
        if (vp.type === 'uppercut') {
          // Cannot be blocked: dodge it (a Perfect Guard also stops it).
          if (canDodge && remaining <= 7 && remaining >= 1 && this.rng() < L.uppercutDodgeChance) {
            input.dodge = true;
            return input;
          }
        } else if (this.tryPerfectGuard(s, vp, remaining, delay, me.guardPenalty)) {
          // Guard raised for a Perfect Guard (or an early, mistimed one).
          this.holdOffUntil = s.tick + this.guardHold + Math.round(L.pgHesitateFrames);
        } else if (this.guardHold === 0 && remaining >= 0) {
          const r = this.rng();
          if (canDodge && r < L.dodgeChance) {
            input.dodge = true;
            return input;
          }
          if (r < L.dodgeChance + L.guardChance) this.guardHold = Math.round(L.guardHoldFrames);
        }
        // Interrupt a slow wind-up with a jab (a jab on startup always hits).
        const jab = punchCfg(me, 'jab');
        if (
          this.guardHold === 0 &&
          vp.type !== 'jab' &&
          remaining > jab.startup + 1 &&
          dist <= connect(jab) + 3 &&
          !tired &&
          this.rng() < L.counterChance
        ) {
          input.jab = true;
          return input;
        }
      }
    }
    if (this.guardHold > 0 && !busy) {
      // Dropping guard costs a long vulnerable penalty, so keep it up while
      // the punch it was raised for is still in the air.
      const incoming = vp !== null && !vp.recovering && dist < connect({ reach: vp.reach, hitRadius: tune.punches[vp.type].hitRadius }) + 8;
      if (!(incoming && this.guardHold <= 2)) this.guardHold--;
      input.guard = true;
      return input;
    }

    // --- offence --------------------------------------------------------
    if (!busy && !tired && s.tick >= this.holdOffUntil) {
      const open = view.open && !view.guarding;
      const want = open ? this.rng() < L.punishChance : this.cooldown === 0 && this.rng() < L.attackChance * (pressing ? L.pressureBoost : conserve);
      if (want) {
        const pick = this.pickPunch(me, dist, open);
        // Never spend into the reserve on a plain attack; a punish may dip
        // into it, but not to nothing.
        const left = pick ? me.stamina - punchCfg(me, pick).staminaCost : 0;
        if (pick && left >= (open ? reserve * 0.4 : reserve)) {
          input[pick] = true;
          this.cooldown = Math.round(L.attackCooldownFrames);
        }
      }
    }

    // --- movement: hold the sweet distance, strafe, stay out of corners ---
    const ideal = this.idealDistance(me);
    let mx = 0;
    let my = 0;
    if (tired) {
      // Find a safe spot (out of the foe's reach, off the ropes and out of
      // the corners) and stand perfectly still: that is the fastest regen.
      const rec = this.recoverMove(me, view, dist);
      if (rec.stay) return input;
      input.mx = Math.round(rec.mx * 100);
      input.my = Math.round(rec.my * 100);
      // Cornered with the foe close: block instead of walking into a lock.
      if (rec.cornered && dist < L.safeDistance - 25 && !busy) input.guard = true;
      return input;
    } else if ((view.open || pressing) && dist > ideal && (!careful || pressing)) {
      mx = nx;
      my = ny;
    } else if (dist > ideal + 8) {
      mx = nx;
      my = ny;
    } else if (dist < ideal - 12) {
      mx = -nx * 0.8;
      my = -ny * 0.8;
    }
    const strafe = Math.sin(s.tick / L.strafePeriod) * L.strafe;
    mx += -ny * strafe;
    my += nx * strafe;
    // Ring awareness: near an edge, bend toward the centre.
    const r = tune.ring;
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    const edge = 46;
    if (me.x < r.left + edge || me.x > r.right - edge || me.y < r.top + edge || me.y > r.bottom - edge) {
      mx += ((cx - me.x) / 150) * L.cornerAvoid;
      my += ((cy - me.y) / 150) * L.cornerAvoid;
    }
    const mag = Math.sqrt(mx * mx + my * my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    input.mx = Math.round(mx * 100);
    input.my = Math.round(my * 100);
    return input;
  }

  // Decide once per incoming punch whether to try a Perfect Guard, and
  // whether the attempt is mistimed (raised too early, so it is only a
  // normal block). Returns true when the guard goes up this frame.
  private tryPerfectGuard(s: SimState, vp: NonNullable<FoeView['punch']>, remaining: number, delay: number, guardPenalty: number): boolean {
    const L = this.L;
    const key = `${vp.type}@${s.tick - delay - vp.frame}`;
    if (key !== this.pgKey) {
      this.pgKey = key;
      this.pgPlan = 'none';
      if (guardPenalty <= 0 && this.rng() < L.pgChance) {
        this.pgPlan = this.rng() < L.pgMistime ? 'early' : 'perfect';
      }
    }
    if (this.pgPlan === 'none') return false;
    const perfectAt = Math.max(1, tune.guard.perfectFrames - 2); // frames before contact
    const raiseAt = this.pgPlan === 'perfect' ? perfectAt : perfectAt + 5;
    if (remaining >= 1 && remaining <= raiseAt) {
      this.pgPlan = 'none';
      this.guardHold = Math.round(tune.guard.perfectFrames) + 6;
      return true;
    }
    return false;
  }

  // Recovery movement. Stays put when already safe (far enough from the foe
  // and clear of the ropes). Otherwise picks the best of 16 directions:
  // away from the foe, but never into a wall or corner, bending toward open
  // ring so it circles instead of backing into a stun lock.
  private recoverMove(me: SimState['fighters'][number], foe: { x: number; y: number }, dist: number): { mx: number; my: number; stay: boolean; cornered: boolean } {
    const L = this.L;
    const r = tune.ring;
    const margin = L.edgeMargin;
    const wallPen = (x: number, y: number): number => {
      const d = [x - r.left, r.right - x, y - r.top, r.bottom - y];
      let pen = 0;
      for (const e of d) pen += e < margin ? (margin - e) * (e < 0 ? 3 : 1) : 0;
      return pen;
    };
    const safeHere = dist >= L.safeDistance && wallPen(me.x, me.y) <= margin * 0.4;
    if (safeHere) return { mx: 0, my: 0, stay: true, cornered: false };
    const cap = L.safeDistance + 20;
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    let best = -Infinity;
    let bx = 0;
    let by = 0;
    let bd = dist;
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const px = me.x + dx * 40;
      const py = me.y + dy * 40;
      const d = Math.hypot(px - foe.x, py - foe.y);
      const score = Math.min(d, cap) - 1.5 * wallPen(px, py) - 0.05 * Math.hypot(px - cx, py - cy);
      if (score > best) {
        best = score;
        bx = dx;
        by = dy;
        bd = d;
      }
    }
    return { mx: bx, my: by, stay: false, cornered: bd < dist + 2 };
  }

  // Distance that lands the jab sweet-ish while staying near the edge of
  // the foe's reach.
  private idealDistance(me: SimState['fighters'][number]): number {
    return connect(punchCfg(me, 'jab')) - 8;
  }

  // The best punch for this range, lowest fatigue first. Uppercut when
  // charged. `open` = the foe is exposed: prefer the heaviest hit.
  private pickPunch(me: SimState['fighters'][number], dist: number, open: boolean): PunchType | null {
    if (me.stars >= tune.stars.max) {
      const up = punchCfg(me, 'uppercut');
      if (dist <= connect(up)) return 'uppercut';
    }
    let best: PunchType | null = null;
    let bestScore = 0;
    for (const t of ATTACKS) {
      const c = punchCfg(me, t);
      const hi = connect(c) + (t === 'hook' ? 0 : 5);
      const lo = connect(c) - (t === 'hook' ? 24 : 14);
      if (dist > hi || dist < lo - 14) continue;
      const inSweet = dist >= lo;
      const tired = Math.pow(0.45, fatigueLevel(me, t));
      let score = (inSweet ? 1 : 0.35) * tired * (open ? c.damage : 1 + c.damage * 0.1);
      // Low on stamina: favour the cheap punches.
      if (me.stamina < this.L.conserveBelow) score /= 1 + c.staminaCost / 6;
      if (t === 'jab' && !open) score *= 1.2; // cheap and safe
      score *= 0.8 + this.rng() * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }
}
