// Self-play simulation for suits-mp: runs full games with all four seats
// bot-controlled, driving the real, unmodified engine/host/bot-AI modules
// directly (no Phaser, no networking, no rendering). Dev/analysis tool only
// - not reachable from the actual game UI. Loaded via run-simulate.mjs,
// which boots a Vite SSR module graph so this file can import the game's
// own extensionless TS sources unmodified.
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { applyAction, createInitialState } from '../prototypes/suits-mp/src/host/gameHost';
import { chooseBotAction } from '../prototypes/suits-mp/src/host/botAI';
import { determineRole } from '../prototypes/suits-mp/src/host/botRole';
import { identifyFriendlyAlly } from '../prototypes/suits-mp/src/host/botTrust';
import { createBotPersonalities, resolveMode } from '../prototypes/suits-mp/src/host/botPersonality';
import type { BotPersonalityState, Personality } from '../prototypes/suits-mp/src/host/botPersonality';
import { activePlayerId, requiredSuitForPosition, turnOrder } from '../prototypes/suits-mp/src/rules/engine';
import { cardById, GOD_TEAM } from '../prototypes/suits-mp/src/rules/cards';
import { fromNetPlayerId } from '../prototypes/suits-mp/src/net/netPlayerId';
import type { CardId, DeityCardState, God, GameState, PlayerId, PlayKind, Team, WinInfo } from '../prototypes/suits-mp/src/rules/types';
import type { ClientAction } from '../prototypes/suits-mp/src/net/actions';

interface LoggedCard {
  readonly id: CardId;
  readonly name: string;
  readonly god: God;
  readonly rank: string | number;
}

function toLoggedCard(id: CardId): LoggedCard {
  const def = cardById(id);
  return { id, name: def.name, god: def.god, rank: def.rank };
}

interface TrickLogEntry {
  readonly trickNumber: number;
  readonly leaderId: PlayerId;
  readonly leadGod: God;
  readonly plays: {
    readonly playerId: PlayerId;
    readonly cards: LoggedCard[];
    readonly kind: PlayKind;
    readonly requiredSuit: God | null;
    readonly deityCardState: DeityCardState | null;
  }[];
  readonly winnerId: PlayerId;
  readonly wonByDouble: boolean;
}

interface RedistributionLogEntry {
  readonly trickNumber: number;
  readonly distributorId: PlayerId;
  readonly distributorGod: God;
  readonly wonByDouble: boolean;
  readonly assignments: { readonly toPlayerId: PlayerId; readonly cards: LoggedCard[] }[];
  // Verification-only snapshot of the distributor's own role/ally view at
  // the moment of this decision (host/botRole.ts's determineRole,
  // host/botTrust.ts's identifyFriendlyAlly) - the same values
  // chooseRedistributeAction itself used to build `assignments`, logged
  // here purely so a real game's redistribution choices can be spot-
  // checked against the role/ally state that produced them.
  readonly role: 'completer' | 'assist';
  readonly friendlyPlayerId: PlayerId | null;
  readonly friendlyPlayerDeity: God | null;
  // True when the distributor's pool already held all 10 unique cards of
  // their own suit before this redistribution - i.e. this redistribution
  // locks the win for the distributor's team (botAI.ts's isWinLock).
  readonly isWinLock: boolean;
}

interface DelegateLogEntry {
  readonly trickNumber: number;
  readonly winnerId: PlayerId;
  readonly delegateId: PlayerId;
}

// Verification-only: the leader's own role/ally view at the moment they
// chose a lead card, plus an INDEPENDENTLY recomputed check (using the
// same real engine.ts requiredSuitForPosition/turnOrder Section 5.3
// itself uses, not read from bot internals) of whether this led suit
// forces some other seat to reveal the logged friendlyPlayerDeity, and if
// so whether that seat is the ally's own or an opponent's. Lets a real
// game be spot-checked for Section 5.3 actually firing and targeting
// correctly, without touching botAI.ts's own decision code at all.
interface LeadChoiceLogEntry {
  readonly trickNumber: number;
  readonly leaderId: PlayerId;
  readonly leaderGod: God;
  readonly role: 'completer' | 'assist';
  readonly friendlyPlayerId: PlayerId | null;
  readonly friendlyPlayerDeity: God | null;
  readonly ledCard: LoggedCard;
  readonly suitCycleTarget: { readonly targetSeat: PlayerId; readonly isOpponent: boolean } | null;
}

