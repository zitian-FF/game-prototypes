import { cardById } from '../rules/cards';
import { activePlayerId, currentRequiredSuit } from '../rules/engine';
import type { GameState, God, PlayerId, TrickPlay } from '../rules/types';
import { ALL_NET_PLAYER_IDS, toNetPlayerId } from '../net/netPlayerId';
import type { NetPlayerId } from '../net/netPlayerId';
import type { MaskedState, MaskedTrickPlay, TurnPhase } from '../net/actions';

function turnPhaseFor(state: GameState): TurnPhase {
  switch (state.phase) {
    case 'turn':
      return 'play';
    case 'chooseDelegate':
      return 'selectDelegate';
    case 'redistribution':
      return 'redistribute';
    case 'gameOver':
      return 'gameOver';
    // 'blocker' and 'trickResult' are hotseat-only pass-device moments with
    // no suits-mp equivalent (every player has their own device/screen) -
    // gameHost.settleAutoPhases() always resolves through them before a
    // masked state is ever built, so this is unreachable in practice. Falls
    // back to 'play' rather than throwing, since a masked payload must
    // always be constructible.
    default:
      return 'play';
  }
}

// Masks a single trick-history entry for the peer receiving `forSlot`'s
// payload: a facedown off-suit single (`kind === 'offsuit'`) has its real
// card id(s) stripped to an empty array for everyone except the player who
// made the play - they already know their own card, so it's shown back to
// them plainly. This is the actual source-of-truth mask; UI-layer code
// (`maskedPlayText()`/`maskedPlayFaces()` in ui/renderGameView.ts) must
// never be relied on as the only place this is enforced, since the raw
// payload is directly inspectable via devtools/network traffic. Applies
// identically to `currentTrick` (live) and `previousTrick` (resolved trick
// log) - once masked, an entry must stay masked for as long as it exists in
// either field, so this same helper is used for both.
function maskTrickPlay(play: TrickPlay, forSlot: PlayerId): MaskedTrickPlay {
  const isSecretFacedown = play.kind === 'offsuit' && play.playerId !== forSlot;
  return {
    player: toNetPlayerId(play.playerId),
    cards: isSecretFacedown ? [] : play.cardIds,
    kind: play.kind,
  };
}

// Builds the one masked view of `state` visible to `forSlot`. Never
// includes another player's hand or an unrevealed identity - see
// net/actions.ts's MaskedState doc comments for what each field is allowed
// to carry and why.
export function buildMaskedState(state: GameState, forSlot: PlayerId): MaskedState {
  const yourSlotNet = toNetPlayerId(forSlot);
  const gameOver = state.phase === 'gameOver';

  const revealedGods: Partial<Record<NetPlayerId, God>> = {};
  if (gameOver) {
    for (const player of state.players) {
      revealedGods[toNetPlayerId(player.id)] = player.god;
    }
  }

  const currentTrick: MaskedTrickPlay[] = state.plays.map((play) => maskTrickPlay(play, forSlot));

  // `state.lastTrickResult` is overwritten only when a trick actually
  // resolves (see rules/engine.ts's playCard), so it already holds exactly
  // "the trick before this one" for the log's whole lifetime - null before
  // trick 1's resolution, then replaced wholesale each time a new trick
  // completes, including across the redistribution phase that follows.
  const previousTrick: MaskedTrickPlay[] | null = state.lastTrickResult
    ? state.lastTrickResult.plays.map((play) => maskTrickPlay(play, forSlot))
    : null;

  const active = activePlayerId(state);
  const leadSuit = state.plays.length > 0 ? cardById(state.plays[0].cardIds[0]).god : null;

  let redistribution: MaskedState['redistribution'] = null;
  if (state.phase === 'redistribution' && state.pendingDistributorId === forSlot && state.lastTrickResult) {
    // `forSlot` is guaranteed to be the distributor by the guard above -
    // on a self-redistributed win that's the winner (playCard() already
    // collected the trick's cards into their hand); on a delegated
    // (double) win it's the delegate, who now holds those cards instead
    // (see rules/engine.ts's chooseDelegate) - so `candidateCards` is
    // always the acting distributor's own full hand, never the winner's.
    // A delegate no longer needs any visibility into the winner's hand at
    // all - see net/actions.ts's RedistributionContext doc comment.
    const distributorId = forSlot;
    const contributionMap = new Map<PlayerId, number>();
    for (const play of state.lastTrickResult.plays) {
      if (play.playerId !== distributorId) {
        contributionMap.set(play.playerId, (contributionMap.get(play.playerId) ?? 0) + play.cardIds.length);
      }
    }
    redistribution = {
      candidateCards: state.players[distributorId].hand,
      contributions: [...contributionMap.entries()].map(([playerId, count]) => ({
        player: toNetPlayerId(playerId),
        count,
      })),
    };
  }

  let delegateChoices: MaskedState['delegateChoices'] = null;
  if (state.phase === 'chooseDelegate' && state.pendingWinnerId === forSlot) {
    delegateChoices = ALL_NET_PLAYER_IDS.filter((id) => id !== yourSlotNet);
  }

  const receivedByMe = state.receivedLog[forSlot] ?? [];

  return {
    yourSlot: yourSlotNet,
    yourHand: state.players[forSlot].hand,
    yourGod: state.players[forSlot].god,
    revealedGods,
    currentTrick,
    previousTrick,
    currentTurn: active === null ? null : toNetPlayerId(active),
    turnPhase: turnPhaseFor(state),
    trickNumber: state.trickNumber,
    leadSuit,
    requiredSuit: currentRequiredSuit(state),
    redistribution,
    delegateChoices,
    redistributionLog: receivedByMe.map((record) => ({
      trickNumber: record.trickNumber,
      toPlayer: yourSlotNet,
      fromPlayer: toNetPlayerId(record.fromPlayerId),
      count: record.cardIds.length,
    })),
    winner: state.winner ? { team: state.winner.team, reason: state.winner.reason, detail: state.winner.detail } : null,
  };
}
