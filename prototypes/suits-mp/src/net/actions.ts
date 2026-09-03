import type { Room } from 'trystero/nostr';
import { createIdentityActionWithName, createHostUIAction } from 'mp-core';
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
// briefly had, and with it the fourth `declareRoleGuess` action. The
// forced end that briefly replaced it at trick 40 has since been removed
// too, per GDD v2's "No Trick Limit" - trickNumber now just climbs
// indefinitely, with no forced-end action or automatic host-computed
// ending of any kind tied to a trick count.)

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
// (winner or delegate). `candidateCards` is the *distributor's own* full
// current hand at redistribution time - per the GDD, whoever ends up
// holding the trick's collected cards redistributes from their whole hand,
// not just the cards from the trick just won. On a self-redistributed win
// that's the winner (playCard() collects into their hand); on a delegated
// (double) win it's the delegate (chooseDelegate() collects into theirs
// instead - see rules/engine.ts). A delegate never sees the winner's hand
// here - they're redistributing their own. See host/mask.ts for where
// this is built.
export type RedistributionContext = {
  candidateCards: CardId[];
  contributions: RedistributionContribution[];
};

// One completed trick's redistribution, from the viewing player's own
// perspective (see host/mask.ts's buildMaskedState) - never both
// perspectives for the same trickNumber, since a player is either the
// trick's redistributor or a recipient of it, never both.
export type RedistributionLogGroup = {
  toPlayer: NetPlayerId;
  cards: CardId[];
};

export type RedistributionLogEntry = {
  trickNumber: number;
  perspective: 'received' | 'distributed';
  // The trick's actual redistributor (winner of a Single, or delegate
  // after a Double) - for a 'received' entry this is who you got cards
  // from; for a 'distributed' entry this is always yourSlot.
  fromPlayer: NetPlayerId;
  // 'received': exactly one group, toPlayer === yourSlot. 'distributed':
  // one group per recipient you actually gave cards to - self-gifts are
  // excluded, per the GDD.
  groups: RedistributionLogGroup[];
  // Whether this trick was won via a Double. Since self-delegation is
  // illegal, this alone tells a 'distributed' entry's viewer whether
  // they redistributed as the trick's winner (Single) or as a delegate
  // acting on the winner's behalf (Double) - see
  // ui/renderGameView.ts's renderRedistributionLogOverlay.
  wonByDouble: boolean;
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
  // Raw displayName values keyed by absolute NetPlayerId, exactly as
  // stored in the host's roster (net/types.ts) - may be an empty string
  // for a blank-named player. The seat-numbered "Player N" fallback is
  // computed at render time (see ui/renderGameView.ts's playerLabelFor),
  // mirroring the Lobby's own lobbySeats.ts pattern, not baked in here.
  seatNames: Partial<Record<NetPlayerId, string>>;
  // A player's own identity is never secret to themself - only to everyone
  // else, until suit completion (see `revealedGods` below). Powers a
  // persistent "You are: <god> - Team <team>" display so a player always
  // has a reminder of their own hidden role, not just at deal time.
  yourGod: God;
  // Populated only once the game is over (suit-completion/role-guess wins
  // are always simultaneously game-ending, so there is no mid-game moment
  // where a completed suit reveals an identity without also ending the
  // game).
  revealedGods: Partial<Record<NetPlayerId, God>>;
  currentTrick: MaskedTrickPlay[];
  // The trick immediately before `currentTrick` - null until the first
  // trick of the game has completed. Every card in it was already played
  // face-up, so showing it (with player attribution) reveals nothing a
  // player couldn't already have seen live; this just lets them review it
  // via the log toggle after the fact. Replaced wholesale, never
  // accumulated, each time a new trick resolves - see host/mask.ts.
  previousTrick: MaskedTrickPlay[] | null;
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
    // Player -> host handshake: persistent client ID plus chosen display
    // name, sent on (re)join. Shared with every mp-* prototype that opts
    // into the named-identity payload - see packages/mp-core.
    identity: createIdentityActionWithName(room),
    // Host -> peer(s) lobby/session UI pushes, optionally targeted.
    hostUI: createHostUIAction<HostUIMessage>(room),
    // Player -> host game actions (playCard/selectDelegate/redistribute/
    // declareRoleGuess), sent on confirm.
    gameAction: room.makeAction<ClientAction>('gameAction'),
    // Host -> peer masked game state. Every send of this action must pass a
    // `{ target: peerId }` - see host/mask.ts and HostGameScene.
    state: room.makeAction<MaskedState>('state'),
  };
}

export type NetworkActions = ReturnType<typeof createNetworkActions>;