function computeSuitCycleTarget(
  leaderId: PlayerId,
  leadGod: God,
  friendlyPlayerId: PlayerId | null,
  friendlyPlayerDeity: God | null
): LeadChoiceLogEntry['suitCycleTarget'] {
  if (friendlyPlayerId === null || friendlyPlayerDeity === null) return null;
  const order = turnOrder(leaderId);
  for (let position = 1; position <= 3; position++) {
    if (requiredSuitForPosition(position, leadGod) === friendlyPlayerDeity) {
      const targetSeat = order[position];
      return { targetSeat, isOpponent: targetSeat !== friendlyPlayerId };
    }
  }
  return null;
}

// Verification-only snapshot (host/botTrust.ts is not consumed by any
// decision function yet - this exists purely to check, with real data,
// whether the trust mechanism's "friendly" guess actually correlates with
// real team membership). Computed once per game, from the FINAL state
// (most accumulated evidence), using the exact same identifyFriendlyAlly
// every one of the 4 seats would call for itself - this script additionally
// knows each seat's real team (GOD_TEAM), which the bot itself never sees,
// purely to grade the guess's accuracy from the outside.
interface AllyGuessLogEntry {
  readonly playerId: PlayerId;
  readonly guessedFriendlyPlayer: PlayerId | null;
  readonly guessedFriendlyPlayerDeity: God | null;
  readonly actualTeammatePlayerId: PlayerId;
  readonly correct: boolean;
}

function computeAllyGuesses(state: GameState): AllyGuessLogEntry[] {
  return ([0, 1, 2, 3] as const).map((playerId) => {
    const ownTeam = GOD_TEAM[state.players[playerId].god];
    const actualTeammate = state.players.find((p) => p.id !== playerId && GOD_TEAM[p.god] === ownTeam);
    if (!actualTeammate) throw new Error(`player ${playerId} has no teammate - GOD_TEAM pairing invariant violated`);
    const guess = identifyFriendlyAlly(state, playerId);
    return {
      playerId,
      guessedFriendlyPlayer: guess?.friendlyPlayer ?? null,
      guessedFriendlyPlayerDeity: guess?.friendlyPlayerDeity ?? null,
      actualTeammatePlayerId: actualTeammate.id,
      correct: guess !== null && guess.friendlyPlayer === actualTeammate.id,
    };
  });
}

interface GameLog {
  readonly gameIndex: number;
  readonly startingLeaderId: PlayerId;
  readonly players: { readonly id: PlayerId; readonly god: God; readonly team: Team; readonly personality: Personality }[];
  readonly tricks: TrickLogEntry[];
  readonly redistributions: RedistributionLogEntry[];
  readonly delegateSelections: DelegateLogEntry[];
  readonly leadChoices: LeadChoiceLogEntry[];
  readonly allyGuesses: AllyGuessLogEntry[];
  // Null only when the game hit the safety-iteration cap before reaching
  // gameOver (see playOneGame's MAX_ITERATIONS) - a real, observed fact
  // about that specific run, not a fabricated result. Self-play with the
  // current legal-random + Tier-A-redistribution-only bot AI has a
  // heavy-tailed trick-count distribution under the GDD's "No Trick
  // Limit" rule: most games finish in well under 300 tricks, but a rare
  // game can run into the tens of thousands of tricks before either team
  // completes a suit. The cap exists only to guard against a genuine
  // non-terminating cycle, not to truncate normal long games.
  readonly winner: WinInfo | null;
  readonly trickCount: number;
  readonly incomplete?: true;
}

function logTrickIfCompleted(state: GameState, prevLastTrickResult: GameState['lastTrickResult'], out: TrickLogEntry[]): void {
  const result = state.lastTrickResult;
  if (!result || result === prevLastTrickResult) return;
  const leadGod = cardById(result.plays[0].cardIds[0]).god;
  out.push({
    trickNumber: state.trickNumber,
    leaderId: result.plays[0].playerId,
    leadGod,
    plays: result.plays.map((p) => ({
      playerId: p.playerId,
      cards: p.cardIds.map(toLoggedCard),
      kind: p.kind,
      requiredSuit: p.requiredSuit,
      deityCardState: p.deityCardState,
    })),
    winnerId: result.winnerId,
    wonByDouble: result.wonByDouble,
  });
}

