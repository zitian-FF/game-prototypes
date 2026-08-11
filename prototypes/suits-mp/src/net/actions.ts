import type { Room } from 'trystero/nostr';
import type { CardId, God, PlayKind, Team, WinInfo } from '../rules/types';
import type { NetPlayerId } from './netPlayerId';

// --- Host -> peer lobby/session signals ------------------------------------

export type HostUIMessage =
  | { type: 'lobbyJoined' }
  | { type: 'gameStarted' }
  | { type: 'alreadyInProgress' }
  | { type: 'roomFull' };

// --- Client -> host game actions -------------------------------------------
// Three action types, sent on player confirm at the end of each turn. (A
// follow-up task removed the trick-40+ role-guess feature this prototype
// briefly had, and with it the fourth `declareRoleGuess` action - trick 40
// is now an automatic host-computed forced end, not a player-submitted
// action. See rules/engine.ts's resolveTrick40ForcedEnd.)

export type PlayType = 'single' | 'double' | 'facedownSingle';

export const PLAY_TYPE_TO_KIND: Record<PlayType, PlayKind> = {
  single: 'normal',
  double: 'double',
  facedownSingle: 'offsuit',
};

export type ClientAction =
  | { action: 'playCard'; playType: PlayType; cards: CardId[] }
  | { action: 'selectDelegate'; targetPlayer: NetPlayerId }
  | { action: 'redistribute'; assignments: { toPlayer: NetPlayerId; cards: CardId[] }[] };

// --- Host -> peer masked game state -----------------------------------------
// Always sent via a targeted per-peer send (see net/room.ts callers) -
// never as a shared broadcast. See host/mask.ts for how this is built.

// Note: these are all `type` aliases, not `interface`s. Trystero's
// `makeAction<T>` constrains T to a plain JSON-shaped value (an object
// type gets an implicit index signature only as a type alias; a named
// `interface` never does, and fails that constraint even though the
// runtime shape is identical). `winner` mirrors the ported engine's own
// `WinInfo` shape as a plain type alias for the same reason, rather than
// embedding that (locked, interface-declared) type directly - see
// host/mask.ts for where a real `WinInfo` gets copied into this shape.

export type MaskedTrickPlay = {
  player: NetPlayerId;
  cards: CardId[];
  kind: PlayKind;
};

export type RedistributionContribution = {
  player: NetPlayerId;
  count: number;
};

// Only populated in the masked payload sent to the acting distributor
// (winner or delegate). `candidateCards` is the winner's full current hand
// at redistribution time - per the GDD, the trick winner adds all trick
// cards to their hand first, then redistributes from that whole hand, not
// just the cards from the trick just won. Applies identically whether the
// distributor is the winner themself or a delegate acting on their behalf
// (a delegate does see the winner's hand contents here - see BRIEF.md for
// that trade-off). See host/mask.ts for where this is built.
export type RedistributionContext = {
  candidateCards: CardId[];
  contributions: RedistributionContribution[];
};

export type RedistributionLogEntry = {
  trickNumber: number;
  toPlayer: NetPlayerId;
  fromPlayer: NetPlayerId;
  count: number;
};

export type TurnPhase = 'play' | 'selectDelegate' | 'redistribute' | 'gameOver';

export type NetWinInfo = {
  team: Team | null;
  reason: WinInfo['reason'];
  detail: string;
};

export type MaskedState = {
  yourSlot: NetPlayerId;
  yourHand: CardId[];
  // Populated only once the game is over (suit-completion/role-guess wins
  // are always simultaneously game-ending, so there is no mid-game moment
  // where a completed suit reveals an identity without also ending the
  // game).
  revealedGods: Partial<Record<NetPlayerId, God>>;
  currentTrick: MaskedTrickPlay[];
  currentTurn: NetPlayerId | null;
  turnPhase: TurnPhase;
  trickNumber: number;
  leadSuit: God | null;
  requiredSuit: God | null;
  redistribution: RedistributionContext | null;
  delegateChoices: NetPlayerId[] | null;
  redistributionLog: RedistributionLogEntry[];
  winner: NetWinInfo | null;
};

export function createNetworkActions(room: Room) {
  return {
    // Player -> host handshake: persistent client ID, sent on (re)join.
    identity: room.makeAction<string>('identity'),
    // Host -> peer(s) lobby/session UI pushes, optionally targeted.
    hostUI: room.makeAction<HostUIMessage>('hostUI'),
    // Player -> host game actions (playCard/selectDelegate/redistribute/
    // declareRoleGuess), sent on confirm.
    gameAction: room.makeAction<ClientAction>('gameAction'),
    // Host -> peer masked game state. Every send of this action must pass a
    // `{ target: peerId }` - see host/mask.ts and HostGameScene.
    state: room.makeAction<MaskedState>('state'),
  };
}

export type NetworkActions = ReturnType<typeof createNetworkActions>;
