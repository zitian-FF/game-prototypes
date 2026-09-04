import { cardById } from '../rules/cards';
import { activePlayerId, currentRequiredSuit } from '../rules/engine';
import type { CardId, GameState, God, PlayerId } from '../rules/types';
import { ALL_NET_PLAYER_IDS, toNetPlayerId } from '../net/netPlayerId';
import type { NetPlayerId } from '../net/netPlayerId';
import type { MaskedState, MaskedTrickPlay, RedistributionLogEntry, TurnPhase } from '../net/actions';

// Every trick where `forSlot` was the actual redistributor (winner of a
// Single, or delegate after a Double) - grouped by trick, then by
// recipient, since one redistribute action can gift multiple players
// within the same trick and the GDD wants one log entry per trick, not
// one per recipient. Self-gifts are excluded (per the GDD, a
// distributor's entry never repeats cards assigned back to themself) -
// `state.receivedLog` is keyed by *recipient* PlayerId, so a self-gift
// would show up under `state.receivedLog[forSlot]`, which this function
// deliberately skips.
function buildDistributedEntries(state: GameState, forSlot: PlayerId): RedistributionLogEntry[] {
  // `wonByDouble` is carried alongside the per-recipient map since it's a
  // property of the trick itself, not of any individual gift - every
  // record for a given trickNumber shares the same value (see
  // rules/engine.ts's resolveRedistribution, which stamps it from that
  // trick's own state.lastTrickResult onto every gift's record).
  const byTrick = new Map<number, { wonByDouble: boolean; byRecipient: Map<PlayerId, CardId[]> }>();

  for (const [toPlayerIdKey, records] of Object.entries(state.receivedLog)) {
    const toPlayerId = Number(toPlayerIdKey) as PlayerId;
    if (toPlayerId === forSlot) continue;

    for (const record of records ?? []) {
      if (record.fromPlayerId !== forSlot) continue;
      let trick = byTrick.get(record.trickNumber);
      if (!trick) {
        trick = { wonByDouble: record.wonByDouble, byRecipient: new Map() };
        byTrick.set(record.trickNumber, trick);
      }
      const existing = trick.byRecipient.get(toPlayerId) ?? [];
      trick.byRecipient.set(toPlayerId, [...existing, ...record.cardIds]);
    }
  }

  return [...byTrick.entries()].map(([trickNumber, trick]) => ({
    trickNumber,
    perspective: 'distributed',
    fromPlayer: toNetPlayerId(forSlot),
    wonByDouble: trick.wonByDouble,
    groups: [...trick.byRecipient.entries()].map(([toPlayerId, cards]) => ({
      toPlayer: toNetPlayerId(toPlayerId),
      cards,
    })),
  }));
}

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
// to carry and why. `seatNames` is built by the caller (see
// HostGameScene.sendMaskedStateTo) from its own Roster, kept decoupled
// from the Roster type here same as every other field.
export function buildMaskedState(
  state: GameState,
  forSlot: PlayerId,
  seatNames: Partial<Record<NetPlayerId, string>>,
): MaskedState {
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
    deityCardState: play.deityCardState,
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
        deityCardState: play.deityCardState,
      }))
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
  const receivedEntries: RedistributionLogEntry[] = receivedByMe.map((record) => ({
    trickNumber: record.trickNumber,
    perspective: 'received',
    fromPlayer: toNetPlayerId(record.fromPlayerId),
    groups: [{ toPlayer: yourSlotNet, cards: record.cardIds }],
    wonByDouble: record.wonByDouble,
  }));
  const distributedEntries = buildDistributedEntries(state, forSlot);
  // Exactly one entry per trick per viewer - never both perspectives for
  // the same trick (see this function's own doc comment and
  // buildDistributedEntries's) - so a plain concat+sort is enough, no
  // dedupe/merge needed.
  const redistributionLog = [...receivedEntries, ...distributedEntries].sort((a, b) => a.trickNumber - b.trickNumber);

  return {
    yourSlot: yourSlotNet,
    yourHand: state.players[forSlot].hand,
    seatNames,
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
    redistributionLog,
    winner: state.winner ? { team: state.winner.team, reason: state.winner.reason, detail: state.winner.detail } : null,
  };
}