function logActionIfRelevant(
  state: GameState,
  action: ClientAction,
  redistributions: RedistributionLogEntry[],
  delegateSelections: DelegateLogEntry[],
  leadChoices: LeadChoiceLogEntry[],
  personalities: Record<PlayerId, BotPersonalityState>
): void {
  if (action.action === 'playCard' && state.plays.length === 0) {
    const leaderId = state.leaderId;
    const ally = identifyFriendlyAlly(state, leaderId);
    const ledCardId = action.cards[0];
    const leadGod = cardById(ledCardId).god;
    const mode = resolveMode(personalities[leaderId], state.trickNumber);
    leadChoices.push({
      trickNumber: state.trickNumber,
      leaderId,
      leaderGod: state.players[leaderId].god,
      role: determineRole(state, leaderId, mode),
      friendlyPlayerId: ally?.friendlyPlayer ?? null,
      friendlyPlayerDeity: ally?.friendlyPlayerDeity ?? null,
      ledCard: toLoggedCard(ledCardId),
      suitCycleTarget: computeSuitCycleTarget(leaderId, leadGod, ally?.friendlyPlayer ?? null, ally?.friendlyPlayerDeity ?? null),
    });
  }
  if (action.action === 'redistribute') {
    const distributorId = state.pendingDistributorId;
    if (distributorId === null) throw new Error('redistribute action with no pendingDistributorId');
    const ally = identifyFriendlyAlly(state, distributorId);
    const mode = resolveMode(personalities[distributorId], state.trickNumber);
    redistributions.push({
      trickNumber: state.trickNumber,
      distributorId,
      distributorGod: state.players[distributorId].god,
      wonByDouble: state.lastTrickResult?.wonByDouble ?? false,
      assignments: action.assignments.map((a) => ({
        toPlayerId: fromNetPlayerId(a.toPlayer),
        cards: a.cards.map(toLoggedCard),
      })),
      role: determineRole(state, distributorId, mode),
      friendlyPlayerId: ally?.friendlyPlayer ?? null,
      friendlyPlayerDeity: ally?.friendlyPlayerDeity ?? null,
      isWinLock: state.players[distributorId].hand.filter((id) => cardById(id).god === state.players[distributorId].god).length === 10,
    });
  } else if (action.action === 'selectDelegate') {
    if (state.pendingWinnerId === null) throw new Error('selectDelegate action with no pendingWinnerId');
    delegateSelections.push({
      trickNumber: state.trickNumber,
      winnerId: state.pendingWinnerId,
      delegateId: fromNetPlayerId(action.targetPlayer),
    });
  }
}

