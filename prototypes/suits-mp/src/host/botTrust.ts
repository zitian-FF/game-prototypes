import { TEAMMATE_GOD, cardById } from '../rules/cards';
import type { GameState, God, PlayerId } from '../rules/types';

// Section 4 of suits-mp-bot-ai-design.md (v5): trust modeling. Every
// function here computes a DERIVED value fresh from GameState each time
// it's called - there is no persistent "bot memory" object, and nothing
// here is threaded through chooseBotAction's existing pure (state, slot)
// shape. `state.receivedLog[slot]` is the exact same cumulative,
// per-recipient redistribution history that already backs the real
// Redistribution Log UI (see host/mask.ts's buildDistributedEntries and
// its `receivedByMe` entries, both built from this same field) - a bot
// reasoning from it uses exactly what a real human player in that seat
// already legitimately sees, nothing more.
//
// Masking honesty: every function below reads ONLY `state.players[slot]`
// (the bot's own seat) and `state.receivedLog[slot]` (redistributions the
// bot's own seat was the RECIPIENT of - the bot's own witnessed history).
// No other player's hand, hidden identity, or receivedLog entry is ever
// read.
//
// Trust is one-sided and individually calculated (design doc 4.1): this
// module computes ONE bot's own perception of the other three seats, from
// that bot's own observed exchanges only. There is no shared or compared
// state between bots - each call is independent, and nothing here lets
// one bot's computed trust influence, or be compared against, another's.
//
// This module is exposed but NOT YET CONSUMED anywhere - nothing in
// host/botAI.ts calls into it, so this task changes zero bot behavior.
// It's built for the next task (design doc Section 5.1-5.2) to consume
// directly, per this task's own scope.

// Placeholder threshold, not yet empirically tuned via the simulation
// tool (matching the design doc's own "exact values to be tuned
// empirically, not guessed" precedent for other constants elsewhere) -
// net trust (helpful minus unhelpful received cards) must reach this
// before a player is labeled friendly.
export const FRIENDLY_TRUST_THRESHOLD = 2;

// Per-seat net trust score (design doc 4.2): +1 for each individual
// received card that matched the bot's own needed suit ("helped" the
// bot), -1 for each that didn't. Scored per CARD rather than per
// ReceivedRecord, since a single record can hold more than one card (the
// bot's own contribution to that trick could have been a Double).
// Seats that have never redistributed to this bot at all simply have no
// entry in the returned map - callers that need every other seat
// represented (e.g. identifyFriendlyAlly below) should default a missing
// entry to 0, not treat it as excluded.
export function computeTrustScores(state: GameState, slot: PlayerId): ReadonlyMap<PlayerId, number> {
  const ownGod = state.players[slot].god;
  const scores = new Map<PlayerId, number>();
  const records = state.receivedLog[slot] ?? [];
  for (const record of records) {
    let score = scores.get(record.fromPlayerId) ?? 0;
    for (const cardId of record.cardIds) {
      score += cardById(cardId).god === ownGod ? 1 : -1;
    }
    scores.set(record.fromPlayerId, score);
  }
  return scores;
}

export interface FriendlyAlly {
  readonly friendlyPlayer: PlayerId;
  readonly friendlyPlayerDeity: God;
}

// Design doc 4.2 + 4.3, re-evaluated fresh from current state on every
// call - never cached or locked in, so a shifting trust picture (e.g. an
// early false-positive ally who stops helping, or contradicting evidence
// that swings the lead to a different seat) is reflected immediately the
// next time this is called. This matches Section 5.4's "live, ongoing"
// principle, applied here a task early since it costs nothing extra to
// keep this derived rather than cached.
//
// Returns null when no seat has crossed FRIENDLY_TRUST_THRESHOLD, OR when
// two seats are tied at the current maximum (an ambiguous case - the
// game's fixed 2v2 structure assumes exactly one relationship becomes
// confident, with the other two inferred by elimination; a tie means the
// evidence isn't there yet to pick one, not that both are somehow
// friendly). Callers needing the "other two are hostile by elimination"
// half of design doc 4.2 get it for free once this returns non-null: any
// PlayerId that isn't `slot` or the returned `friendlyPlayer` is hostile,
// with no separate computation needed.
//
// `friendlyPlayerDeity` is deliberately NOT derived from which suit of
// card raised trust in that seat - that suit is always the OBSERVING
// bot's own needed suit (by definition of what "helped" means in
// computeTrustScores above), so it can never equal an ally's actual
// needed suit, since every seat's god is necessarily distinct from every
// other seat's. Instead, once a seat is confirmed as this bot's ally
// (same team), that ally's specific Deity is already known for free
// through the game's own fixed team-pairing (rules/cards.ts's
// TEAMMATE_GOD) - the exact same fact the real UI already shows every
// human player about their own teammate's needed suit/colour, never
// their identity (see ui/renderGameView.ts's
// `TEAMMATE_GOD[state.yourGod]` HUD use). This function's only new
// contribution is identifying WHICH SEAT that teammate is; the Deity
// itself was never masked in the first place.
export function identifyFriendlyAlly(state: GameState, slot: PlayerId): FriendlyAlly | null {
  const scores = computeTrustScores(state, slot);
  const otherSeats = ([0, 1, 2, 3] as const).filter((id): id is PlayerId => id !== slot);

  let bestPlayer: PlayerId | null = null;
  let bestScore = -Infinity;
  let tied = false;
  for (const playerId of otherSeats) {
    const score = scores.get(playerId) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestPlayer = playerId;
      tied = false;
    } else if (score === bestScore) {
      tied = true;
    }
  }

  if (bestPlayer === null || tied || bestScore < FRIENDLY_TRUST_THRESHOLD) return null;

  return {
    friendlyPlayer: bestPlayer,
    friendlyPlayerDeity: TEAMMATE_GOD[state.players[slot].god],
  };
}
