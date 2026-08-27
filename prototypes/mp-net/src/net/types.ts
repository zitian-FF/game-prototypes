import type { BaseRosterEntry, SharedNetData as CoreSharedNetData } from 'mp-core';
import type { NetworkActions } from './actions';

// Data threaded through every scene via Phaser scene data, so the room and
// its actions are created exactly once per session and shared across scene
// transitions.
export type SharedNetData = CoreSharedNetData<NetworkActions>;

// Host-side roster entry, keyed by persistent client ID (not trystero's
// transient peerId) so a reconnect can be matched back to the same slot.
export interface RosterEntry extends BaseRosterEntry {
  counter: number;
  isHost: boolean;
}

export type Roster = Map<string, RosterEntry>;
