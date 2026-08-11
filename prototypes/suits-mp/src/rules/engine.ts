import { ALL_GODS, CARD_DEFS, GOD_DISPLAY_NAME, GOD_TEAM, cardById, cardId, suitAfterSteps } from './cards';
import type {
  CardId,
  ForcedDeal,
  GameState,
  God,
  PlayKind,
  PlayerId,
  PlayerState,
  Rank,
  RedistributionGift,
  Team,
  TrickPlay,
  TrickResult,
  WinInfo,
} from './types';

const TRICK_40_FORCED_END = 40;

// --- Randomness -------------------------------------------------------
// Always genuinely random for real play. Forced deals (debug-only) bypass
// this entirely; see rules/debugScenarios.ts.

function shuffle<T>(items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck(): CardId[] {
  return CARD_DEFS.map((c) => c.id);
}

// --- Turn order ---------------------------------------------------------

export function turnOrder(leaderId: PlayerId): PlayerId[] {
  return [0, 1, 2, 3].map((i) => (((leaderId + i) % 4) as PlayerId));
}

export function currentPlayerId(state: GameState): PlayerId {
  return turnOrder(state.leaderId)[state.plays.length];
}

export function requiredSuitForPosition(position: number, leadGod: God): God | null {
  if (position === 0) return null;
  return suitAfterSteps(leadGod, position);
}

export function currentRequiredSuit(state: GameState): God | null {
  const position = state.plays.length;
  if (position === 0) return null;
  const leadGod = cardById(state.plays[0].cardIds[0]).god;
  return requiredSuitForPosition(position, leadGod);
}

// Trick 1's leader (whoever holds the 2 of Yog-Sothoth) must open with
// exactly that card - not just any Yog-Sothoth card, and not any other
// single. Every other trick's leader may open with any single card, as
// before. `isForcedTrick1Opener` takes just the two primitive values the
// condition needs so ui/renderGameView.ts's client-side legal/illegal
// highlighting (which only has a MaskedState, not a full GameState) can
// import and reuse the exact same condition, not a hand-copied
// re-derivation of it. `forcedTrick1Opener(state)` is the GameState-shaped
// convenience wrapper `playCard()`'s validation and host/botAI.ts's bot
// move choice both call - returns null whenever the restriction doesn't
// apply, so callers can use `forcedTrick1Opener(state) ?? <normal leading
// logic>` uniformly. Either way, this is the single source of truth for
// the rule - there is no separate human/bot/UI copy to drift out of sync.
export function isForcedTrick1Opener(trickNumber: number, position: number): boolean {
  return trickNumber === 1 && position === 0;
}

export function forcedTrick1Opener(state: GameState): CardId | null {
  return isForcedTrick1Opener(state.trickNumber, state.plays.length) ? cardId('YogSothoth', 2) : null;
}

// --- Setup ----------------------------------------------------------------

export function initGame(names: [string, string, string, string], forced?: ForcedDeal): GameState {
  let hands: [CardId[], CardId[], CardId[], CardId[]];
  let gods: [God, God, God, God];
  let leaderId: PlayerId;
  let trickNumber: number;

  if (forced) {
    hands = forced.hands;
    gods = forced.gods;
    leaderId = forced.leaderId;
    trickNumber = forced.trickNumber ?? 1;
  } else {
    const deck = shuffle(buildDeck());
    hands = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30), deck.slice(30, 40)];
    gods = shuffle(ALL_GODS) as [God, God, God, God];
    const yog2 = cardId('YogSothoth', 2);
    const found = hands.findIndex((hand) => hand.includes(yog2));
    leaderId = (found === -1 ? 0 : found) as PlayerId;
    trickNumber = 1;
  }

  const players = names.map(
    (name, i): PlayerState => ({
      id: i as PlayerId,
      name,
      god: gods[i],
      hand: hands[i],
    })
  ) as [PlayerState, PlayerState, PlayerState, PlayerState];

  return {
    players,
    trickNumber,
    leaderId,
    plays: [],
    phase: 'blocker',
    pendingBlocker: { forPlayerId: leaderId, next: 'turn' },
    lastTrickResult: null,
    pendingDistributorId: null,
    pendingWinnerId: null,
    lastReceived: {},
    receivedLog: {},
    winner: null,
  };
}

// --- Legal moves ------------------------------------------------------

export interface LegalOptions {
  readonly mustPlaySuit: God | null;
  readonly suitCards: CardId[];
  readonly offsuitAvailable: boolean;
  readonly doubleRanks: Rank[];
}

