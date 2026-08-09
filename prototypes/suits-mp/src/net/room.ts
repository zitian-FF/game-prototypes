import { joinRoom } from 'trystero/nostr';
import type { Room } from 'trystero/nostr';

const APP_ID = 'suits-mp';

export interface CreateRoomOptions {
  // TURN/STUN servers fetched from mp-net's Cloudflare Worker. Passed
  // through as Trystero's `turnConfig`, which is additive to Trystero's own
  // default STUN servers rather than replacing them.
  iceServers?: RTCIceServer[];
  // Fires when peers exchanged SDP but WebRTC still could not establish a
  // connection - the "TURN fallback failed" case callers need to surface
  // distinctly from a plain timeout.
  onConnectionFailed?: () => void;
}

// Trystero's nostr strategy picks its signaling relays deterministically
// from a hash of `appId`, which can land on small hobbyist relays with no
// uptime guarantee - if none of the derived relays are reachable, peers can
// never discover each other regardless of network conditions on either
// side. Pinned instead to the same handful of well-established, widely-used
// public relays already fixed in mp-net/mp-base (see mp-net's PR #14 and
// root CLAUDE.md's Networking section).
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
