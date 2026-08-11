import { cardById } from '../rules/cards';
import { activePlayerId, currentRequiredSuit } from '../rules/engine';
import type { GameState, God, PlayerId } from '../rules/types';
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

  const currentTrick: MaskedTrickPlay[] = state.plays.map((play) => ({
    player: toNetPlayerId(play.playerId),
    cards: play.cardIds,
    kind: play.kind,
  }));

  // `state.lastTrickResult` is overwritten only when a trick actually
  // resolves (see rules/engine.ts's playCard), so it already holds exactly
  // "the trick before this one" for the log's whole lifetime - null before
  // trick 1's resolution, then replaced wholesale each time a new trick
  // completes, including across the redistribution phase that follows.
  const previousTrick: MaskedTrickPlay[] | null = state.lastTrickResult
    ? state.lastTrickResult.plays.map((play) => ({
        player: toNetPlayerId(play.playerId),
        cards: play.cardIds,
        kind: play.kind,
      }))
    : null;

  const active = activePlayerId(state);
  const leadSuit = state.plays.length > 0 ? cardById(state.plays[0].cardIds[0]).god : null;

  let redistribution: MaskedState['redistribution'] = null;
  if (state.phase === 'redistribution' && state.pendingDistributorId === forSlot && state.lastTrickResult) {
    const winnerId = state.pendingWinnerId;
    const contributionMap = new Map<PlayerId, number>();
    for (const play of state.lastTrickResult.plays) {
      if (play.playerId !== winnerId) {
        contributionMap.set(play.playerId, (contributionMap.get(play.playerId) ?? 0) + play.cardIds.length);
      }
    }
    redistribution = {
      // Per the GDD: the trick winner adds all trick cards to their hand
      // FIRST, then redistributes one facedown card per contributing
      // player - so the candidate pool is the redistributor's full current
      // hand at this point (already inclusive of the just-won trick cards;
      // playCard() merges them in immediately on trick resolution, before
      // this phase is ever reached), not just the cards from that trick.
      // This applies identically whether the winner is redistributing
      // themself or a delegate is doing it on their behalf - see
      // net/actions.ts's RedistributionContext doc comment.
      candidateCards: state.players[winnerId!].hand,
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
