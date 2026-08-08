import { joinRoom } from 'trystero/nostr';
import type { Room } from 'trystero/nostr';

const APP_ID = 'mp-net';

export interface CreateRoomOptions {
  // TURN/STUN servers fetched from the project's Cloudflare Worker. Passed
  // through as Trystero's `turnConfig`, which is additive to Trystero's own
  // default STUN servers rather than replacing them.
  iceServers?: RTCIceServer[];
  // Fires when peers exchanged SDP but WebRTC still could not establish a
  // connection - the "TURN fallback failed" case callers need to surface
  // distinctly from a plain timeout.
  onConnectionFailed?: () => void;
}

// Trystero's nostr strategy picks its signaling relays deterministically
// from a ~47-relay pool, hashed from `appId` - every mp-net client lands on
// the exact same 5 relays, which for this appId happen to be small
// hobbyist/test instances (including one literally named "testrelay") with
// no uptime guarantee. If any of those happen to be down, host and joiner
// can never discover each other - "no host found" - regardless of network
// conditions on either side. Pinning to a handful of well-established,
// widely-used public relays instead of trusting that derived pick is a much
// more reliable bet for actual peer discovery.
const RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.mostr.pub',
  'wss://purplerelay.com',
  'wss://nostr.data.haus',
];

export function createNetworkRoom(lobbyCode: string, options: CreateRoomOptions = {}): Room {
  return joinRoom(
    {
      appId: APP_ID,
      turnConfig: options.iceServers,
      relayConfig: { urls: RELAY_URLS },
    },
    lobbyCode,
    {
      onJoinError: () => {
        options.onConnectionFailed?.();
      },
    },
  );
}
