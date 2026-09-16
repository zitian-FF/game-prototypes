import { cardById } from '../rules/cards';
import { computeDeityCardState, currentRequiredSuit, forcedTrick1Opener, legalOptions, resolveTrick } from '../rules/engine';
import type { CardId, GameState, God, PlayerId, TrickPlay } from '../rules/types';
import { ALL_NET_PLAYER_IDS, toNetPlayerId } from '../net/netPlayerId';
import type { ClientAction, PlayType } from '../net/actions';

// Legal-random AI, with two deliberate exceptions: redistribution has Tier
// A self-interested suit-optimizing logic, and choosePlayCardAction now has
// the Section 3 "card-play extension to Tier A" baseline heuristic (see
// suits-mp-bot-ai-design.md, Google Drive/Working/, v3) - a single, shared
// heuristic with no personality variation yet (that's a later task).
// chooseDelegateAction remains uniform-random, per the design doc.  A bot
// never reads or mutates state directly; it only ever produces a
// ClientAction, which the host applies through the exact same
// gameHost.applyAction path as a real peer's action (see
// HostGameScene.driveBotsIfNeeded) - there is no separate bot rules path,
// so this is a genuine exercise of the same validation every human action
// goes through.
//
// "Needed" throughout this file means exactly one thing, per the design
// doc's deliberately simple binary (not a fuzzy value scale): a card whose
// Deity matches the bot's own Deity. Every other card is freely spendable.
// This only ever reasons about the bot's OWN hand/Deity and the publicly
// observable trick-in-progress (`state.plays`) - masking honesty (design
// doc Section 1.1) is preserved the same way chooseRedistributeAction
// already preserves it: nothing here reads another player's hidden hand or
// identity.

function isNeeded(state: GameState, slot: PlayerId, cardId: CardId): boolean {
  return cardById(cardId).god === state.players[slot].god;
}

