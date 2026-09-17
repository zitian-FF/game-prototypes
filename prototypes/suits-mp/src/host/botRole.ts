import { cardById } from '../rules/cards';
import type { GameState, PlayerId } from '../rules/types';

// Section 5 of suits-mp-bot-ai-design.md (v6, unchanged from v5): the
// Completer/Assist role system. Purely self-referential - a bot decides
// its own role from its own current hand composition alone, never by
// comparing anything against its ally or any other player. Computed fresh
// from GameState every call (design doc 5.4: "live, ongoing... not a
// one-time decision"), no caching, no persistent state - matches
// chooseBotAction's existing pure (state, slot) shape.

export type BotRole = 'completer' | 'assist';

// Placeholder, not yet empirically tuned via the simulation tool (same
// status as host/botTrust.ts's FRIENDLY_TRUST_THRESHOLD). A hand is "mono"
// (concentrated toward the bot's own needed suit, design doc 5) when at
// least this fraction of it is the bot's own god's cards.
export const ROLE_MONO_THRESHOLD = 0.5;

// Masking honesty: reads only `state.players[slot]` - the bot's own hand
// and own Deity. Nothing else.
export function determineRole(state: GameState, slot: PlayerId): BotRole {
  const player = state.players[slot];
  if (player.hand.length === 0) return 'completer';
  const ownSuitCount = player.hand.filter((id) => cardById(id).god === player.god).length;
  const ownSuitFraction = ownSuitCount / player.hand.length;
  return ownSuitFraction >= ROLE_MONO_THRESHOLD ? 'completer' : 'assist';
}
