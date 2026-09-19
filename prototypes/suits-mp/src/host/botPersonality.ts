import type { PlayerId } from '../rules/types';

// Design doc Section 7 (v6, amended per discussion): personality
// assignment. Random per bot seat, per game, assigned once host-side at
// game init - never exposed to masked state or player-facing UI in this
// task. The 3 originally-proposed axes collapsed to a single
// aggression<->conservation spectrum plus volatility (an oscillation on
// top of that spectrum, not a 3rd independent axis): Rusher (fixed
// aggressive), Hoarder (fixed conservative), Balanced (neutral, no
// bias), Wildcard (oscillates per trick). The doc's 4th property,
// "trust-favoring strength," is confirmed merged into conservation -
// not implemented separately.
//
// This is the ONE piece of genuine, persistent per-bot state in the
// whole bot AI - every other function across host/botAI.ts,
// host/botRole.ts, and host/botTrust.ts is a pure function of
// (state, slot) with zero memory, a principle maintained deliberately
// through every prior task in this series. Two things here are
// inherently stateful and can't be re-derived from GameState alone:
// "assigned once per game" (a seat's archetype must stay fixed across
// many chooseBotAction calls) and Wildcard's "once per trick, do not
// re-roll mid-trick" (needs to remember what it rolled for the
// CURRENT trick). Rather than adding a field to the canonical,
// network-masked GameState (which would then need explicit exclusion
// from every masked payload - a much larger, riskier change for a
// bot-AI-only feature), personality lives entirely outside GameState,
// in a small per-seat object created once by whoever drives bots for a
// game (HostGameScene.ts for real play, scripts/simulate.ts for
// self-play) and threaded explicitly into chooseBotAction as a new
// parameter.

export type Personality = 'rusher' | 'hoarder' | 'balanced' | 'wildcard';

// What a personality actually resolves to for one decision - the real
// lever mechanics 1 and 2 read. Rusher/Hoarder/Balanced always resolve
// the same way; Wildcard resolves differently per trick (see
// resolveMode below).
export type PersonalityMode = 'aggressive' | 'conservative' | 'neutral';

const ALL_PERSONALITIES: readonly Personality[] = ['rusher', 'hoarder', 'balanced', 'wildcard'];

export interface BotPersonalityState {
  readonly personality: Personality;
  // Wildcard only - the CURRENT trick's rolled mode. Re-rolled lazily
  // (mutating this object) the first time resolveMode() is asked about a
  // new trickNumber; every other personality never touches this field.
  // Mutation is confined to this one object and this one function - nothing
  // else in the bot AI mutates shared state. Not `readonly` deliberately -
  // this is the one intentional exception to this module's otherwise
  // fully immutable/pure style.
  wildcardRoll: { readonly trickNumber: number; readonly mode: 'aggressive' | 'conservative' } | null;
}

function randomPersonality(): Personality {
  return ALL_PERSONALITIES[Math.floor(Math.random() * ALL_PERSONALITIES.length)];
}

export function createBotPersonality(): BotPersonalityState {
  return { personality: randomPersonality(), wildcardRoll: null };
}

// One independent random draw per seat - archetypes are not required to
// be distinct across the 4 seats in a game, matching "random per bot
// seat" read literally (no stated constraint that all 4 archetypes must
// appear each game).
export function createBotPersonalities(): Record<PlayerId, BotPersonalityState> {
  return {
    0: createBotPersonality(),
    1: createBotPersonality(),
    2: createBotPersonality(),
    3: createBotPersonality(),
  };
}

// Resolves this bot's mode for the CURRENT decision. `trickNumber` scopes
// Wildcard's roll: callers pass `state.trickNumber`, which is the same
// value for every decision within one trick - including a later
// redistribution that trick's outcome triggers (rules/engine.ts's
// redistribute() only increments trickNumber in its own non-winning
// branch, AFTER a redistribution completes, so state.trickNumber during
// the 'redistribution' phase is still the trick that produced it). This
// is exactly the design doc's own requirement: "apply that trick's
// rolled mode consistently to BOTH mechanic 1... and mechanic 2..." -
// whichever decision happens first in a trick triggers the roll, and
// every later decision in the same trick reads the same cached value.
export function resolveMode(bot: BotPersonalityState, trickNumber: number): PersonalityMode {
  switch (bot.personality) {
    case 'rusher':
      return 'aggressive';
    case 'hoarder':
      return 'conservative';
    case 'balanced':
      return 'neutral';
    case 'wildcard': {
      if (bot.wildcardRoll === null || bot.wildcardRoll.trickNumber !== trickNumber) {
        bot.wildcardRoll = {
          trickNumber,
          mode: Math.random() < 0.5 ? 'aggressive' : 'conservative',
        };
      }
      return bot.wildcardRoll.mode;
    }
  }
}
