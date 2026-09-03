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
  // Single-valued for now: the trick-40 forced end (and the 'trick40'/
  // 'stalemate' reasons that only ever existed to support it) was removed
  // per GDD v2's "No Trick Limit" - there is no trick limit or forced end
  // condition any more, so trickNumber climbs indefinitely and the only way
  // a game ends is checkSuitCompletion() finding a completed Deity Suit.
  // Kept as a discriminant (not inlined into `team`/`detail`) since a
  // future reason may need to exist - notably, GDD's Standard Win
  // Condition also calls for a stalemate when both Teams complete a Deity
  // Suit in the same redistribution, which checkSuitCompletion() does not
  // currently detect (it returns the first completed player found, with no
  // simultaneous-completion check at all). That gap predates this removal
  // and is a separate, unimplemented mechanic, not something this removal
  // touches - see BUILD_STATUS.md.
  readonly reason: 'suit';
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
