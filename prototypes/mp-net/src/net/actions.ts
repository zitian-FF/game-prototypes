import type { Room } from 'trystero/nostr';

// The generic messaging layer, same shape as mp-base's: a discrete input
// bitmask, a continuous analog pair, an accumulating delta channel, host-
// authored UI/state pushes, and the client-identity handshake. `input` and
// `analogInput` are unused by mp-net's own test mechanic (which uses
// `inputDelta` instead) but kept as generic channels for future prototypes
// that copy this layer, same as mp-base did for `analogInput`.

export type AnalogInput = { x: number; y: number };

export type HostUIMessage =
  | { type: 'lobbyJoined' }
  | { type: 'gameStarted' }
  | { type: 'alreadyInProgress' }
  | { type: 'counterUpdate'; clientId: string; counter: number };

export function createNetworkActions(room: Room) {
  return {
    // Discrete button states as a bitmask. Only send on change.
    input: room.makeAction<number>('input'),
    // Continuous input, separate channel from the input bitmask.
    analogInput: room.makeAction<AnalogInput>('analogInput'),
    // Accumulating press-count delta since the last send. See PlayerButtonScene
    // and HostGameScene for the send-when-idle batching pattern.
    inputDelta: room.makeAction<number>('inputDelta'),
    // Host -> player(s) UI/state pushes, optionally targeted at one peer.
    hostUI: room.makeAction<HostUIMessage>('hostUI'),
    // Player -> host handshake: persistent client ID, sent on (re)join.
    identity: room.makeAction<string>('identity'),
  };
}

export type NetworkActions = ReturnType<typeof createNetworkActions>;
