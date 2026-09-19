## Current milestone

Bot AI Section 7: Personality archetypes (Rusher/Hoarder/Balanced/Wildcard).
Implemented as specified: mechanic 1 (rank preference within Section 3's
existing candidate sets), mechanic 2 (small role-threshold bias in
botRole.ts), mechanic 3 (Wildcard per-trick mode roll, no mid-trick
re-roll). Verified at 10000 games. Core game-health metrics unchanged vs
baseline. Per-personality breakdown confirms mechanic 2 works as designed
(Rusher/Hoarder pull the assist/completer split ~20pp in opposite
directions from Balanced's midpoint).

## What was implemented

- New `host/botPersonality.ts`: `Personality` (rusher/hoarder/balanced/
  wildcard), `PersonalityMode` (aggressive/conservative/neutral),
  `BotPersonalityState`, `createBotPersonality(s)`, `resolveMode(bot,
  trickNumber)`. Random assignment per seat per game, host-side only, not
  exposed to masked state/UI. The ONE deliberate exception to this bot
  AI's "pure function of (state, slot)" principle: personality (fixed per
  game) and Wildcard's per-trick roll (cached by trickNumber) are
  inherently stateful and live entirely outside canonical `GameState`.
- `botRole.ts`: `determineRole(state, slot, mode)` — new optional `mode`
  param, default `'neutral'`. Applies `PERSONALITY_ROLE_BIAS = 0.1` to the
  existing `ownSuitFraction` before thresholding (aggressive: -0.1,
  conservative: +0.1). Does not touch the mono/mixed determination itself,
  only nudges near-boundary hands.
- `botAI.ts`: `cardRankValue(id)` (raw face rank 2-10, DeityCard=11),
  `pickByPersonality`/`pickCardByPersonality` (mechanic 1). Applied to
  every Section 3 card-choice `pickRandom` site in `choosePlayCardAction`
  (leading fallback/baseline, all 4 must-follow-suit branches, off-suit
  final move). NOT applied to `chooseSuitCycleLeadForAlly` (5.3) or the
  Double-generation `shuffled(ofRank)` (no highest/lowest concept for a
  same-rank pair). `chooseBotAction(state, slot, personality)` resolves
  `mode` once via `resolveMode(personality, state.trickNumber)` and threads
  it into both `choosePlayCardAction` and `chooseRedistributeAction`.
- `HostGameScene.ts`: `botPersonalities` created once in `create()`,
  passed into `chooseBotAction` in `driveBotsIfNeeded`.
- `scripts/simulate.ts`: personality assigned per game, logged per player;
  new `Aggregates.byPersonality` breakdown (seatInstances, winRate,
  averageTrickCountOfGamesInvolved, decisionPoints, assistRoleShare) per
  archetype.

## Key technical decisions

- Personality lives outside `GameState` (not a `PlayerState` field) —
  avoids masking/network-payload changes for a bot-AI-only feature, and
  matches the task's "do not expose to player-facing UI" instruction.
- Mechanic 1 uses raw face rank, not the dynamic Dormant/Powered-adjusted
  `scoreOf` used for real trick-winning — a simple, consistent "which
  card" preference layered on Section 3's already-decided candidate set,
  not a second opinion on whether it wins.
- Redistribution isn't a named Section 3 decision point ("leading,
  following, off-suit"), so `chooseRedistributeAction` only receives
  `mode` for mechanic 2 (role bias), no mechanic-1 changes there.
- No UI/rendering changes in this task — Playwright screenshot check
  skipped, consistent with this series' established pattern for bot-AI-
  only tasks (see prior Section 5.3 BUILD_STATUS.md).

## Verification

`npm run typecheck`: pass
`npm run build`: pass (suits-mp bundle 299.35 kB / gzip 87.11 kB)

