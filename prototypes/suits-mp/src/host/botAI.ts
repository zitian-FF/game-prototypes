import { cardById } from '../rules/cards';
import { currentRequiredSuit, forcedTrick1Opener, legalOptions } from '../rules/engine';
import type { CardId, GameState, PlayerId } from '../rules/types';
import { ALL_NET_PLAYER_IDS, toNetPlayerId } from '../net/netPlayerId';
import type { ClientAction, PlayType } from '../net/actions';

// Legal-random AI, with one deliberate exception: redistribution is now
// Tier A - self-interested suit-optimizing (see suits-mp-bot-ai-design.md,
// Google Drive/Working/, for the full staged design this implements the
// first tier of). choosePlayCardAction and chooseDelegateAction remain
// uniform-random; only chooseRedistributeAction has any intentionality. A
// bot never reads or mutates state directly; it only ever produces a
// ClientAction, which the host applies through the exact same
// gameHost.applyAction path as a real peer's action (see
// HostGameScene.driveBotsIfNeeded) - there is no separate bot rules path,
// so this is a genuine exercise of the same validation every human action
// goes through.

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

// Uniformly at random over the full set of currently-legal moves: if a
// required suit is held, each suit card is one option; otherwise each
// individual off-suit card is one option and each rank with a matching
// pair in hand is one additional (double) option.
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
    return { action: 'playCard', playType: 'single', cards: [forcedOpener ?? pickRandom(hand)] };
  }
  if (opts.mustPlaySuit) {
    return { action: 'playCard', playType: 'single', cards: [pickRandom(opts.suitCards)] };
  }

  const moves: { playType: PlayType; cards: CardId[] }[] = hand.map((id) => ({
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
