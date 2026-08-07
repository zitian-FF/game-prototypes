import type { Room } from 'trystero/nostr';

// The generic messaging layer future game prototypes will build on top of.
// Four fixed channels: a discrete input bitmask, a continuous analog pair,
// host-authored UI/state pushes, and the client-identity handshake.

export type AnalogInput = { x: number; y: number };

export type HostUIMessage = { type: 'gameStarted' };

export function createNetworkActions(room: Room) {
  return {
    // Discrete button states as a bitmask. Only send on change.
    input: room.makeAction<number>('input'),
    // Continuous input, separate channel from the input bitmask.
    analogInput: room.makeAction<AnalogInput>('analogInput'),
    // Host -> player(s) UI/state pushes, optionally targeted at one peer.
    hostUI: room.makeAction<HostUIMessage>('hostUI'),
    // Player -> host handshake: persistent client ID, sent on (re)join.
    identity: room.makeAction<string>('identity'),
  };
}

export type NetworkActions = ReturnType<typeof createNetworkActions>;