function playOneGame(gameIndex: number): GameLog {
  let state = createInitialState();
  const startingLeaderId = state.leaderId;
  const tricks: TrickLogEntry[] = [];
  const redistributions: RedistributionLogEntry[] = [];
  const delegateSelections: DelegateLogEntry[] = [];
  const leadChoices: LeadChoiceLogEntry[] = [];
  // One random archetype per seat, assigned once for this game's whole
  // duration - see host/botPersonality.ts's own doc comment for why this
  // is the one piece of persistent bot state in the whole AI.
  const personalities = createBotPersonalities();
  const withPersonality = (p: { id: PlayerId; god: God; team: Team }) => ({ ...p, personality: personalities[p.id].personality });

  let iterations = 0;
  // Empirically, a 300k-action budget comfortably covers the observed
  // heavy tail (a 30-game probe with a 300k cap had 0 non-terminating
  // games, the longest finishing at ~108k actions / 21566 tricks) while
  // still catching a genuine non-terminating cycle should one exist.
  const MAX_ITERATIONS = 500000;
  while (state.phase !== 'gameOver') {
    if (++iterations > MAX_ITERATIONS) {
      return {
        gameIndex,
        startingLeaderId,
        players: state.players.map((p) => withPersonality({ id: p.id, god: p.god, team: GOD_TEAM[p.god] })),
        tricks,
        redistributions,
        delegateSelections,
        leadChoices,
        allyGuesses: computeAllyGuesses(state),
        winner: null,
        trickCount: state.trickNumber,
        incomplete: true,
      };
    }
    const slot = activePlayerId(state);
    if (slot === null) {
      throw new Error(`game ${gameIndex}: no active player for phase "${state.phase}" - engine should never leave settleAutoPhases in this phase`);
    }
    const action = chooseBotAction(state, slot, personalities[slot]);
    logActionIfRelevant(state, action, redistributions, delegateSelections, leadChoices, personalities);
    const prevLastTrickResult = state.lastTrickResult;
    const result = applyAction(state, slot, action);
    if (!result.ok) {
      throw new Error(`game ${gameIndex}: bot-produced action was rejected by applyAction: ${result.error}`);
    }
    logTrickIfCompleted(result.state, prevLastTrickResult, tricks);
    state = result.state;
  }

  if (!state.winner) throw new Error(`game ${gameIndex}: reached gameOver with no winner set`);
  if (tricks.length !== state.trickNumber) {
    throw new Error(`game ${gameIndex}: logged ${tricks.length} tricks but state.trickNumber is ${state.trickNumber}`);
  }

  return {
    gameIndex,
    startingLeaderId,
    players: state.players.map((p) => withPersonality({ id: p.id, god: p.god, team: GOD_TEAM[p.god] })),
    tricks,
    redistributions,
    delegateSelections,
    leadChoices,
    allyGuesses: computeAllyGuesses(state),
    winner: state.winner,
    trickCount: state.trickNumber,
  };
}

// --- Aggregation ------------------------------------------------------

