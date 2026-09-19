import { cardById } from '../rules/cards';
import { computeDeityCardState, currentRequiredSuit, forcedTrick1Opener, legalOptions, requiredSuitForPosition, resolveTrick } from '../rules/engine';
import type { CardId, GameState, God, PlayerId, TrickPlay } from '../rules/types';
import { ALL_NET_PLAYER_IDS, toNetPlayerId } from '../net/netPlayerId';
import type { ClientAction, PlayType } from '../net/actions';
import { determineRole } from './botRole';
import { identifyFriendlyAlly } from './botTrust';
import type { FriendlyAlly } from './botTrust';
import { resolveMode } from './botPersonality';
import type { BotPersonalityState, PersonalityMode } from './botPersonality';

// Legal-random AI, layered with: Tier A self-interested redistribution,
// Section 3's card-play heuristic, Section 5's Completer/Assist role
// system (with 5.3's Suit-Cycle lead engineering for a confirmed ally),
// and Section 7's personality system (host/botPersonality.ts) modulating
// mechanic 1 (rank preference within Section 3's own candidate sets) and
// mechanic 2 (a small bias on botRole.ts's mono/mixed threshold).
// chooseDelegateAction remains uniform-random, per the design doc - never
// touched by any personality mechanic. A bot never reads or mutates
// canonical GameState directly; it only ever produces a ClientAction,
// which the host applies through the exact same gameHost.applyAction path
// as a real peer's action (see HostGameScene.driveBotsIfNeeded) - there is
// no separate bot rules path, so this is a genuine exercise of the same
// validation every human action goes through.
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

// Section 7 (personalities), mechanic 1: a card's rank for personality
// preference purposes - the fixed face value (2-10), with a Deity Card
// treated as the highest value (11), matching its top-of-cycle position
// in rules/cards.ts's own RANK_SORT_ORDER. Deliberately the RAW rank, not
// the dynamic Dormant/Powered-adjusted trick score (rules/engine.ts's
// scoreOf) - mechanic 1 is a simple, consistent "which specific card"
// preference layered on top of whatever candidate set Section 3 already
// narrowed a decision to, not a second opinion on whether that set's
// members would win.
function cardRankValue(id: CardId): number {
  const rank = cardById(id).rank;
  return rank === 'DeityCard' ? 11 : rank;
}

// Section 7, mechanic 1, general form: among `candidates`, aggressive
// picks whichever has the highest `rankOf` value, conservative the
// lowest, neutral (Balanced, or no personality context) leaves Section
// 3's own tie-break - uniform random - completely untouched. This only
// ever picks WITHIN a candidate set Section 3's own needed/not-needed
// filtering already produced; it never changes which candidates are
// eligible.
function pickByPersonality<T>(candidates: readonly T[], rankOf: (item: T) => number, mode: PersonalityMode): T {
  if (mode === 'aggressive') {
    const best = Math.max(...candidates.map(rankOf));
    return pickRandom(candidates.filter((c) => rankOf(c) === best));
  }
  if (mode === 'conservative') {
    const worst = Math.min(...candidates.map(rankOf));
    return pickRandom(candidates.filter((c) => rankOf(c) === worst));
  }
  return pickRandom(candidates);
}

function pickCardByPersonality(candidates: readonly CardId[], mode: PersonalityMode): CardId {
  return pickByPersonality(candidates, cardRankValue, mode);
}

