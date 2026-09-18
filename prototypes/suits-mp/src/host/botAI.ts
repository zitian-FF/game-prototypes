import { cardById } from '../rules/cards';
import { computeDeityCardState, currentRequiredSuit, forcedTrick1Opener, legalOptions, resolveTrick } from '../rules/engine';
import type { CardId, GameState, God, PlayerId, TrickPlay } from '../rules/types';
import { ALL_NET_PLAYER_IDS, toNetPlayerId } from '../net/netPlayerId';
import type { ClientAction, PlayType } from '../net/actions';
import { determineRole } from './botRole';
import { identifyFriendlyAlly } from './botTrust';

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

// A 9, 10, or Deity Card - design doc Section 5.1's exception: even a now-
// dead-weight own-suit card at one of these ranks is kept for trick control
// (Section 5.2) rather than given away, since its RANK still wins tricks
// regardless of suit.
function isHighRank(id: CardId): boolean {
  const rank = cardById(id).rank;
  return rank === 9 || rank === 10 || rank === 'DeityCard';
}

// Fills `count` cards for one recipient out of `pool` (mutated: consumed
// cards are removed), preferring cards matching `preferredGod` when given,
// falling back to whatever's next in `pool` once the preferred supply runs
// out. `pool` is assumed already shuffled, so "next in pool" is itself a
// random pick within whatever's left.
function takeCards(pool: CardId[], count: number, preferredGod: God | null): CardId[] {
  const taken: CardId[] = [];
  if (preferredGod !== null) {
    for (let i = 0; i < pool.length && taken.length < count; ) {
      if (cardById(pool[i]).god === preferredGod) {
        taken.push(pool.splice(i, 1)[0]);
      } else {
        i++;
      }
    }
  }
  while (taken.length < count) {
    const next = pool.shift();
    if (next === undefined) break;
    taken.push(next);
  }
  return taken;
}

