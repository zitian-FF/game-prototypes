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
 * How many squads each commander of a team gets: fourSquadShare of them four, threeSquadShare three, the
 * rest two. Rounded so the shares hold exactly for 20, and nobody has a single squad.
 */
export function squadCounts(n: number, tune: Tune): number[] {
  const four = Math.round(n * tune.roster.fourSquadShare);
  const three = Math.min(n - four, Math.round(n * tune.roster.threeSquadShare));
  return Array.from({ length: n }, (_, i) => (i < four ? 4 : i < four + three ? 3 : 2));
}

/**
 * Deal squads. Every commander gets at least two; the 1st and 2nd come from strong overlapping rank
 * bands, the 3rd and 4th from weak ones (support and strategic movement). Squad counts are dealt per
 * team so the shares hold on both sides. `teamOf` gives each id's team (default: alternate in shuffled order).
 */
export function rollPlayers(rng: Rng, tune: Tune, playerIds: readonly string[], teamOf?: (id: string) => TeamId): PlayerSpec[] {
  const bands = tune.roster.bands;
  const order = rng.shuffle(playerIds);
  const teams = order.map((id, i) => teamOf?.(id) ?? ((i % 2) as TeamId));
  const counts: number[] = new Array(order.length).fill(2);
  for (const team of [0, 1] as const) {
    const idx = order.map((_, i) => i).filter((i) => teams[i] === team);
    const sizes = rng.shuffle(squadCounts(idx.length, tune));
    idx.forEach((i, k) => (counts[i] = sizes[k]));
  }
  return order.map((id, i) => ({
    id,
    team: teams[i],
    pool: rng.int(tune.squad.reservePoolMin, tune.squad.reservePoolMax),
    squads: Array.from({ length: counts[i] }, (_, s) => rollSquad(rng, tune, bands[s][0], bands[s][1])),
  }));
}