**Mechanic 3 spot-check** (targeted code-level check, 2000 trials): a
Wildcard's `resolveMode` called repeatedly with the same `trickNumber`
(simulating a lead choice, a follow, and a same-trick redistribution)
returned the identical mode in all 2000/2000 trials; calling it again with
`trickNumber + 1` correctly updates the cached roll. Confirms "no re-roll
mid-trick" and "same trick's mode applies to both mechanic 1 and mechanic
2" by construction, not just by observation.

**10000-game run** (9999 completed, 1 incomplete — hit the existing
500,000-iteration safety cap):

| Metric | Baseline (prior task) | This run (10000 games) | Verdict |
|---|---|---|---|
| Trick count median | 23 | 23 | Unchanged |
| Trick count mean | 26.09-26.13 | 25.92 | Unchanged (within noise) |
| Ally-guess accuracy | 39.2-41.2% | 39.6% | Unchanged (within range) |
| Stalemate rate | 9.69-9.86% | 9.44% | Unchanged (within noise) |

No regression to core game health from adding personalities.

**Per-personality breakdown** (the actual point of the feature):

| Personality | Win rate | Avg trick count | Assist role share |
|---|---|---|---|
| Rusher (aggressive) | 48.0% | 26.50 | **69.8%** |
| Hoarder (conservative) | 50.9% | 25.53 | **32.4%** |
| Balanced (neutral) | 50.2% | 26.03 | 50.6% |
| Wildcard (oscillating) | 50.9% | 25.62 | 51.9% |

Mechanic 2 shows a clear, correctly-directioned effect at full scale:
Rusher pulls ~19pp toward assist, Hoarder pulls ~18pp toward completer,
relative to Balanced's ~50.6% midpoint — matches design intent exactly
(aggressive → assist bias, conservative → completer bias). Wildcard sits
close to Balanced (51.9% vs 50.6%), consistent with its 50/50 per-trick
oscillation averaging out over many decisions across a game. Win-rate
spread is small (48.0-50.9%, Rusher lowest) — a minor, plausibly
noise-level effect; personality isn't tied to team assignment, so team
balance dominates win rate far more than personality does. Trick-count
differences between personalities are also small (25.5-26.5).

**Performance side-finding (investigated, not fixed — out of scope)**:
a small fraction of games run extremely long (tens of thousands of
tricks) and take disproportionate wall-clock time. Root-caused to a
pre-existing property of `GameState.receivedLog` (rules/types.ts) — a
cumulative, ever-growing per-player array rebuilt immutably on every
redistribution, making per-redistribution cost, and therefore total game
cost, scale roughly O(n²) with trick count. This was already latent
before this task (previously observed max trick counts up to ~21566 in
this series' history) but rarely mattered since games were almost always
short. In a 5000-game diagnostic batch, 3 games hit the 500,000-iteration
safety cap, each taking ~167s; all 3 involved a Rusher personality,
suggesting Rusher's deterministic highest-rank tie-breaking (replacing
Section 3's prior uniform-random tie-break) increases the odds of an
extremely long game, which then exposes the pre-existing O(n²) cost more
than before. This is core engine/redistribution-log architecture, not
Section 7 decision logic — fixing it is out of this task's scope
(explicitly: "personality only modulates card-choice-within-candidates
and role-threshold-bias, never the underlying decision logic"). Flagged
here for a future task.

## Open questions

None required asking the user mid-session; BRIEF.md/task spec were
unambiguous on all mechanics.

## Known issues

- `GameState.receivedLog`'s O(n²)-with-trick-count cost (see performance
  side-finding above) — pre-existing, not introduced by this task, but
  personality (specifically Rusher) appears to increase how often it's
  hit. Not fixed here (out of scope).
- Personality assignment is host-side and per-game only; no persistence,
  no player-facing indicator (matches task scope).

## Next proposed step

Either: (a) address the `receivedLog` O(n²) cost directly (separate,
engine-level task, benefits every bot-AI feature not just personalities),
or (b) accept current stalemate rate (~9.4-9.9%, flat across every fix in
this series) as the practical floor and move to a different area of the
design doc.
