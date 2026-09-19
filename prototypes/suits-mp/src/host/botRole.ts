import { cardById } from '../rules/cards';
import type { GameState, PlayerId } from '../rules/types';
import type { PersonalityMode } from './botPersonality';

// Section 5 of suits-mp-bot-ai-design.md (v6, unchanged from v5): the
// Completer/Assist role system. Purely self-referential - a bot decides
// its own role from its own current hand composition alone, never by
// comparing anything against its ally or any other player. Computed fresh
// from GameState every call (design doc 5.4: "live, ongoing... not a
// one-time decision"), no caching, no persistent state - matches
// chooseBotAction's existing pure (state, slot) shape.
//
// Section 7 (personalities), mechanic 2: personality does NOT override
// this mono/mixed determination - it nudges the existing scoring metric
// (`ownSuitFraction` below) by a small, fixed offset BEFORE thresholding.
// Aggressive nudges the fraction down (more likely to land below
// ROLE_MONO_THRESHOLD, i.e. toward assist); conservative nudges it up
// (more likely to land at/above threshold, i.e. toward completer);
// neutral (Balanced, or no personality context at all) applies no
// offset. PERSONALITY_ROLE_BIAS is deliberately small relative to the
// 0.5 threshold: a hand already far from the boundary (strongly mono or
// strongly mixed) stays on the same side regardless of personality; only
// a hand genuinely near 0.5 can flip.

export type BotRole = 'completer' | 'assist';

// Placeholder, not yet empirically tuned via the simulation tool (same
// status as host/botTrust.ts's FRIENDLY_TRUST_THRESHOLD). A hand is "mono"
// (concentrated toward the bot's own needed suit, design doc 5) when at
// least this fraction of it is the bot's own god's cards.
export const ROLE_MONO_THRESHOLD = 0.5;

// Also a placeholder, not yet empirically tuned. Kept well under half the
// distance from a "clearly mono" or "clearly mixed" hand to the threshold
// for a typical ~10-13 card hand, so personality only ever matters at the
// boundary, never overriding a hand that's genuinely one way or the other.
export const PERSONALITY_ROLE_BIAS = 0.1;

// Masking honesty: reads only `state.players[slot]` - the bot's own hand
// and own Deity. Nothing else. `mode` is the caller's own already-resolved
// personality mode (host/botPersonality.ts's resolveMode) - not read from
// any shared or hidden state either.
export function determineRole(state: GameState, slot: PlayerId, mode: PersonalityMode = 'neutral'): BotRole {
  const player = state.players[slot];
  if (player.hand.length === 0) return 'completer';
  const ownSuitCount = player.hand.filter((id) => cardById(id).god === player.god).length;
  const ownSuitFraction = ownSuitCount / player.hand.length;
  const bias = mode === 'aggressive' ? -PERSONALITY_ROLE_BIAS : mode === 'conservative' ? PERSONALITY_ROLE_BIAS : 0;
  return ownSuitFraction + bias >= ROLE_MONO_THRESHOLD ? 'completer' : 'assist';
}