interface Aggregates {
  readonly totalGamesRequested: number;
  readonly completedGames: number;
  // Games that hit playOneGame's MAX_ITERATIONS safety cap before
  // reaching gameOver - see GameLog.incomplete's doc comment. Excluded
  // from every rate/trickCount stat below, which are computed over
  // completedGames only; reported here so a non-zero count is visible
  // rather than silently dropped.
  readonly incompleteGames: number;
  readonly winsByTeam: Record<Team, number>;
  readonly stalemates: number;
  readonly winRateByTeam: Record<Team, number>;
  readonly stalemateRate: number;
  readonly winRateByStartingLeaderPosition: Record<
    PlayerId,
    { readonly games: number; readonly leaderTeamWins: number; readonly stalemates: number; readonly leaderTeamWinRate: number }
  >;
  readonly trickCount: { readonly min: number; readonly max: number; readonly average: number; readonly median: number };
  readonly totalTricksPlayed: number;
  readonly doubleWinTrickShare: number;
  // Verification-only: how often host/botTrust.ts's identifyFriendlyAlly
  // (computed from each game's FINAL state, per seat) actually names that
  // seat's real teammate - not consumed by any decision logic yet, purely
  // to check the trust mechanism against ground truth. Computed over every
  // requested game (completed or not), 4 player-perspectives each.
  readonly allyGuessAccuracy: {
    readonly totalPlayerGames: number;
    readonly confidentGuesses: number;
    readonly correctGuesses: number;
    readonly confidentGuessRate: number;
    readonly accuracyAmongConfidentGuesses: number;
  };
  // Section 7 (personalities): the actual point of the feature - do the 4
  // archetypes behave distinctly? Aggregated per-SEAT-INSTANCE (each
  // completed game contributes once per seat, so a game with e.g. two
  // Rushers counts twice toward Rusher's stats) rather than per-game,
  // since a single game's 4 seats can each carry a different archetype.
  readonly byPersonality: Record<
    Personality,
    {
      readonly seatInstances: number;
      readonly decidedGames: number; // excludes stalemates from the win-rate denominator
      readonly winRate: number; // this seat's TEAM winning, among decidedGames
      readonly averageTrickCountOfGamesInvolved: number;
      readonly decisionPoints: number; // total lead choices + redistributions this seat made
      readonly assistRoleShare: number; // fraction of this seat's own decisionPoints that were role === 'assist'
    }
  >;
}

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function aggregate(allGames: readonly GameLog[]): Aggregates {
  const games = allGames.filter((g): g is GameLog & { winner: WinInfo } => !g.incomplete && g.winner !== null);
  const incompleteGames = allGames.length - games.length;

  const allGuesses = allGames.flatMap((g) => g.allyGuesses);
  const confidentGuesses = allGuesses.filter((g) => g.guessedFriendlyPlayer !== null);
  const correctGuesses = confidentGuesses.filter((g) => g.correct);

  const winsByTeam: Record<Team, number> = { Chaos: 0, Cosmos: 0 };
  let stalemates = 0;
  const byLeader: Record<PlayerId, { games: number; leaderTeamWins: number; stalemates: number }> = {
    0: { games: 0, leaderTeamWins: 0, stalemates: 0 },
    1: { games: 0, leaderTeamWins: 0, stalemates: 0 },
    2: { games: 0, leaderTeamWins: 0, stalemates: 0 },
    3: { games: 0, leaderTeamWins: 0, stalemates: 0 },
  };
  const trickCounts: number[] = [];
  let totalTricksPlayed = 0;
  let doubleWinTricks = 0;

  for (const g of games) {
    trickCounts.push(g.trickCount);
    totalTricksPlayed += g.tricks.length;
    doubleWinTricks += g.tricks.filter((t) => t.wonByDouble).length;

    const leaderStats = byLeader[g.startingLeaderId];
    leaderStats.games++;

    if (g.winner.reason === 'stalemate') {
      stalemates++;
      leaderStats.stalemates++;
    } else if (g.winner.team) {
      winsByTeam[g.winner.team]++;
      const leaderTeam = g.players.find((p) => p.id === g.startingLeaderId)?.team;
      if (leaderTeam === g.winner.team) leaderStats.leaderTeamWins++;
    }
  }

  const sortedTricks = [...trickCounts].sort((a, b) => a - b);
  const winRateByStartingLeaderPosition = Object.fromEntries(
    ([0, 1, 2, 3] as PlayerId[]).map((id) => {
      const s = byLeader[id];
      return [id, { ...s, leaderTeamWinRate: s.games > 0 ? s.leaderTeamWins / s.games : 0 }];
    })
  ) as Aggregates['winRateByStartingLeaderPosition'];

  const personalityStats: Record<
    Personality,
    { seatInstances: number; decidedGames: number; wins: number; trickCountSum: number; decisionPoints: number; assistCount: number }
  > = {
    rusher: { seatInstances: 0, decidedGames: 0, wins: 0, trickCountSum: 0, decisionPoints: 0, assistCount: 0 },
    hoarder: { seatInstances: 0, decidedGames: 0, wins: 0, trickCountSum: 0, decisionPoints: 0, assistCount: 0 },
    balanced: { seatInstances: 0, decidedGames: 0, wins: 0, trickCountSum: 0, decisionPoints: 0, assistCount: 0 },
    wildcard: { seatInstances: 0, decidedGames: 0, wins: 0, trickCountSum: 0, decisionPoints: 0, assistCount: 0 },
  };
  for (const g of games) {
    const personalityBySeat = new Map(g.players.map((p) => [p.id, p.personality]));
    for (const p of g.players) {
      const s = personalityStats[p.personality];
      s.seatInstances++;
      s.trickCountSum += g.trickCount;
      if (g.winner.reason !== 'stalemate' && g.winner.team) {
        s.decidedGames++;
        if (g.winner.team === p.team) s.wins++;
      }
    }
    for (const lc of g.leadChoices) {
      const s = personalityStats[personalityBySeat.get(lc.leaderId)!];
      s.decisionPoints++;
      if (lc.role === 'assist') s.assistCount++;
    }
    for (const r of g.redistributions) {
      const s = personalityStats[personalityBySeat.get(r.distributorId)!];
      s.decisionPoints++;
      if (r.role === 'assist') s.assistCount++;
    }
  }
  const byPersonality = Object.fromEntries(
    (Object.entries(personalityStats) as [Personality, (typeof personalityStats)['rusher']][]).map(([personality, s]) => [
      personality,
      {
        seatInstances: s.seatInstances,
        decidedGames: s.decidedGames,
        winRate: s.decidedGames > 0 ? s.wins / s.decidedGames : 0,
        averageTrickCountOfGamesInvolved: s.seatInstances > 0 ? s.trickCountSum / s.seatInstances : 0,
        decisionPoints: s.decisionPoints,
        assistRoleShare: s.decisionPoints > 0 ? s.assistCount / s.decisionPoints : 0,
      },
    ])
  ) as Aggregates['byPersonality'];

  return {
    totalGamesRequested: allGames.length,
    completedGames: games.length,
    incompleteGames,
    winsByTeam,
    stalemates,
    winRateByTeam: {
      Chaos: games.length > 0 ? winsByTeam.Chaos / games.length : 0,
      Cosmos: games.length > 0 ? winsByTeam.Cosmos / games.length : 0,
    },
    stalemateRate: games.length > 0 ? stalemates / games.length : 0,
    winRateByStartingLeaderPosition,
    trickCount: {
      min: sortedTricks[0] ?? 0,
      max: sortedTricks[sortedTricks.length - 1] ?? 0,
      average: trickCounts.length > 0 ? trickCounts.reduce((a, b) => a + b, 0) / trickCounts.length : 0,
      median: sortedTricks.length > 0 ? median(sortedTricks) : 0,
    },
    totalTricksPlayed,
    doubleWinTrickShare: totalTricksPlayed > 0 ? doubleWinTricks / totalTricksPlayed : 0,
    allyGuessAccuracy: {
      totalPlayerGames: allGuesses.length,
      confidentGuesses: confidentGuesses.length,
      correctGuesses: correctGuesses.length,
      confidentGuessRate: allGuesses.length > 0 ? confidentGuesses.length / allGuesses.length : 0,
      accuracyAmongConfidentGuesses: confidentGuesses.length > 0 ? correctGuesses.length / confidentGuesses.length : 0,
    },
    byPersonality,
  };
}

