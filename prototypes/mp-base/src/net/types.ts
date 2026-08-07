import type { Room } from 'trystero/nostr';
import type { NetworkActions } from './actions';

// Data threaded through every scene via Phaser scene data, so the room and
// its actions are created exactly once per session and shared across scene
// transitions.
export interface SharedNetData {
  room: Room;
  actions: NetworkActions;
  clientId: string;
  lobbyCode: string;
}

// Host-side roster entry, keyed by persistent client ID (not trystero's
// transient peerId) so a reconnect can be matched back to the same slot.
export interface RosterEntry {
  clientId: string;
  peerId: string;
  counter: number;
  lastInputMask: number;
}

export type Roster = Map<string, RosterEntry>;
