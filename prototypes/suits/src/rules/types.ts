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
  readonly guessUsed: boolean;
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
}

export type Phase =
  | 'blocker'
  | 'turn'
  | 'roleGuess'
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
  readonly reason: 'suit' | 'roleGuess' | 'stalemate';
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
  readonly winner: WinInfo | null;
}
