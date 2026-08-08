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
// Exactly four action types. playCard/selectDelegate/redistribute are the
// three specified by the brief, sent on player confirm at the end of each
// turn. declareRoleGuess is a deliberate addition beyond that "exactly
// three": the brief also locks in the trick-40+ Role Revelation win
// condition and a role-guess UI prompt as in-scope for this stage, and
// there is no way to submit a guess to the host without a network action
// for it. It carries the full guess in one shot (declare + submit as a
// single confirm) rather than round-tripping a separate "declare intent"
// message first.

export type PlayType = 'single' | 'double' | 'facedownSingle';

export const PLAY_TYPE_TO_KIND: Record<PlayType, PlayKind> = {
  single: 'normal',
  double: 'double',
  facedownSingle: 'offsuit',
};

export type ClientAction =
  | { action: 'playCard'; playType: PlayType; cards: CardId[] }
  | { action: 'selectDelegate'; targetPlayer: NetPlayerId }
  | { action: 'redistribute'; assignments: { toPlayer: NetPlayerId; cards: CardId[] }[] }
  | { action: 'declareRoleGuess'; guesses: Record<NetPlayerId, God> };

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
// (winner or delegate). `candidateCards` are the trick's own cards - all of
// them publicly known already from having been played face-up this trick -
// which the distributor picks gifts from. This is a deliberate, tighter
// restriction than the ported engine itself allows (the engine lets a
// self-redistributing winner hand back *any* card from their hand, not just
// this trick's cards) so that a delegate never needs to see the winner's
// unrelated hand contents to make their assignment. See BRIEF.md.
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

export type TurnPhase = 'play' | 'selectDelegate' | 'redistribute' | 'roleGuess' | 'gameOver';

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
  roleGuessEligible: boolean;
  guessUsed: boolean;
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
