export type God = 'Cthulhu' | 'Nyarlathotep' | 'ShubNiggurath' | 'YogSothoth';

export type Team = 'Chaos' | 'Cosmos';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'Ace';

export type PlayerId = 0 | 1 | 2 | 3;

export type CardId = string;

export interface CardDef {
  readonly id: CardId;
  readonly god: God;
  readonly rank: Rank;
  readonly name: string;
}

export type PlayKind = 'normal' | 'offsuit' | 'double';

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly god: God;
  readonly hand: CardId[];
}

export interface TrickPlay {
  readonly playerId: PlayerId;
  readonly cardIds: CardId[];
  readonly kind: PlayKind;
  readonly requiredSuit: God | null;
}

export interface TrickResult {
  readonly plays: TrickPlay[];
  readonly winnerId: PlayerId;
  readonly wonByDouble: boolean;
}

export interface RedistributionGift {
  readonly toPlayerId: PlayerId;
  readonly cardIds: CardId[];
}

export interface ReceivedRecord {
  readonly cardIds: CardId[];
  readonly fromPlayerId: PlayerId;
  readonly trickNumber: number;
  // Whether the trick this gift was redistributed from was won via a
  // Double - since self-delegation is illegal, this alone determines
  // whether `fromPlayerId` was the trick's winner (Single) or a delegate
  // acting on the winner's behalf (Double). See host/mask.ts's
  // RedistributionLogEntry.wonByDouble for where this is surfaced.
  readonly wonByDouble: boolean;
}

export type Phase =
  | 'blocker'
  | 'turn'
  | 'trickResult'
  | 'chooseDelegate'
  | 'redistribution'
  | 'gameOver';

export type BlockerNext = 'turn' | 'chooseDelegate' | 'redistribution';

export interface PendingBlocker {
  readonly forPlayerId: PlayerId;
  readonly next: BlockerNext;
}

export interface WinInfo {
  readonly team: Team | null;
  // 'trick40': the automatic forced end at the close of trick 40 with no
  // suit completed (see engine.ts's resolveTrick40ForcedEnd). 'stalemate'
  // covers only that forced end's own tie case now - the old role-guess
  // exhaustion stalemate was removed along with role-guess entirely.
  readonly reason: 'suit' | 'trick40' | 'stalemate';
  readonly detail: string;
}

// Dev-only hook (see rules/debugScenarios.ts) for forcing a specific deal so
// Playwright can exercise scenarios deterministically. Never used outside
// ?debug=1.
export interface ForcedDeal {
  readonly hands: [CardId[], CardId[], CardId[], CardId[]];
  readonly gods: [God, God, God, God];
  readonly leaderId: PlayerId;
  readonly trickNumber?: number;
}

export interface GameState {
  readonly players: [PlayerState, PlayerState, PlayerState, PlayerState];
  readonly trickNumber: number;
  readonly leaderId: PlayerId;
  readonly plays: TrickPlay[];
  readonly phase: Phase;
  readonly pendingBlocker: PendingBlocker | null;
  readonly lastTrickResult: TrickResult | null;
  readonly pendingDistributorId: PlayerId | null;
  readonly pendingWinnerId: PlayerId | null;
  readonly lastReceived: Partial<Record<PlayerId, ReceivedRecord>>;
  // Cumulative, per-recipient history of every redistribution received so
  // far this game (unlike lastReceived, which only ever holds the latest).
  // Powers the toggleable redistribution log; scoped per-player so it never
  // reveals another player's receipts.
  readonly receivedLog: Partial<Record<PlayerId, ReceivedRecord[]>>;
  readonly winner: WinInfo | null;
}
