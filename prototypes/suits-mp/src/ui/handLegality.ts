import { cardById, cardId } from '../rules/cards';
import { isForcedTrick1Opener, legalOptions } from '../rules/engine';
import type { CardId } from '../rules/types';
import type { MaskedState, PlayType } from '../net/actions';

// Pure state-machine logic, deliberately kept free of any Phaser/DOM
// dependency (unlike renderGameView.ts, which imports Phaser and therefore
// can't be loaded standalone in plain Node) so it can be unit-tested
// directly.

export const COLOR_SELECTED = '#ffd27a';
export const COLOR_LEGAL = '#ffffff';
export const COLOR_PARTNER = '#88ffff';
export const COLOR_ILLEGAL = '#666666';

export type CardVisualState = 'selected' | 'legal' | 'partner' | 'illegal';

export function colorFor(cardState: CardVisualState): string {
  switch (cardState) {
    case 'selected':
      return COLOR_SELECTED;
    case 'partner':
      return COLOR_PARTNER;
    case 'legal':
      return COLOR_LEGAL;
    case 'illegal':
      return COLOR_ILLEGAL;
  }
}

export interface HandLegality {
  states: Map<CardId, CardVisualState>;
  leading: boolean;
  forcedOpener: CardId | null;
  mustPlaySuit: boolean;
  playType: PlayType | null;
}

// The state machine behind items 3/4 of the follow-up brief: which cards
// in hand are currently legal (white/tappable) vs illegal (gray/inert),
// recomputed from scratch on every selection change. Four cases, most to
// least restrictive:
//
//  1. Trick 1's forced opener (shares rules/engine.ts's
//     isForcedTrick1Opener with playCard()'s authoritative check and the
//     bot AI's move choice - see that function's doc comment): only the
//     2 of Yog-Sothoth is ever legal.
//  2. Leading any other trick, or required to follow suit: only cards in
//     the legal pool (any single when leading, or the suit cards when
//     following) are legal: still single-select only, no doubles.
//  3. Off-suit and nothing selected yet: every card is legal (any of them
//     could become a facedown single or start a double).
//  4. Off-suit with one card selected: that card is 'selected', same-rank
//     cards are 'partner' (highlighted, still legal - selecting one
//     completes a Twin Awakening double), everything else stays plain
//     'legal' (a facedown single with just the one card is still a valid
//     confirm). With two matching cards already selected, the double is
//     complete and every other card becomes 'illegal' until a deselect.
export function computeHandLegality(state: MaskedState, selected: readonly CardId[]): HandLegality {
  const hand = state.yourHand;
  const leading = state.currentTrick.length === 0;
  const forcedOpener = isForcedTrick1Opener(state.trickNumber, state.currentTrick.length)
    ? cardId('YogSothoth', 2)
    : null;
  const states = new Map<CardId, CardVisualState>();

  if (forcedOpener) {
    for (const id of hand) states.set(id, id === forcedOpener ? 'legal' : 'illegal');
    const selectedForced = selected.length === 1 && selected[0] === forcedOpener;
    if (selectedForced) states.set(forcedOpener, 'selected');
    return { states, leading, forcedOpener, mustPlaySuit: false, playType: selectedForced ? 'single' : null };
  }

  const opts = legalOptions(hand, leading ? null : state.requiredSuit);

  if (leading || opts.mustPlaySuit) {
    const pool = new Set(leading ? hand : opts.suitCards);
    for (const id of hand) states.set(id, pool.has(id) ? 'legal' : 'illegal');
    const selectedLegal = selected.length === 1 && pool.has(selected[0]);
    if (selectedLegal) states.set(selected[0], 'selected');
    return { states, leading, forcedOpener: null, mustPlaySuit: !!opts.mustPlaySuit, playType: selectedLegal ? 'single' : null };
  }

  // Off-suit forced: full double-selection state machine.
  if (selected.length === 0) {
    for (const id of hand) states.set(id, 'legal');
    return { states, leading, forcedOpener: null, mustPlaySuit: false, playType: null };
  }
  if (selected.length === 1) {
    const firstRank = cardById(selected[0]).rank;
    for (const id of hand) {
      if (id === selected[0]) states.set(id, 'selected');
      else states.set(id, cardById(id).rank === firstRank ? 'partner' : 'legal');
    }
    return { states, leading, forcedOpener: null, mustPlaySuit: false, playType: 'facedownSingle' };
  }
  // selected.length === 2: a completed double. Only reachable by tapping a
  // 'partner' card, which is already guaranteed same-rank as the first.
  for (const id of hand) states.set(id, selected.includes(id) ? 'selected' : 'illegal');
  return { states, leading, forcedOpener: null, mustPlaySuit: false, playType: 'double' };
}

// Given the card just tapped and its current visual state, returns the
// next selection array. Shared by renderPlayPhase's tap handler so the
// "replace vs. accumulate into a double" decision lives in one place
// alongside the legality computation it depends on.
export function nextSelectionAfterTap(
  current: readonly CardId[],
  tappedId: CardId,
  tappedState: CardVisualState,
  legality: Pick<HandLegality, 'forcedOpener' | 'leading' | 'mustPlaySuit'>,
): CardId[] {
  if (tappedState === 'selected') {
    return current.filter((c) => c !== tappedId);
  }
  if (legality.forcedOpener || legality.leading || legality.mustPlaySuit) {
    // Single-select contexts: a new legal tap always replaces whatever was
    // selected, rather than trying to accumulate a second card.
    return [tappedId];
  }
  if (current.length === 0) {
    return [tappedId];
  }
  if (tappedState === 'partner') {
    // Matching rank as the one card already selected - completes the Twin
    // Awakening double.
    return [...current, tappedId];
  }
  // Off-suit, one card already selected, this tap is a different rank -
  // replace rather than form an invalid mismatched pair.
  return [tappedId];
}