// Tier A (suits-mp-bot-ai-design.md v6, Section 2) self-interested holdback,
// now with the Section 5 Completer/Assist role layered on top, plus a
// win-lock override that takes priority over both:
//
// - WIN-LOCK (the distributor's pool already contains all 10 unique cards
//   of their own suit, so holding all of them back completes their suit
//   and locks the win for their team THIS redistribution - see isWinLock
//   below): regardless of role, a confirmed ally gets no priority and no
//   preferential cards - the team has already won this event, so nothing
//   routed to the ally has any value ("ally receiving anything is
//   wasted"). Bug fix: every one of a real 2000-game batch's stalemates
//   traced to exactly this moment with the OLD unchanged Tier A logic
//   (below) firing - it makes no ally/opponent distinction at all, so an
//   identified ally sat in the same random pool as the two opponents with
//   equal odds, including in the ~18% of stalemates where an ally HAD
//   been identified.
// - COMPLETER (own hand mono, i.e. concentrated toward the bot's own
//   needed suit - host/botRole.ts's determineRole), OR no friendlyPlayer
//   identified yet (host/botTrust.ts's identifyFriendlyAlly), OR win-lock
//   with no ally identified (nothing to route away from): unchanged
//   Tier A baseline exactly as before - hold back own-suit preferentially,
//   distribute the rest with no recipient distinction. This is the
//   required fallback per the task spec, not a simplification of Assist
//   logic - an Assist role with no confirmed ally has no legitimate target
//   to route cards toward yet (design doc 4.1's masking honesty still
//   applies: routing "toward a guess" isn't the same as routing toward a
//   confirmed ally).
// - ASSIST (own hand mixed AND a friendlyPlayer is identified, AND not
//   win-lock): own-suit cards are dead weight to the bot itself now
//   (design doc 5.1) - low-rank own-suit is never held back, and any
//   own-suit card that must be given away is routed to OPPONENTS, never
//   the identified ally (the ally can't use a card that isn't its own
//   needed suit - design doc 5.1's own explicit reasoning: "would waste
//   one of the ally's limited redistribution slots"). High-rank own-suit
//   (9/10/Deity Card) is the one exception - retained for trick control
//   (5.2) regardless of role. Cards matching the ally's own needed suit
//   (`friendlyPlayerDeity`, already known via botTrust.ts's TEAMMATE_GOD
//   lookup - never the bot's own suit, so this is always a disjoint pool
//   from the bot's own cards) are reserved for the ally's contribution
//   slot first, before any other recipient can draw from them.
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
// since `state.players[distributorId].god` (and now, role/ally/win-lock)
// are read from that same distributor slot, every decision here is
// correctly judged against the actual distributor, never the original
// trick winner.
//
// Masking honesty (design doc section 1.1): every value read here - the
// distributor's own hand, own Deity, own role, own identifyFriendlyAlly
// result, and the real per-recipient owed counts - is exactly what the
// acting distributor is already entitled to see and act on as themself;
// nothing here reaches into another player's hand or hidden identity.
// isWinLock in particular is detected purely from the distributor's own
// hand/god (host/botRole.ts's own-suit-count metric, reused), the same
// masking-safe self-knowledge every other check here already relies on.
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

  const ally = identifyFriendlyAlly(state, distributorId);
  const role = determineRole(state, distributorId);
  const ownSuitCount = pool.filter((id) => cardById(id).god === ownGod).length;
  const isWinLock = ownSuitCount === 10;

  let giveaway: CardId[];
  let friendlyPlayerId: PlayerId | null = null;
  let allyPreferredGod: God | null = null;
  let serveAllyLast = false;

  if (isWinLock && ally !== null) {
    // Win-lock override - see doc comment above. Every own-suit card is
    // necessarily held back (ownSuitCount === 10 means the own-suit
    // holdback alone already exactly fills - or exceeds - ownHoldback in
    // every branch below), so giveaway is exactly the non-own-suit cards
    // regardless of which branch would otherwise have built it. The ally
    // gets zero preference and is served last, from whatever's left after
    // the two real opponents have drawn - engine-mandated exact-count
    // delivery to every trick contributor (rules/engine.ts's
    // redistribute()) means the ally still receives its exact owed count
    // if it contributed to this trick, but with no say in which specific
    // cards those are.
    giveaway = shuffled(pool.filter((id) => cardById(id).god !== ownGod));
    friendlyPlayerId = ally.friendlyPlayer;
    serveAllyLast = true;
  } else if (ally === null || role === 'completer') {
    // Unchanged Tier A baseline - see doc comment above.
    const ownSuitCards = shuffled(pool.filter((id) => cardById(id).god === ownGod));
    const otherCards = shuffled(pool.filter((id) => cardById(id).god !== ownGod));
    const keptOwnSuitCount = Math.min(ownSuitCards.length, ownHoldback);
    const stillNeeded = ownHoldback - keptOwnSuitCount;
    giveaway = shuffled([...ownSuitCards.slice(keptOwnSuitCount), ...otherCards.slice(stillNeeded)]);
  } else {
    friendlyPlayerId = ally.friendlyPlayer;
    allyPreferredGod = ally.friendlyPlayerDeity;

    const ownHighRank = shuffled(pool.filter((id) => cardById(id).god === ownGod && isHighRank(id)));
    const ownLowRank = shuffled(pool.filter((id) => cardById(id).god === ownGod && !isHighRank(id)));
    const allySuit = shuffled(pool.filter((id) => cardById(id).god === allyPreferredGod));
    const genericOther = shuffled(pool.filter((id) => cardById(id).god !== ownGod && cardById(id).god !== allyPreferredGod));

    // Holdback priority: retain high-rank own-suit for trick control
    // first (5.1's exception), then generic filler, then - only if the
    // required holdback size genuinely can't be filled any other way -
    // ally-suit or low-rank own-suit, both of which an Assist should give
    // away whenever there's any alternative.
    const held = new Set<CardId>();
    for (const p of [ownHighRank, genericOther, allySuit, ownLowRank]) {
      for (const id of p) {
        if (held.size >= ownHoldback) break;
        held.add(id);
      }
      if (held.size >= ownHoldback) break;
    }
    giveaway = shuffled(pool.filter((id) => !held.has(id)));
  }

  // Non-win-lock: the identified ally (if among this trick's contributors
  // at all) draws first and preferentially from ally-suit cards in the
  // giveaway pool. Win-lock: the ally draws LAST and with no preference
  // (`allyPreferredGod` stays null in that branch) - everyone else draws
  // from whatever's left either way, in no particular order among
  // opponents themselves (design doc 5.1: "any card that isn't the
  // recipient's real needed suit is equally dead weight to them").
  const remaining = giveaway.slice();
  const assignments: { toPlayer: ReturnType<typeof toNetPlayerId>; cards: CardId[] }[] = [];

  const assignAlly = (): void => {
    if (friendlyPlayerId === null || !contribution.has(friendlyPlayerId)) return;
    const count = contribution.get(friendlyPlayerId)!;
    assignments.push({ toPlayer: toNetPlayerId(friendlyPlayerId), cards: takeCards(remaining, count, allyPreferredGod) });
  };
  const assignOthers = (): void => {
    for (const [playerId, count] of contribution) {
      if (playerId === friendlyPlayerId) continue;
      assignments.push({ toPlayer: toNetPlayerId(playerId), cards: takeCards(remaining, count, null) });
    }
  };

  if (serveAllyLast) {
    assignOthers();
    assignAlly();
  } else {
    assignAlly();
    assignOthers();
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
