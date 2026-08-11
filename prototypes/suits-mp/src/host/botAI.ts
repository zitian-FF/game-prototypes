import { cardById } from '../rules/cards';
import { currentRequiredSuit, forcedTrick1Opener, legalOptions } from '../rules/engine';
import type { CardId, GameState, PlayerId } from '../rules/types';
import { ALL_NET_PLAYER_IDS, toNetPlayerId } from '../net/netPlayerId';
import type { ClientAction, PlayType } from '../net/actions';

// Level 1 - legal-random AI, the only level this task implements (Level
// 2/3 suit/team-aware sophistication is explicitly deferred). A bot never
// reads or mutates state directly; it only ever produces a ClientAction,
// which the host applies through the exact same gameHost.applyAction path
// as a real peer's action (see HostGameScene.driveBotsIfNeeded) - there is
// no separate bot rules path, so this is a genuine exercise of the same
// validation every human action goes through.

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

// Splits the required count for each contributing recipient randomly among
// the cards in the winner's hand (not just this trick's cards - unlike the
// masked payload shown to a human distributor, a bot has full host-local
// access to the canonical state, so it's free to use the engine's actual,
// more permissive pool). Same logic whether the distributor is the winner
// themself or a delegate - the cards always come from the winner's hand.
function chooseRedistributeAction(state: GameState): ClientAction {
  const winnerId = state.pendingWinnerId;
  const trickResult = state.lastTrickResult;
  if (winnerId === null || !trickResult) throw new Error('bot: no trick result to redistribute from');

  const contribution = new Map<PlayerId, number>();
  for (const play of trickResult.plays) {
    if (play.playerId !== winnerId) {
      contribution.set(play.playerId, (contribution.get(play.playerId) ?? 0) + play.cardIds.length);
    }
  }

  const pool = shuffled(state.players[winnerId].hand);
  const assignments: { toPlayer: ReturnType<typeof toNetPlayerId>; cards: CardId[] }[] = [];
  let idx = 0;
  for (const [playerId, count] of contribution) {
    assignments.push({ toPlayer: toNetPlayerId(playerId), cards: pool.slice(idx, idx + count) });
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
