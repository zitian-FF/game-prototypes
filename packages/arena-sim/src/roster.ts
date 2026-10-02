import type { Rng } from './rng';
import { SQUAD_TYPES } from './types';
import type { PlayerSpec, SquadSpec, TeamId, Tune } from './types';

/**
 * Power band for a rank. Rank 1 is the strongest, so it gets the top slice
 * of [power.min, power.max]; the range is split into equal slices, one per rank.
 */
export function powerBand(rank: number, tune: Tune): [number, number] {
  const { ranks } = tune.roster;
  const width = (tune.power.max - tune.power.min) / ranks;
  const lo = tune.power.min + (ranks - rank) * width;
  return [lo, lo + width];
}

export function rollSquad(rng: Rng, tune: Tune, rankMin: number, rankMax: number): SquadSpec {
  const rank = rng.int(rankMin, rankMax);
  const [lo, hi] = powerBand(rank, tune);
  const v = tune.squad.maxTroopsVariance;
  return {
    type: rng.pick(SQUAD_TYPES),
    rank,
    power: rng.float(lo, hi),
    maxTroops: Math.round(tune.squad.maxTroops * (1 + rng.float(-v, v))),
  };
}

/**
 * Deal teams and squads. Everyone gets one squad; most get a second from the
 * lower ranks; a few of those also get a third from the lowest ranks.
 * Teams are balanced (sizes differ by at most one).
 */
export function rollPlayers(rng: Rng, tune: Tune, playerIds: readonly string[]): PlayerSpec[] {
  const r = tune.roster;
  const order = rng.shuffle(playerIds);
  const specs: PlayerSpec[] = [];
  order.forEach((id, i) => {
    const squads = [rollSquad(rng, tune, r.squad1RankMin, r.squad1RankMax)];
    if (rng.chance(r.squad2Chance)) {
      squads.push(rollSquad(rng, tune, r.squad2RankMin, r.squad2RankMax));
      // A third squad needs a second one first.
      if (rng.chance(r.squad3Chance)) {
        squads.push(rollSquad(rng, tune, r.squad3RankMin, r.squad3RankMax));
      }
    }
    specs.push({
      id,
      team: (i % 2) as TeamId,
      pool: rng.int(tune.squad.reservePoolMin, tune.squad.reservePoolMax),
      squads,
    });
  });
  return specs;
}