function groupByRank(hand: readonly CardId[]): Map<Rank, CardId[]> {
  const map = new Map<Rank, CardId[]>();
  for (const id of hand) {
    const rank = cardById(id).rank;
    const group = map.get(rank);
    if (group) group.push(id);
    else map.set(rank, [id]);
  }
  return map;
}

export function legalOptions(hand: readonly CardId[], requiredSuit: God | null): LegalOptions {
  if (requiredSuit === null) {
    return { mustPlaySuit: null, suitCards: [], offsuitAvailable: true, doubleRanks: [] };
  }
  const suitCards = hand.filter((id) => cardById(id).god === requiredSuit);
  if (suitCards.length > 0) {
    return { mustPlaySuit: requiredSuit, suitCards, offsuitAvailable: false, doubleRanks: [] };
  }
  const doubleRanks = [...groupByRank(hand).entries()].filter(([, ids]) => ids.length >= 2).map(([rank]) => rank);
  return { mustPlaySuit: null, suitCards: [], offsuitAvailable: true, doubleRanks };
}

// --- Playing a card -----------------------------------------------------

export function playCard(state: GameState, playerId: PlayerId, cardIds: CardId[]): GameState {
  if (state.phase !== 'turn') throw new Error('not in turn phase');
  if (playerId !== currentPlayerId(state)) throw new Error('not this player\'s turn');

  const position = state.plays.length;
  const requiredSuit = currentRequiredSuit(state);
  const player = state.players[playerId];
  const opts = legalOptions(player.hand, requiredSuit);

  let kind: PlayKind;
  if (position === 0) {
    const forcedOpener = forcedTrick1Opener(state);
    if (forcedOpener) {
      if (cardIds.length !== 1 || cardIds[0] !== forcedOpener) {
        throw new Error('trick 1 must open with the 2 of Yog-Sothoth');
      }
    } else if (cardIds.length !== 1 || !player.hand.includes(cardIds[0])) {
      throw new Error('leader must play exactly one card from hand');
    }
    kind = 'normal';
  } else if (opts.mustPlaySuit) {
    if (cardIds.length !== 1 || !opts.suitCards.includes(cardIds[0])) throw new Error('must play a required-suit card');
    kind = 'normal';
  } else if (cardIds.length === 1) {
    if (!player.hand.includes(cardIds[0])) throw new Error('card not in hand');
    kind = 'offsuit';
  } else if (cardIds.length === 2) {
    const [a, b] = cardIds;
    if (!player.hand.includes(a) || !player.hand.includes(b)) throw new Error('card not in hand');
    if (a === b) throw new Error('double requires two distinct cards');
    if (cardById(a).rank !== cardById(b).rank) throw new Error('double requires matching rank');
    kind = 'double';
  } else {
    throw new Error('illegal play: must be one card, or two of matching rank');
  }

  const newHand = player.hand.filter((id) => !cardIds.includes(id));
  const newPlayers = state.players.map((p) => (p.id === playerId ? { ...p, hand: newHand } : p)) as GameState['players'];
  const newPlay: TrickPlay = { playerId, cardIds, kind, requiredSuit };
  const newPlays = [...state.plays, newPlay];

  if (newPlays.length < 4) {
    const nextPlayer = turnOrder(state.leaderId)[newPlays.length];
    return {
      ...state,
      players: newPlayers,
      plays: newPlays,
      phase: 'blocker',
      pendingBlocker: { forPlayerId: nextPlayer, next: 'turn' },
    };
  }

  // Fourth play: resolve, collect, check win.
  const trickResult = resolveTrick(newPlays);
  const collectedCardIds = newPlays.flatMap((p) => p.cardIds);
  const winnerHand = [...newPlayers[trickResult.winnerId].hand, ...collectedCardIds];
  const collectedPlayers = newPlayers.map((p) =>
    p.id === trickResult.winnerId ? { ...p, hand: winnerHand } : p
  ) as GameState['players'];

  const win = checkSuitCompletion(collectedPlayers);
  if (win) {
    return {
      ...state,
      players: collectedPlayers,
      plays: [],
      phase: 'gameOver',
      pendingBlocker: null,
      lastTrickResult: trickResult,
      winner: win,
    };
  }

  return {
    ...state,
    players: collectedPlayers,
    plays: [],
    phase: 'trickResult',
    pendingBlocker: null,
    lastTrickResult: trickResult,
    pendingWinnerId: trickResult.winnerId,
    pendingDistributorId: null,
  };
}

// --- Trick resolution -----------------------------------------------------

function hasTenInTrick(plays: readonly TrickPlay[]): boolean {
  return plays.some((p) => p.cardIds.some((id) => cardById(id).rank === 10));
}

