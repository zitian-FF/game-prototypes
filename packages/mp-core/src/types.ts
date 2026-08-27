import type { Room } from 'trystero/nostr';

// Host-side roster entry, keyed by persistent client ID (not trystero's
// transient peerId) so a reconnect can be matched back to the same slot.
// Every prototype's own RosterEntry extends this with its own game-specific
// fields (turn slot, counter, bot flag, ...) - reconnect.ts's helpers only
// ever read/write the fields declared here.
export interface BaseRosterEntry {
  clientId: string;
  peerId: string;
}

// Data threaded through every player-side scene via Phaser scene data, so
// the room and its actions are created exactly once per session and shared
// across scene transitions. `TActions` is each prototype's own
// `NetworkActions` shape (identity/hostUI plus whatever game-specific
// channels it defines).
export interface SharedNetData<TActions> {
  room: Room;
  actions: TActions;
  clientId: string;
  lobbyCode: string;
}
