import type { Room } from 'trystero/nostr';
import type { NetworkActions } from './actions';
import type { NetPlayerId } from './netPlayerId';

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
// `slot` is the fixed seat assignment ("p0".."p3", host is always "p0")
// used both for turn order and for every masked-state/action payload.
// `isBot` marks a host-local AI seat (see host/botAI.ts) - it has no real
// network peer, so `peerId` is a harmless placeholder never used for
// sending.
export interface RosterEntry {
  clientId: string;
  peerId: string;
  slot: NetPlayerId;
  isHost: boolean;
  isBot?: boolean;
}

export type Roster = Map<string, RosterEntry>;

export const ROOM_CAPACITY = 4;