function rankValue(id: CardId, hasTen: boolean): number {
  const rank = cardById(id).rank;
  if (rank === 'Ace') return hasTen ? 11 : 1;
  return rank;
}

function scoreOf(play: TrickPlay, hasTen: boolean): number {
  if (play.kind === 'offsuit') return 0;
  return rankValue(play.cardIds[0], hasTen);
}

export function resolveTrick(plays: readonly TrickPlay[]): TrickResult {
  const hasTen = hasTenInTrick(plays);
  const doublePlays = plays.filter((p) => p.kind === 'double');
  const candidates = doublePlays.length > 0 ? doublePlays : plays;

  let best = candidates[0];
  let bestScore = scoreOf(best, hasTen);
  for (let i = 1; i < candidates.length; i++) {
    const s = scoreOf(candidates[i], hasTen);
    if (s >= bestScore) {
      best = candidates[i];
      bestScore = s;
    }
  }

  return { plays: plays.slice(), winnerId: best.playerId, wonByDouble: doublePlays.length > 0 };
}

// --- Win checks -------------------------------------------------------

function godCardIds(god: God): CardId[] {
  return CARD_DEFS.filter((c) => c.god === god).map((c) => c.id);
}

export function checkSuitCompletion(players: readonly PlayerState[]): WinInfo | null {
  for (const p of players) {
    const suitIds = godCardIds(p.god);
    if (suitIds.every((id) => p.hand.includes(id))) {
      return {
        team: GOD_TEAM[p.god],
        reason: 'suit',
        detail: `${p.name} collected all 10 ${GOD_DISPLAY_NAME[p.god]} cards.`,
      };
    }
  }
  return null;
}

// --- Trick result -> redistribution handoff -------------------------------

export function proceedFromTrickResult(state: GameState): GameState {
  if (state.phase !== 'trickResult' || !state.lastTrickResult || state.pendingWinnerId === null) {
    throw new Error('not in trickResult phase');
  }
  const winnerId = state.pendingWinnerId;
  if (state.lastTrickResult.wonByDouble) {
    return {
      ...state,
      phase: 'blocker',
      pendingBlocker: { forPlayerId: winnerId, next: 'chooseDelegate' },
    };
  }
  return {
    ...state,
    pendingDistributorId: winnerId,
    phase: 'blocker',
    pendingBlocker: { forPlayerId: winnerId, next: 'redistribution' },
  };
}

export function chooseDelegate(state: GameState, delegateId: PlayerId): GameState {
  if (state.phase !== 'chooseDelegate' || state.pendingWinnerId === null) throw new Error('not choosing a delegate');
  if (delegateId === state.pendingWinnerId) throw new Error('the double-winner may not redistribute their own trick');
  return {
    ...state,
    pendingDistributorId: delegateId,
    phase: 'blocker',
    pendingBlocker: { forPlayerId: delegateId, next: 'redistribution' },
  };
}

// --- Redistribution -----------------------------------------------------

export function advanceBlocker(state: GameState): GameState {
  if (state.phase !== 'blocker' || !state.pendingBlocker) throw new Error('not at a blocker');
  return { ...state, phase: state.pendingBlocker.next, pendingBlocker: null };
}

