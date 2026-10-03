import { tune } from './tune';
import { punchCfg } from './character';
import { phaseOf } from './sim';
import { NEUTRAL_INPUT, type FrameInput, type SimState } from './types';

// Easy single-player opponent. It only produces FrameInputs, exactly like a
// player's controls, so it plays by every rule of the sim. It "sees" the
// fight `ai.reactionFrames` late (a delay queue of what the player was
// doing), which is what keeps it beatable. Local-only; never used online.

interface Seen {
  playerStartingPunch: boolean;
  dist: number;
}

export class EasyAI {
  private seen: Seen[] = [];
  private cooldown = 0;
  private guardHold = 0;
  private foeWasPunching = false;
  private rng: () => number;

  constructor(
    private idx: 0 | 1,
    seed = Date.now(),
  ) {
    let a = seed >>> 0;
    // mulberry32: small, good-enough RNG so AI behaviour isn't tied to Math.random.
    this.rng = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  think(s: SimState): FrameInput {
    const me = s.fighters[this.idx];
    const foe = s.fighters[this.idx === 0 ? 1 : 0];
    const dx = foe.x - me.x;
    const dy = foe.y - me.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // What the player is doing now, observed `reactionFrames` later.
    const startingPunch = foe.punch !== null && phaseOf(foe.punch) === 'startup' && !this.foeWasPunching;
    this.foeWasPunching = foe.punch !== null;
    this.seen.push({ playerStartingPunch: startingPunch, dist });
    const delay = Math.max(0, Math.round(tune.ai.reactionFrames));
    while (this.seen.length > delay + 1) this.seen.shift();
    const view = this.seen.length > delay ? this.seen[0] : null;

    const input: FrameInput = { ...NEUTRAL_INPUT };
    if (this.cooldown > 0) this.cooldown--;
    const busy = me.punch !== null || me.dodge !== null;

    // Defense: react (late) to a punch the player started.
    if (view?.playerStartingPunch && !busy && view.dist < tune.ai.attackRange + 20) {
      if (this.rng() < tune.ai.dodgeChance) {
        input.dodge = true;
        return input;
      }
      if (this.rng() < tune.ai.guardChance) this.guardHold = Math.round(tune.ai.guardHoldFrames);
    }
    if (this.guardHold > 0) {
      this.guardHold--;
      input.guard = true;
      return input;
    }

    // Movement: close the distance, or back off when tired.
    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : 0;
    const tired = me.stamina < tune.ai.retreatStaminaBelow || me.exhausted;
    const ideal = tune.ai.attackRange - 8;
    let mx = 0;
    let my = 0;
    if (tired) {
      mx = -nx;
      my = -ny;
    } else if (dist > ideal + 6) {
      mx = nx;
      my = ny;
    } else if (dist < ideal - 14) {
      mx = -nx * 0.6;
      my = -ny * 0.6;
    }
    // A little sideways drift so it doesn't walk in a dead straight line.
    const drift = Math.sin(s.tick / 45) * 0.35;
    mx += -ny * drift;
    my += nx * drift;
    input.mx = Math.round(Math.max(-1, Math.min(1, mx)) * 100);
    input.my = Math.round(Math.max(-1, Math.min(1, my)) * 100);

    // Offense.
    if (!tired && !busy && this.cooldown === 0 && dist <= tune.ai.attackRange && this.rng() < tune.ai.attackChance) {
      this.cooldown = Math.round(tune.ai.attackCooldownFrames);
      if (me.stars >= tune.stars.max) {
        input.uppercut = true;
      } else {
        const close = dist < punchCfg(me, 'hook').reach + tune.body.hurtRadius;
        const wj = tune.ai.jabWeight;
        const wc = tune.ai.crossWeight;
        const wh = close ? tune.ai.hookWeight * 2 : tune.ai.hookWeight;
        const r = this.rng() * (wj + wc + wh);
        if (r < wj) input.jab = true;
        else if (r < wj + wc) input.cross = true;
        else input.hook = true;
      }
    }
    return input;
  }
}
