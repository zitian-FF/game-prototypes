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

export function createNetworkRoom(lobbyCode: string, options: CreateRoomOptions = {}): Room {
  return joinRoom(
    {
      appId: APP_ID,
      turnConfig: options.iceServers,
    },
    lobbyCode,
    {
      onJoinError: () => {
        options.onConnectionFailed?.();
      },
    },
  );
}