export function redistribute(state: GameState, gifts: readonly RedistributionGift[]): GameState {
  if (state.phase !== 'redistribution' || state.pendingWinnerId === null || state.pendingDistributorId === null) {
    throw new Error('not in redistribution phase');
  }
  if (!state.lastTrickResult) throw new Error('no trick result to redistribute from');

  const winnerId = state.pendingWinnerId;
  const contribution = new Map<PlayerId, number>();
  for (const play of state.lastTrickResult.plays) {
    if (play.playerId !== winnerId) contribution.set(play.playerId, play.cardIds.length);
  }

  const giftedIds = new Set<CardId>();
  for (const gift of gifts) {
    const expected = contribution.get(gift.toPlayerId);
    if (expected === undefined) throw new Error('gift target did not contribute to the trick');
    if (gift.cardIds.length !== expected) throw new Error('gift size must match contribution');
    for (const id of gift.cardIds) {
      if (giftedIds.has(id)) throw new Error('card gifted twice');
      giftedIds.add(id);
    }
  }
  if (gifts.length !== contribution.size) throw new Error('every contributing player must receive a gift');

  const winnerHand = state.players[winnerId].hand;
  for (const id of giftedIds) {
    if (!winnerHand.includes(id)) throw new Error('gifted card is not in the winner\'s hand');
  }

  const remainingWinnerHand = winnerHand.filter((id) => !giftedIds.has(id));
  const lastReceived = { ...state.lastReceived };
  const receivedLog = { ...state.receivedLog };
  let players = state.players.map((p) =>
    p.id === winnerId ? { ...p, hand: remainingWinnerHand } : p
  ) as GameState['players'];

  for (const gift of gifts) {
    players = players.map((p) =>
      p.id === gift.toPlayerId ? { ...p, hand: [...p.hand, ...gift.cardIds] } : p
    ) as GameState['players'];
    const record = { cardIds: gift.cardIds, fromPlayerId: winnerId, trickNumber: state.trickNumber };
    lastReceived[gift.toPlayerId] = record;
    receivedLog[gift.toPlayerId] = [...(receivedLog[gift.toPlayerId] ?? []), record];
  }

  const win = checkSuitCompletion(players);
  if (win) {
    return {
      ...state,
      players,
      lastReceived,
      receivedLog,
      phase: 'gameOver',
      pendingBlocker: null,
      winner: win,
    };
  }

  // Trick-40 forced end (replaces the old role-guess win condition): if no
  // suit was completed by the end of trick 40's own redistribution, the
  // game ends automatically here - no player action triggers it, and it
  // fires identically regardless of whether this redistribution was
  // self-performed or delegated. See resolveTrick40ForcedEnd below.
  if (state.trickNumber === TRICK_40_FORCED_END) {
    return {
      ...state,
      players,
      lastReceived,
      receivedLog,
      phase: 'gameOver',
      pendingBlocker: null,
      pendingWinnerId: null,
      pendingDistributorId: null,
      winner: resolveTrick40ForcedEnd(players),
    };
  }

  const newLeaderId = state.pendingDistributorId;
  return {
    ...state,
    players,
    lastReceived,
    receivedLog,
    leaderId: newLeaderId,
    trickNumber: state.trickNumber + 1,
    pendingWinnerId: null,
    pendingDistributorId: null,
    phase: 'blocker',
    pendingBlocker: { forPlayerId: newLeaderId, next: 'turn' },
  };
}

// --- Trick-40 forced end ---------------------------------------------------

function suitCompletionCount(player: PlayerState): number {
  return godCardIds(player.god).filter((id) => player.hand.includes(id)).length;
}

// Chaos = Cthulhu + Nyarlathotep, Cosmos = Shub-Niggurath + Yog-Sothoth
// (same fixed pairing as GOD_TEAM). Compares each team's best player's
// suit-completion count, then their other player's as a tiebreak, then
// falls back to a stalemate. See root BRIEF.md item 2 of the follow-up
// task for the exact rule this implements.
function resolveTrick40ForcedEnd(players: readonly PlayerState[]): WinInfo {
  const byTeam: Record<Team, PlayerState[]> = { Chaos: [], Cosmos: [] };
  for (const p of players) byTeam[GOD_TEAM[p.god]].push(p);

  const chaosCounts = byTeam.Chaos.map(suitCompletionCount).sort((a, b) => b - a);
  const cosmosCounts = byTeam.Cosmos.map(suitCompletionCount).sort((a, b) => b - a);

  if (chaosCounts[0] !== cosmosCounts[0]) {
    const winningTeam: Team = chaosCounts[0] > cosmosCounts[0] ? 'Chaos' : 'Cosmos';
    return {
      team: winningTeam,
      reason: 'trick40',
      detail: `Trick 40 ended with no suit completed - ${winningTeam}'s best player held more of their own suit (${Math.max(chaosCounts[0], cosmosCounts[0])} vs ${Math.min(chaosCounts[0], cosmosCounts[0])}).`,
    };
  }
  if (chaosCounts[1] !== cosmosCounts[1]) {
    const winningTeam: Team = chaosCounts[1] > cosmosCounts[1] ? 'Chaos' : 'Cosmos';
    return {
      team: winningTeam,
      reason: 'trick40',
      detail: `Trick 40 ended with no suit completed - both teams tied on their best player, ${winningTeam}'s other player held more of their own suit (${Math.max(chaosCounts[1], cosmosCounts[1])} vs ${Math.min(chaosCounts[1], cosmosCounts[1])}).`,
    };
  }
  return {
    team: null,
    reason: 'stalemate',
    detail: 'Trick 40 ended with no suit completed and both teams tied on both players.',
  };
}

// --- Rendering helpers ----------------------------------------------------

export function activePlayerId(state: GameState): PlayerId | null {
  switch (state.phase) {
    case 'turn':
      return currentPlayerId(state);
    case 'chooseDelegate':
      return state.pendingWinnerId;
    case 'redistribution':
      return state.pendingDistributorId;
    default:
      return null;
  }
}