// Would this legal suit-card win the trick if played right now, i.e. if the
// trick resolved based only on the plays actually made so far plus this one
// (no lookahead into what remaining players might play - the design doc's
// "superhuman capability cap" rules that out, and Tier A has no multi-trick
// planning). Reuses the engine's own resolveTrick() - the exact real
// rank/Double/Powered-Deity-Card comparison used to decide every real
// trick's winner - rather than a second, bot-local copy of that logic.
// computeDeityCardState() builds the same accurate Dormant/Powered flag
// playCard() itself would compute for this exact play.
function wouldWinIfPlayedNow(state: GameState, slot: PlayerId, cardId: CardId, requiredSuit: God): boolean {
  const candidatePlay: TrickPlay = {
    playerId: slot,
    cardIds: [cardId],
    kind: 'normal',
    requiredSuit,
    deityCardState: computeDeityCardState('normal', [cardId], state.plays),
  };
  return resolveTrick([...state.plays, candidatePlay]).winnerId === slot;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled<T>(items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Design doc Section 3's card-play extension to Tier A, applied uniformly
// (no personality variation yet):
//   1. Leading: prefer a not-needed card - leading grants nothing directly,
//      so there's no reason to risk a needed one. All-needed hand (a real
//      possible edge case, e.g. a hand that's one suit after heavy
//      redistribution) falls back to any legal card (pickRandom(hand)),
//      unchanged from the old fully-random behaviour.
//   2. Must-follow-suit: prefer winning (any Single win grants
//      redistribution rights - unconditionally useful to a self-interested
//      bot) using a not-needed card among winning options where possible;
//      only spend a needed card to win if every winning option needs one.
//      If no legal suit-card would win, prefer a not-needed card over a
//      needed one regardless (losing is inevitable either way, so conserve
//      what's actually useful - design doc item 2).
//   3. Off-suit facedownSingle candidates: prefer not-needed cards for
//      which specific card gets discarded (a facedownSingle can never win a
//      trick, so there's nothing to lose by shedding a spendable card first)
//      - falls back to the full hand if every card is needed. The overall
//      Double-vs-facedownSingle choice itself (whether pickRandom(moves)
//      ends up choosing a Double attempt or a facedownSingle at all) stays
//      exactly as random as before - only which cards become facedownSingle
//      candidates changes, never the Double-generation branch below it.
function choosePlayCardAction(state: GameState, slot: PlayerId): ClientAction {
  const leading = state.plays.length === 0;
  const requiredSuit = leading ? null : currentRequiredSuit(state);
  const hand = state.players[slot].hand;
  const opts = legalOptions(hand, requiredSuit);

  if (leading) {
    // Trick 1 only: the leader has exactly one legal opening card (the 2 of
    // Yog-Sothoth), same restriction playCard() itself enforces - see
    // rules/engine.ts's forcedTrick1Opener.
    const forcedOpener = forcedTrick1Opener(state);
    if (forcedOpener) {
      return { action: 'playCard', playType: 'single', cards: [forcedOpener] };
    }
    const notNeeded = hand.filter((id) => !isNeeded(state, slot, id));
    const leadCard = notNeeded.length > 0 ? pickRandom(notNeeded) : pickRandom(hand);
    return { action: 'playCard', playType: 'single', cards: [leadCard] };
  }
  if (opts.mustPlaySuit) {
    const requiredGod = opts.mustPlaySuit;
    const winningCards = opts.suitCards.filter((id) => wouldWinIfPlayedNow(state, slot, id, requiredGod));
    let chosen: CardId;
    if (winningCards.length > 0) {
      const winningNotNeeded = winningCards.filter((id) => !isNeeded(state, slot, id));
      chosen = winningNotNeeded.length > 0 ? pickRandom(winningNotNeeded) : pickRandom(winningCards);
    } else {
      const notNeeded = opts.suitCards.filter((id) => !isNeeded(state, slot, id));
      chosen = notNeeded.length > 0 ? pickRandom(notNeeded) : pickRandom(opts.suitCards);
    }
    return { action: 'playCard', playType: 'single', cards: [chosen] };
  }

  const notNeeded = hand.filter((id) => !isNeeded(state, slot, id));
  const facedownCandidates = notNeeded.length > 0 ? notNeeded : hand;
  const moves: { playType: PlayType; cards: CardId[] }[] = facedownCandidates.map((id) => ({
    playType: 'facedownSingle',
    cards: [id],
  }));
  for (const rank of opts.doubleRanks) {
    const ofRank = hand.filter((id) => cardById(id).rank === rank);
    const [a, b] = shuffled(ofRank);
    moves.push({ playType: 'double', cards: [a, b] });
  }
  const move = pickRandom(moves);
  return { action: 'playCard', playType: move.playType, cards: move.cards };
}

// Mandatory delegation (see rules/engine.ts's chooseDelegate) already rules
// out self-selection host-side; a bot just picks uniformly among the other
// 3 seats.
function chooseDelegateAction(slot: PlayerId): ClientAction {
  const others = ALL_NET_PLAYER_IDS.filter((id) => id !== toNetPlayerId(slot));
  return { action: 'selectDelegate', targetPlayer: pickRandom(others) };
}

// Tier A (suits-mp-bot-ai-design.md, section 2): self-interested, suit-
// optimizing redistribution - the bot preferentially holds back cards of
// its OWN Deity Suit rather than choosing what to keep at random. Still no
// teammate/opponent awareness (that's Tier B) and still no preference
// between which contributing recipient gets which giveaway card - only
// the self/other split changes, not who among "others" benefits.
//
// Draws from the acting distributor's full hand (not just this trick's
// cards - unlike the masked payload shown to a human distributor, a bot
// has full host-local access to the canonical state, so it's free to use
// the engine's actual, more permissive pool). On a self-redistributed win
// the distributor is the winner; on a delegated (double) win it's the
// delegate, who is the one who actually collected the trick's cards - see
// rules/engine.ts's chooseDelegate/redistribute for where that hand-
// ownership fix lives. Using the winner's hand unconditionally here would
// reproduce the same bug for bot-driven delegated redistributions - and
// since `state.players[distributorId].god` is read from that same
// distributor slot, a delegate's self-interest is correctly judged against
// their OWN Deity Suit, never the original winner's.
//
// Masking honesty (design doc section 1.1): every value read here - the
// distributor's own hand, their own Deity, the real per-recipient owed
// counts - is exactly what the acting distributor is already entitled to
// see and act on as themself; nothing here reaches into another player's
// hand or hidden identity.
function chooseRedistributeAction(state: GameState): ClientAction {
  const distributorId = state.pendingDistributorId;
  const trickResult = state.lastTrickResult;
  if (distributorId === null || !trickResult) throw new Error('bot: no trick result to redistribute from');

  const contribution = new Map<PlayerId, number>();
  for (const play of trickResult.plays) {
    if (play.playerId !== distributorId) {
      contribution.set(play.playerId, (contribution.get(play.playerId) ?? 0) + play.cardIds.length);
    }
  }

  const pool = state.players[distributorId].hand;
  const totalOwed = [...contribution.values()].reduce((sum, n) => sum + n, 0);
  const ownHoldback = pool.length - totalOwed;

  const ownGod = state.players[distributorId].god;
  const ownSuitCards = shuffled(pool.filter((id) => cardById(id).god === ownGod));
  const otherCards = shuffled(pool.filter((id) => cardById(id).god !== ownGod));

  // Fill the holdback preferentially from own-suit cards. Any own-suit
  // cards beyond what the holdback has room for (there are more needed
  // cards than slots to keep them in) join the giveaway pool instead of
  // being kept; if own-suit alone can't fill the holdback, the shortfall
  // is topped up randomly from the other cards - both `ownSuitCards` and
  // `otherCards` are already shuffled, so slicing off the front of either
  // is itself a random pick within that group.
  const keptOwnSuitCount = Math.min(ownSuitCards.length, ownHoldback);
  const stillNeeded = ownHoldback - keptOwnSuitCount;
  const giveaway = shuffled([...ownSuitCards.slice(keptOwnSuitCount), ...otherCards.slice(stillNeeded)]);

  const assignments: { toPlayer: ReturnType<typeof toNetPlayerId>; cards: CardId[] }[] = [];
  let idx = 0;
  for (const [playerId, count] of contribution) {
    assignments.push({ toPlayer: toNetPlayerId(playerId), cards: giveaway.slice(idx, idx + count) });
    idx += count;
  }
  return { action: 'redistribute', assignments };
}

export function chooseBotAction(state: GameState, slot: PlayerId): ClientAction {
  switch (state.phase) {
    case 'turn':
      return choosePlayCardAction(state, slot);
    case 'chooseDelegate':
      return chooseDelegateAction(slot);
    case 'redistribution':
      return chooseRedistributeAction(state);
    default:
      throw new Error(`bot: no action defined for phase ${state.phase}`);
  }
}