// Design doc Section 5.3: a confirmed-ally Assist can solve, via the fixed
// Suit Cycle, which lead suit would force a specific OPPONENT (never the
// ally itself) to reveal/play the ally's needed suit - if the Assist then
// wins that trick, it collects that card and routes it to the ally per
// 5.1. Reuses engine.ts's own requiredSuitForPosition (position 0 = the
// leader itself, no required suit; positions 1-3 = each subsequent seat
// in Suit Cycle order from whatever suit is led) rather than
// reimplementing the cycle math - `turnOrder(slot)` (this bot IS the
// leader when choosing a lead card) means position p corresponds to seat
// (slot + p) % 4, so `allySeatOffset` below is exactly the position at
// which the ally themself sits.
//
// GATE (enforced by the only caller): role === 'assist' AND a STRICT
// identifyFriendlyAlly(state, slot) result - never a looser guess. A
// wrong ally guess here would actively misdirect this targeting toward
// the wrong seat, which is worse than doing nothing (Section 3's
// existing baseline already covers "nothing" safely).
//
// Only considers `notNeeded` cards (Section 3's own suit already
// excluded) - this LAYERS a further preference on top of that existing
// rule, it does not replace it. Returns null (caller falls back to
// Section 3's unchanged baseline) when no held not-needed card's suit
// satisfies both constraints:
//   - excluded: the position that would be forced to reveal the ally's
//     needed suit is the ally's OWN seat (position === allySeatOffset) -
//     this would force the ally itself to leak a card it needs, per the
//     design doc's own explicit warning.
//   - preferred: that position belongs to one of the two real opponents
//     instead - the actual extraction setup this section exists for.
function chooseSuitCycleLeadForAlly(
  slot: PlayerId,
  ally: FriendlyAlly,
  notNeeded: readonly CardId[]
): CardId | null {
  const allySeatOffset = (ally.friendlyPlayer - slot + 4) % 4;
  const candidates = notNeeded.filter((id) => {
    const candidateGod = cardById(id).god;
    for (let position = 1; position <= 3; position++) {
      if (requiredSuitForPosition(position, candidateGod) === ally.friendlyPlayerDeity) {
        // Suit Cycle math: for a fixed lead suit, exactly one position
        // (1-3) is ever required to play a given other suit - no need to
        // keep scanning once found.
        return position !== allySeatOffset;
      }
    }
    return false;
  });
  return candidates.length > 0 ? pickRandom(candidates) : null;
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

// Design doc Section 3's card-play extension to Tier A, plus Section
// 5.3's Suit-Cycle lead engineering layered on top of item 1 for a
// confirmed-ally Assist, plus Section 7's personality mechanic 1 layered
// on top of EVERY pickRandom-over-a-candidate-set call site Section 3
// itself owns (never 5.3's own chooseSuitCycleLeadForAlly, which stays
// untouched per this task's scope):
//   1. Leading: prefer a not-needed card - leading grants nothing directly,
//      so there's no reason to risk a needed one. All-needed hand (a real
//      possible edge case, e.g. a hand that's one suit after heavy
//      redistribution) falls back to any legal card, unchanged from the
//      old fully-random behaviour except for mechanic 1's rank
//      preference. Among not-needed candidates specifically, a
//      role==='assist' bot (role itself now personality-biased per
//      botRole.ts's mechanic 2) with a STRICT identifyFriendlyAlly result
//      first tries chooseSuitCycleLeadForAlly (Section 5.3) - if it finds
//      a lead suit that forces an OPPONENT to reveal the ally's needed
//      suit, that's preferred (personality-unmodified, per scope);
//      otherwise this falls through to the notNeeded baseline.
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
//      Double-vs-facedownSingle choice itself (whether the final pick
//      ends up choosing a Double attempt or a facedownSingle at all) stays
//      exactly as random as before mechanic 1 - only which cards become
//      facedownSingle candidates changes, never the Double-generation
//      branch below it; mechanic 1's rank preference is applied once, at
//      the final combined pick, using each move's own card rank (a
//      Double's two cards always share one rank).
//
// `mode` is this bot's already-resolved personality mode for the CURRENT
// decision (host/botPersonality.ts's resolveMode, called once by
// chooseBotAction) - 'neutral' (Balanced) leaves every pickRandom below
// exactly as it always was.
function choosePlayCardAction(state: GameState, slot: PlayerId, mode: PersonalityMode): ClientAction {
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
    if (notNeeded.length === 0) {
      return { action: 'playCard', playType: 'single', cards: [pickCardByPersonality(hand, mode)] };
    }
    if (determineRole(state, slot, mode) === 'assist') {
      const ally = identifyFriendlyAlly(state, slot);
      if (ally !== null) {
        const targetedLead = chooseSuitCycleLeadForAlly(slot, ally, notNeeded);
        if (targetedLead !== null) {
          return { action: 'playCard', playType: 'single', cards: [targetedLead] };
        }
      }
    }
    return { action: 'playCard', playType: 'single', cards: [pickCardByPersonality(notNeeded, mode)] };
  }
  if (opts.mustPlaySuit) {
    const requiredGod = opts.mustPlaySuit;
    const winningCards = opts.suitCards.filter((id) => wouldWinIfPlayedNow(state, slot, id, requiredGod));
    let chosen: CardId;
    if (winningCards.length > 0) {
      const winningNotNeeded = winningCards.filter((id) => !isNeeded(state, slot, id));
      chosen = winningNotNeeded.length > 0 ? pickCardByPersonality(winningNotNeeded, mode) : pickCardByPersonality(winningCards, mode);
    } else {
      const notNeeded = opts.suitCards.filter((id) => !isNeeded(state, slot, id));
      chosen = notNeeded.length > 0 ? pickCardByPersonality(notNeeded, mode) : pickCardByPersonality(opts.suitCards, mode);
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
  const move = pickByPersonality(moves, (m) => cardRankValue(m.cards[0]), mode);
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
//
// `mode` (Section 7 personalities) only ever reaches `determineRole`
// below (mechanic 2's role-threshold bias) - this function has no
// mechanic-1 rank-preference decisions of its own (redistribution isn't
// one of Section 3's "leading/following/off-suit" card-play decision
// points), and personality never touches this function's own
// self-interest/win-lock/ally-routing logic (Section 5.1/5.2/5.3, out of
// this task's scope).
function chooseRedistributeAction(state: GameState, mode: PersonalityMode): ClientAction {
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
  const role = determineRole(state, distributorId, mode);
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

// `personality` is this bot seat's persistent Section 7 assignment
// (host/botPersonality.ts), created once per game by whoever drives bots
// (HostGameScene.ts for real play, scripts/simulate.ts for self-play) and
// passed in here unchanged every call - the one piece of state in this
// whole bot AI that isn't re-derived fresh from GameState each time (see
// botPersonality.ts's own doc comment for why). `resolveMode` is called
// once per decision, keyed by `state.trickNumber` so Wildcard's roll
// stays consistent across every decision within one trick, including a
// later redistribution that trick's outcome triggers.
export function chooseBotAction(state: GameState, slot: PlayerId, personality: BotPersonalityState): ClientAction {
  const mode = resolveMode(personality, state.trickNumber);
  switch (state.phase) {
    case 'turn':
      return choosePlayCardAction(state, slot, mode);
    case 'chooseDelegate':
      return chooseDelegateAction(slot);
    case 'redistribution':
      return chooseRedistributeAction(state, mode);
    default:
      throw new Error(`bot: no action defined for phase ${state.phase}`);
  }
}