// --- CLI / output -------------------------------------------------------

function parseArgs(argv: readonly string[]): { games: number; outDir: string; quiet: boolean } {
  let games = 100;
  let outDir = path.resolve(process.cwd(), 'scripts/simulate-output');
  let quiet = false;
  for (const arg of argv) {
    if (arg.startsWith('--games=')) games = Number(arg.slice('--games='.length));
    else if (arg.startsWith('--outDir=')) outDir = path.resolve(process.cwd(), arg.slice('--outDir='.length));
    else if (arg === '--quiet') quiet = true;
  }
  if (!Number.isInteger(games) || games <= 0) throw new Error(`--games must be a positive integer, got: ${games}`);
  return { games, outDir, quiet };
}

function oneLineSummary(g: GameLog): string {
  if (g.incomplete || !g.winner) {
    return `Game ${g.gameIndex}: DID NOT FINISH within the safety-iteration cap (reached trick ${g.trickCount}, leader started at seat ${g.startingLeaderId})`;
  }
  const outcome =
    g.winner.reason === 'stalemate'
      ? 'stalemate'
      : g.winner.reason === 'quit'
        ? `ended early (quit by seat ${g.winner.quitterId})`
        : `${g.winner.team} won`;
  return `Game ${g.gameIndex}: ${outcome} in ${g.trickCount} tricks (leader started at seat ${g.startingLeaderId})`;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const { games: gameCount, outDir, quiet } = parseArgs(argv);
  await fs.mkdir(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonlPath = path.join(outDir, `run-${timestamp}.jsonl`);
  const summaryPath = path.join(outDir, `run-${timestamp}-summary.json`);

  const games: GameLog[] = [];
  const fh = await fs.open(jsonlPath, 'w');
  try {
    for (let i = 1; i <= gameCount; i++) {
      const game = playOneGame(i);
      games.push(game);
      await fh.write(JSON.stringify(game) + '\n');
      if (!quiet) console.log(oneLineSummary(game));
    }
  } finally {
    await fh.close();
  }

  const summary = aggregate(games);
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  console.log('\n--- Aggregate summary ---');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nPer-game detail: ${jsonlPath}`);
  console.log(`Summary: ${summaryPath}`);
}
