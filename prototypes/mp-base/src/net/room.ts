import { joinRoom } from 'trystero/nostr';
import type { Room } from 'trystero/nostr';

const APP_ID = 'mp-base';

export function createNetworkRoom(lobbyCode: string): Room {
  return joinRoom({ appId: APP_ID }, lobbyCode);
}
