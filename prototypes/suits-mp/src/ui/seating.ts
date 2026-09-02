import { cardById, suitAfterSteps } from '../rules/cards';
import { fromNetPlayerId, ALL_NET_PLAYER_IDS } from '../net/netPlayerId';
import type { NetPlayerId } from '../net/netPlayerId';
import type { CardId, God } from '../rules/types';
import type { MaskedState } from '../net/actions';

// Pure seat-geometry logic, deliberately kept free of any Phaser/DOM
// dependency (matching ui/handLegality.ts's pattern) so it can be
// unit-tested directly.
//
// Seats are fixed for the whole game and drawn egocentrically: the local
// player is always at the bottom, and the other three seats are placed
// around them by their distance in turn order - not by their absolute
// NetPlayerId. Turn order is already clockwise (rules/engine.ts's
// turnOrder increments PlayerId by 1 mod 4 each step), and physically
// walking the seats clockwise from "you" (bottom) goes bottom -> left ->
// top -> right -> bottom, which is the same cyclic sequence as the
// brief's own "top -> right -> bottom -> left -> top" ring order, just
// read starting from a different point. So:
//   offset 0 (you)                  -> bottom
//   offset 1 (next to act after you) -> left
//   offset 2 (opposite you)          -> top
//   offset 3 (acted right before you)-> right
// P1-P4 (viewer-relative screen position: P3 is always "you"/bottom, P4
// the next to act after you/left, P1 opposite you/top, P2 the one who
// acted right before you/right) was this geometry's original player-
// facing label, but is an internal/geometry concept only now - every
// player-facing identity site uses the absolute, viewer-independent
// "Player N" numbering instead (see ui/renderGameView.ts's playerLabelFor
// and net/actions.ts's MaskedState.seatNames doc comment). Do not
// reintroduce P1-P4 as visible text.
export type SeatPosition = 'top' | 'right' | 'bottom' | 'left';

const SEAT_BY_OFFSET: readonly SeatPosition[] = ['bottom', 'left', 'top', 'right'];

export function seatFor(otherSlot: NetPlayerId, yourSlot: NetPlayerId): SeatPosition {
  const offset = (fromNetPlayerId(otherSlot) - fromNetPlayerId(yourSlot) + 4) % 4;
  return SEAT_BY_OFFSET[offset];
}

// Every seat, keyed by the NetPlayerId currently occupying it - built once
// per render and reused for every seat-position lookup (play-area
// contents, turn/starter markers, delegate targets).
export function buildSeatMap(yourSlot: NetPlayerId): Record<SeatPosition, NetPlayerId> {
  const map = {} as Record<SeatPosition, NetPlayerId>;
  for (const id of ALL_NET_PLAYER_IDS) map[seatFor(id, yourSlot)] = id;
  return map;
}

export interface SuitRingNode {
  seat: SeatPosition;
  player: NetPlayerId;
  suit: God | null;
  isLeader: boolean;
  // True only for the leader's own local pre-commit preview (see
  // computeSuitRing's `previewCardId` param) - never sent over the
  // network, so only ever true on the leader's own screen, and only
  // until they actually commit the play.
  isLocalPreview: boolean;
}

// Determines the current trick's leader and lead god from data already in
// `state` - no new masked-state field needed:
//  - mid-trick (currentTrick has plays): the leader is whoever made the
//    first play, and the lead god is state.leadSuit (already computed by
//    host/mask.ts from that same first play).
//  - about to lead (turnPhase 'play', trick empty): we know *who* will
//    lead (state.currentTurn) but not yet the lead suit - the ring for
//    every seat but the leader's own stays undetermined until they
//    commit, per the accepted fallback for the brief's live-preview note.
//    EXCEPTION: on the leader's own screen, `previewCardId` (their
//    in-progress fan selection, always local-only state - see
//    ui/renderGameView.ts's ViewState) lets that one screen preview the
//    lead god immediately, since it needs no network round trip - they
//    already know their own selection.
//  - between tricks (selectDelegate/redistribute/gameOver): no trick is
//    in progress; every node comes back with a null suit.
export function computeSuitRing(state: MaskedState, previewCardId: CardId | null): SuitRingNode[] {
  let leaderNet: NetPlayerId | null = null;
  let leadGod: God | null = null;
  let isLocalPreview = false;

  if (state.currentTrick.length > 0) {
    leaderNet = state.currentTrick[0].player;
    leadGod = state.leadSuit;
  } else if (state.turnPhase === 'play' && state.currentTurn) {
    leaderNet = state.currentTurn;
    if (leaderNet === state.yourSlot && previewCardId) {
      leadGod = cardById(previewCardId).god;
      isLocalPreview = true;
    }
  }

  const leaderSlot = leaderNet ? fromNetPlayerId(leaderNet) : null;

  return ALL_NET_PLAYER_IDS.map((id) => {
    const seat = seatFor(id, state.yourSlot);
    const isLeader = leaderNet !== null && id === leaderNet;
    let suit: God | null = null;
    if (leaderSlot !== null && leadGod) {
      const offsetFromLeader = (fromNetPlayerId(id) - leaderSlot + 4) % 4;
      suit = suitAfterSteps(leadGod, offsetFromLeader);
    }
    return { seat, player: id, suit, isLeader, isLocalPreview: isLeader && isLocalPreview };
  });
}
