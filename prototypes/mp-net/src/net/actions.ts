import type { Room } from 'trystero/nostr';
import {
  createIdentityAction,
  createHostUIAction,
  createInputAction,
  createAnalogInputAction,
  createInputDeltaAction,
} from 'mp-core';

// mp-net's own hostUI signal union - the generic channel/identity/reconnect
// layer this composes is shared via mp-core (see packages/mp-core/README.md);
// `input`/`analogInput` are unused by mp-net's own test mechanic (which uses
// `inputDelta` instead) but kept as generic channels for future prototypes
// that copy this layer, same as mp-base did for `analogInput`.

export type HostUIMessage =
  | { type: 'lobbyJoined' }
  | { type: 'gameStarted' }
  | { type: 'alreadyInProgress' }
  | { type: 'counterUpdate'; clientId: string; counter: number };

export function createNetworkActions(room: Room) {
  return {
    // Discrete button states as a bitmask. Only send on change.
    input: createInputAction(room),
    // Continuous input, separate channel from the input bitmask.
    analogInput: createAnalogInputAction(room),
    // Accumulating press-count delta since the last send. See PlayerButtonScene
    // and HostGameScene for the send-when-idle batching pattern.
    inputDelta: createInputDeltaAction(room),
    // Host -> player(s) UI/state pushes, optionally targeted at one peer.
    hostUI: createHostUIAction<HostUIMessage>(room),
    // Player -> host handshake: persistent client ID, sent on (re)join.
    identity: createIdentityAction(room),
  };
}

export type NetworkActions = ReturnType<typeof createNetworkActions>;
