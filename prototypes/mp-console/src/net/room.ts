import { joinRoom } from 'trystero/nostr';
import type { Room } from 'trystero/nostr';

const APP_ID = 'mp-console';

// Trystero's nostr strategy picks its signaling relays deterministically
// from a ~47-relay pool, hashed from `appId` - every mp-console client lands
// on the same derived relays, which can be small hobbyist/test instances with
// no uptime guarantee. If those happen to be down, host and joiner can never
// discover each other regardless of network conditions on either side (see
// the identical issue fixed in mp-net's net/room.ts, PR #14). Pinning to a
// handful of well-established, widely-used public relays instead of
// trusting that derived pick is a much more reliable bet for peer discovery.
const RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.mostr.pub',
  'wss://purplerelay.com',
  'wss://nostr.data.haus',
];

export function createNetworkRoom(lobbyCode: string): Room {
  return joinRoom({ appId: APP_ID, relayConfig: { urls: RELAY_URLS } }, lobbyCode);
}
