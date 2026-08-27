import type { Room } from 'trystero/nostr';
import {
  createIdentityAction,
  createHostUIAction,
  createInputAction,
  createAnalogInputAction,
} from 'mp-core';

// The generic messaging layer future game prototypes will build on top of.
// Four fixed channels: a discrete input bitmask, a continuous analog pair,
// host-authored UI/state pushes, and the client-identity handshake. The
// channel creators themselves are shared via packages/mp-core (see its
// README) - this composes them plus mp-console's own hostUI payload shape.

export type HostUIMessage = { type: 'gameStarted' };

export function createNetworkActions(room: Room) {
  return {
    // Discrete button states as a bitmask. Only send on change.
    input: createInputAction(room),
    // Continuous input, separate channel from the input bitmask.
    analogInput: createAnalogInputAction(room),
    // Host -> player(s) UI/state pushes, optionally targeted at one peer.
    hostUI: createHostUIAction<HostUIMessage>(room),
    // Player -> host handshake: persistent client ID, sent on (re)join.
    identity: createIdentityAction(room),
  };
}

export type NetworkActions = ReturnType<typeof createNetworkActions>;
