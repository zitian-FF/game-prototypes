import type { BaseRosterEntry, SharedNetData as CoreSharedNetData } from 'mp-core';
import type { NetworkActions } from './actions';
import type { NetPlayerId } from './netPlayerId';

// Data threaded through every scene via Phaser scene data, so the room and
// its actions are created exactly once per session and shared across scene
// transitions.
export type SharedNetData = CoreSharedNetData<NetworkActions>;

// Host-side roster entry, keyed by persistent client ID (not trystero's
// transient peerId) so a reconnect can be matched back to the same slot.
// `slot` is the fixed seat assignment ("p0".."p3", host is always "p0")
// used both for turn order and for every masked-state/action payload.
// `isBot` marks a host-local AI seat (see host/botAI.ts) - it has no real
// network peer, so `peerId` is a harmless placeholder never used for
// sending. `displayName` is narrowed back to required here - suits-mp
// always sends/stores one (even if empty for now), unlike mp-core's other
// consumers, which don't use the named-identity payload at all and leave
// `BaseRosterEntry.displayName` optional (see packages/mp-core/README.md).
export interface RosterEntry extends BaseRosterEntry {
  displayName: string;
  slot: NetPlayerId;
  isHost: boolean;
  isBot?: boolean;
}

export type Roster = Map<string, RosterEntry>;

export const ROOM_CAPACITY = 4;
