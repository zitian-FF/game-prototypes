import { ALL_NET_PLAYER_IDS } from './netPlayerId';
import type { Roster } from './types';

// Slot IDs define clockwise game order. Shuffle occupants at each deal so
// lobby order and player-number labels do not dictate seating or turns.
export function shuffleRosterSeats(roster: Roster, random = Math.random): void {
  const slots = [...ALL_NET_PLAYER_IDS];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  [...roster.values()].forEach((entry, i) => { entry.slot = slots[i]; });
}
