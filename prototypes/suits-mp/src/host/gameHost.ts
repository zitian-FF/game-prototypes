import {
  advanceBlocker,
  chooseDelegate,
  currentPlayerId,
  initGame,
  playCard,
  proceedFromTrickResult,
  redistribute,
} from '../rules/engine';
import type { GameState, PlayerId, RedistributionGift } from '../rules/types';
import { fromNetPlayerId } from '../net/netPlayerId';
import type { ClientAction } from '../net/actions';

const SEAT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'] as const;

export function createInitialState(): GameState {
  return settleAutoPhases(initGame([...SEAT_NAMES]));
}

// The ported engine models the hotseat "pass to this player, tap when
// ready" screen as an explicit 'blocker' phase, and a public trick result
// beat as 'trickResult' - both are pass-a-single-device moments with no
// suits-mp equivalent (every seat has its own device/screen already, and
// masking already keeps everything else hidden appropriately). This
// resolves through both automatically, without ever exposing them over the
// network, until the state lands on a phase that actually needs a player
// decision (or ends the game).
export function settleAutoPhases(state: GameState): GameState {
  let s = state;
  while (s.phase === 'blocker' || s.phase === 'trickResult') {
    s = s.phase === 'blocker' ? advanceBlocker(s) : proceedFromTrickResult(s);
  }
  return s;
}

export interface ApplyResult {
  readonly state: GameState;
  readonly ok: boolean;
  readonly error?: string;
}

// Applies one submitted action from `fromSlot`, authoritatively. Every
// legality check the ported rules engine already performs (whose turn it
// is, what phase the game is in, follow-suit/double legality,
// redistribution count-matching, the double-winner never selecting
// themselves as delegate, etc.) runs unchanged inside the engine calls
// below - this function's own job is just routing the three wire action
// shapes to the right engine call and catching illegal attempts instead of
// letting them throw past the caller. A rejected action leaves `state`
// untouched; there is no nack message back to the sender (not one of the
// three action types), so a client that sends something illegal simply
// sees no state change. Used identically for real peer actions and for
// host-local bot actions (see host/botAI.ts) - both go through this same
// function, never a separate bot-specific path.
export function applyAction(state: GameState, fromSlot: PlayerId, action: ClientAction): ApplyResult {
  try {
    let next: GameState;
    switch (action.action) {
      case 'playCard': {
        if (state.phase !== 'turn' || fromSlot !== currentPlayerId(state)) {
          return { state, ok: false, error: 'not this player\'s turn to play' };
        }
        // action.playType is informational only - the engine derives the
        // actual play kind from the cards themselves and the current
        // required suit, which is the authoritative check.
        next = playCard(state, fromSlot, action.cards);
        break;
      }
      case 'selectDelegate': {
        if (state.phase !== 'chooseDelegate' || fromSlot !== state.pendingWinnerId) {
          return { state, ok: false, error: 'not this player\'s delegate to choose' };
        }
        // chooseDelegate() itself rejects targetPlayer === the winner
        // (mandatory delegation, no self-selection) - see rules/engine.ts.
        next = chooseDelegate(state, fromNetPlayerId(action.targetPlayer));
        break;
      }
      case 'redistribute': {
        if (state.phase !== 'redistribution' || fromSlot !== state.pendingDistributorId) {
          return { state, ok: false, error: 'not this player\'s redistribution to make' };
        }
        const gifts: RedistributionGift[] = action.assignments.map((a) => ({
          toPlayerId: fromNetPlayerId(a.toPlayer),
          cardIds: a.cards,
        }));
        next = redistribute(state, gifts);
        break;
      }
    }
    return { state: settleAutoPhases(next), ok: true };
  } catch (err) {
    return { state, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
