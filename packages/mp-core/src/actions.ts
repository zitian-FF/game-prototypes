import type { DataPayload, Room } from 'trystero/nostr';

// Generic Trystero channel creators shared by every mp-* prototype. Each
// prototype composes its own `createNetworkActions(room)` from whichever of
// these it needs, plus its own game-specific channels (e.g. suits-mp's
// `gameAction`/`state`) - this package never assumes a fixed action set,
// since not every prototype needs input/analogInput/inputDelta (suits-mp's
// turn-based actions replace them entirely).

export type AnalogInput = { x: number; y: number };

// Player -> host handshake: persistent client ID, sent on (re)join. Same
// channel name and payload shape across every mp-* prototype - this is what
// net/reconnect.ts's helpers key off of.
export function createIdentityAction(room: Room) {
  return room.makeAction<string>('identity');
}

// Host -> peer(s) UI/state pushes, optionally targeted at one peer. The
// payload union (`HostUIMessage`) is always prototype-specific (each game
// has its own lobby/session signals), so the message type is generic here.
export function createHostUIAction<T extends DataPayload>(room: Room) {
  return room.makeAction<T>('hostUI');
}

// Discrete button states as a bitmask. Only send on change.
export function createInputAction(room: Room) {
  return room.makeAction<number>('input');
}

// Continuous input, separate channel from the input bitmask.
export function createAnalogInputAction(room: Room) {
  return room.makeAction<AnalogInput>('analogInput');
}

// Accumulating delta channel (e.g. a press-count) since the last send - see
// the consuming prototype's send-when-idle batching pattern.
export function createInputDeltaAction(room: Room) {
  return room.makeAction<number>('inputDelta');
}
