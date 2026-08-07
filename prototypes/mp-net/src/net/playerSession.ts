import type { SharedNetData } from './types';

// Data threaded through the player-side scene chain (Connecting -> PlayerLobby
// -> PlayerButton). `hostPeerId` is a mutable ref cell rather than a plain
// field: it's set once a hostUI message reveals which peerId is the host
// (the only peer that ever sends hostUI), and every later scene reads the
// same box so a `room.onPeerLeave` in any of them can recognize "that was
// the host" without re-deriving it.
export interface PlayerSessionData extends SharedNetData {
  hostPeerId: { current: string | null };
}

export interface BootData {
  clientId: string;
  iceServersPromise: Promise<RTCIceServer[] | undefined>;
}
