import type { Rng } from './rng';
import { COUNTERS } from './types';
import type { SquadType, Tune } from './types';

export interface Combatant {
  type: SquadType;
  power: number;
  troops: number;
  maxTroops: number;
  /** Team attack boost, fraction (0.05 = +5% power). */
  attackBonus: number;
  /** Team defense boost, fraction (0.05 = 5% less damage taken). */
  defenseBonus: number;
}

export interface FightResult {
  aTroops: number;
  bTroops: number;
  rounds: number;
}

/**
 * Auto-resolve a fight between two squads until one reaches 0 troops.
 *
 * Both sides take damage every round, simultaneously:
 *   strength = power * counterMult * variance * (1 + attackBonus)
 *   damage   = roundDamageFraction * referenceTroops
 *              * (strength / powerRef)^exponent * (troops / maxTroops)
 * The counter is applied to power before the exponent, so a counter is worth
 * counterMultiplier x power, not a small damage tweak.
 */
export function resolveFight(a: Combatant, b: Combatant, tune: Tune, rng: Rng): FightResult {
  const c = tune.combat;
  const refTroops = tune.squad.maxTroops;
  const vary = () => 1 + rng.float(-c.variance, c.variance);

  const strengthA =
    a.power * (COUNTERS[a.type] === b.type ? c.counterMultiplier : 1) * vary() * (1 + a.attackBonus);
  const strengthB =
    b.power * (COUNTERS[b.type] === a.type ? c.counterMultiplier : 1) * vary() * (1 + b.attackBonus);

  const baseA = c.roundDamageFraction * refTroops * Math.pow(strengthA / c.powerRef, c.powerExponent);
  const baseB = c.roundDamageFraction * refTroops * Math.pow(strengthB / c.powerRef, c.powerExponent);
  const takenByA = 1 - Math.min(0.95, Math.max(0, a.defenseBonus));
  const takenByB = 1 - Math.min(0.95, Math.max(0, b.defenseBonus));

  let ta = a.troops;
  let tb = b.troops;
  let rounds = 0;
  // Damage scales with the attacker's own troops, so an even fight decays
  // geometrically and never reaches exactly 0. Under half a troop counts as gone.
  while (ta >= 0.5 && tb >= 0.5 && rounds < c.maxRounds) {
    const dealtByA = baseA * (ta / a.maxTroops);
    const dealtByB = baseB * (tb / b.maxTroops);
    tb -= dealtByA * takenByB;
    ta -= dealtByB * takenByA;
    rounds++;
  }

  // Whole troops: under half a troop is defeated, otherwise at least 1 left.
  const settle = (t: number) => (t < 0.5 ? 0 : Math.max(1, Math.round(t)));
  return { aTroops: settle(ta), bTroops: settle(tb), rounds };
}
