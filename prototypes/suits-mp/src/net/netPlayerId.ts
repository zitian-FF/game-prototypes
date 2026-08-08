import type { PlayerId } from '../rules/types';

// Wire representation of a seat: "p0".."p3". The rules engine's own
// PlayerId (0|1|2|3) never goes over the network directly - every action
// and masked-state payload speaks this string form instead, matching the
// brief's `targetPlayer: "p3"` example.
export type NetPlayerId = 'p0' | 'p1' | 'p2' | 'p3';

export function toNetPlayerId(id: PlayerId): NetPlayerId {
  return `p${id}` as NetPlayerId;
}

export function fromNetPlayerId(id: NetPlayerId): PlayerId {
  return Number(id.slice(1)) as PlayerId;
}

export const ALL_NET_PLAYER_IDS: readonly NetPlayerId[] = ['p0', 'p1', 'p2', 'p3'];
