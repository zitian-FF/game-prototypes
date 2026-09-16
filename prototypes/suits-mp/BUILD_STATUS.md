## Current milestone

Self-play simulation & logging infrastructure: a standalone Node script
(`npm run simulate`) that runs full games with all four seats
bot-controlled, driving the real, unmodified `rules/engine.ts` /
`host/gameHost.ts` / `host/botAI.ts` directly - no Phaser, no rendering,
no networking. Dev/analysis tool only, not reachable from the actual
game UI. Used it to run a real 100-game verification batch, which
surfaced a genuine, previously-unmeasured property of the current bot
AI: a heavy-tailed trick-count distribution (see "Verification" below).

## What was implemented

**`scripts/simulate.ts`** - the actual simulation logic:
- `playOneGame(gameIndex)`: calls `gameHost.createInitialState()`, then
  loops `engine.activePlayerId(state)` -> `botAI.chooseBotAction(state,
  slot)` -> `gameHost.applyAction(state, slot, action)` until `phase ===
  'gameOver'`. This is exactly the same `applyAction`/`settleAutoPhases`
  path a real peer's action goes through (see `host/gameHost.ts`'s own
  doc comment: "used identically for real peer actions and for
  host-local bot actions") - the simulation adds no separate rules path
  of its own.
- Per-game logging is built entirely from real engine output, not
  fabricated commentary:
  - **Tricks**: detected by reference-comparing `state.lastTrickResult`
    before/after each `applyAction` call (a new object only appears
    there when a trick actually completed) and logged straight from
    that `TrickResult` - lead suit (derived from the first play's
    card), each seat's play (card names/ids, kind, required suit,
    Dormant/Powered state), winner, and whether it was won by Single or
    Double. No per-play "why" is invented; `playType` in a bot's
    `playCard` action is informational only per `host/botAI.ts`'s own
    comment, so the logged `kind`/`requiredSuit`/`deityCardState` come
    from the engine's own recorded `TrickPlay`, never from the action
    the bot sent.
  - **Redistributions**: logged directly from the bot's own
    `{ action: 'redistribute', assignments }` at the moment it's
    chosen, plus the distributor's real god/team from `state` - this is
    the one place real decision-influence exists (Tier A self-interest,
    see `host/botAI.ts`'s `chooseRedistributeAction`), so distributor
    identity/god is logged clearly against the resulting assignments.
  - **Delegate selections**: logged as the real winner/delegate pair
    from a `selectDelegate` action - still uniform-random, so only the
    outcome is recorded, no invented rationale.
  - **Final result**: winning team, reason (`'suit'`/`'stalemate'`;
    `'quit'` is handled in the type but can never actually occur in
    self-play - bots never send `endGame`), trick count, and every
    player's real god + team (via `rules/cards.ts`'s `GOD_TEAM`).
- A safety cap (`MAX_ITERATIONS = 500000` actions) guards against a
  genuine non-terminating cycle. If hit, that one game is logged as a
  real, honest `incomplete: true` fact (not thrown as a crash) and the
  batch continues - see "Verification" for why this cap exists and why
  it's set where it is.
- `aggregate(games)` computes: win rate by team, stalemate rate, win
  rate by starting Lead Player **seat position** (0-3) - specifically
  whether the team of whoever started as Lead Player in that seat won,
  which is the structural signal the task asked for (does turn order
  itself create an edge, independent of the random god/team deal) -
  trick-count min/max/average/median, and total tricks played +
  double-win share (falls out naturally from the trick log with no new
  computation). Incomplete games are excluded from every rate/count
  stat but reported as their own count.
- Output: one JSON line per game (`scripts/simulate-output/run-
  <timestamp>.jsonl`, full detail - every trick/redistribution/delegate
  event) plus a one-line human-readable summary printed to stdout as
  each game finishes, plus a final aggregate JSON written to both
  `scripts/simulate-output/run-<timestamp>-summary.json` and stdout.
  `scripts/simulate-output/` is gitignored - generated data, not
  checked in.

**`scripts/run-simulate.mjs`** - a thin launcher. `simulate.ts` imports
the game's real sources using the same extensionless, bundler-resolved
TS imports those files already use everywhere else in the repo (e.g.
`from './cards'`), so it's loaded through Vite's own SSR module graph
(`createServer({ configFile: false, server: { middlewareMode: true } })`
+ `server.ssrLoadModule(...)`) rather than adding a TS-execution
package (`tsx`/`ts-node`) as a new dependency just for this one script -
Vite is already a project dependency and already knows how to resolve
and transform these exact files, since it's the same resolution the
real browser build uses.

**Wiring**: `package.json` gained `"simulate": "node
scripts/run-simulate.mjs"`. Root `tsconfig.json`'s `include` gained
`"scripts"` so `scripts/simulate.ts` is actually type-checked by `npm
run typecheck` (previously only `prototypes`/`vite.config.ts`/`env.d.ts`
were roots - `scripts/*.js` files were never type-checked before this
and still aren't, since `allowJs` is off; only the new `.ts` file is
affected). `.gitignore` gained `scripts/simulate-output/`.

No game logic, bot AI, or UI file was touched - confirmed by `git diff
--stat` showing only new files under `scripts/` plus the three
wiring-only edits above.

## Verification

`npm run typecheck` and `npm run build` both pass cleanly (build output
is unaffected - `scripts/simulate.ts` isn't part of any Vite build
entry, confirmed by comparing the build's asset list before/after).

Before trusting the tool's own output, cross-checked one small real
game's JSONL log entry by hand against the engine's actual rules:
trick 1's leader held `YogSothoth-2` and opened with it (the forced
trick-1-opener rule); required suits followed the fixed cycle
(YogSothoth -> Cthulhu -> ShubNiggurath -> Nyarlathotep) exactly;
manually recomputing `scoreOf` for all four logged plays picked the
same `winnerId` the log recorded; the resulting redistribution's
per-recipient card counts matched each contributor's actual play size.
The tool's logged facts match the real engine's real computation.

**Real 100-game verification run** (`npm run simulate -- --games=100`,
completed in ~4s):

```json
{
  "totalGamesRequested": 100,
  "completedGames": 100,
  "incompleteGames": 0,
  "winsByTeam": { "Chaos": 52, "Cosmos": 48 },
  "stalemates": 0,
  "winRateByTeam": { "Chaos": 0.52, "Cosmos": 0.48 },
  "stalemateRate": 0,
  "winRateByStartingLeaderPosition": {
    "0": { "games": 26, "leaderTeamWins": 17, "stalemates": 0, "leaderTeamWinRate": 0.6538 },
    "1": { "games": 25, "leaderTeamWins": 9,  "stalemates": 0, "leaderTeamWinRate": 0.36 },
    "2": { "games": 31, "leaderTeamWins": 15, "stalemates": 0, "leaderTeamWinRate": 0.4839 },
    "3": { "games": 18, "leaderTeamWins": 11, "stalemates": 0, "leaderTeamWinRate": 0.6111 }
  },
  "trickCount": { "min": 22, "max": 13088, "average": 977.07, "median": 119 },
  "totalTricksPlayed": 97707,
  "doubleWinTrickShare": 0.0402
}
```

Sanity read: win rate is close to even (52/48, not lopsided), no
crashes or rejected bot actions across ~98k logged tricks, every game
reached a real `gameOver`. The per-seat `leaderTeamWinRate` spread
(36%-65%) is a real, if noisy, structural signal worth more games to
firm up - not something this task is scoped to act on, just to surface.

**Genuine finding, not a script bug**: trick counts are extremely
heavy-tailed. Most games finish under ~250 tricks, but this 100-game
batch alone produced five games over 3000 tricks (up to 13088), and a
smaller side-probe (30 games, 300k-action cap) found one game running
108k+ actions / 21566 tricks before finishing - still a real `gameOver`,
never a true infinite loop (0/30 hit the cap even at 300k). This is
real behavior of the current bot AI under the GDD's "No Trick Limit"
rule: only redistribution has any self-interest logic (Tier A); card
play and delegate choice are uniform-random, so nothing pushes a game
toward completing a suit, and by chance a game can cycle for a very
long time before one happens to accumulate. The simulation's
`MAX_ITERATIONS` safety cap (500000 actions) exists only to catch a
genuine non-terminating cycle, comfortably above every real duration
observed; hitting it would be logged as `incomplete: true` (a real
fact) rather than crashing the batch, but this never happened across
either verification run.

No game hung or threw past a real cause during verification; the one
early crash while developing this script (a 10000-action cap tripping
on a legitimately long game, not a stuck loop) was root-caused via the
side-probe above before raising the cap - see "Known issues" for why
this is flagged as a real design signal rather than closed out as
"just a script bug."

## Key technical decisions

- Loaded via Vite's `ssrLoadModule` rather than adding `tsx`/`ts-node`
  as a new devDependency - per CLAUDE.md's stack-discipline rule ("do
  not add dependencies to solve problems the stack already solves"),
  and Vite already resolves/transforms these exact extensionless TS
  imports for the real browser build, so this reuses proven resolution
  rather than introducing a second one.
- Trick/redistribution/delegate logging reads its facts from the
  engine's own recorded state (`TrickResult`, the bot's own emitted
  `ClientAction`) rather than re-deriving or annotating with invented
  reasoning - per the task's explicit "real facts only" requirement,
  since card-play choice and delegate choice have no real decision
  logic to describe yet.
- The safety cap fails soft (marks one game `incomplete`, continues the
  batch) rather than hard (throws, kills the run) - a single
  pathological game in a large batch shouldn't discard every other
  game's real data, and a cap-hit is itself a fact worth keeping, not
  an error to hide.
- `winRateByStartingLeaderPosition` is keyed by seat **position**
  (0-3), not by god/team - team assignment is randomized every game, so
  only seat position is the fixed, comparable axis across games for
  asking "does turn order create a structural edge."

## What's general vs. specific

**General, reusable as-is:** the Vite-`ssrLoadModule` pattern for
running any pure-logic TS module from this repo as a plain Node script
without a new TS-execution dependency; the `run-simulate.mjs` launcher
itself has nothing suits-mp-specific in it.

**Specific to this tool:** `scripts/simulate.ts`'s log shapes and
aggregate stats are built around suits-mp's own `GameState`/`WinInfo`/
`ClientAction` types and would need adapting (not reuse as-is) for any
other prototype's own engine.

## Open questions

None arose that needed asking - the task's spec was explicit about
scope (standalone script, not UI-reachable), what to log (real facts
only, no fabricated reasoning), and what aggregates to compute.

## Known issues

None in the shipped script. The heavy-tailed trick-count distribution
described under Verification is not a bug in this tool or in the
engine - it's a real, now-measured property of the current legal-random
+ Tier-A-only bot AI under "No Trick Limit," worth keeping in mind for
whoever next works on bot AI (a smarter, suit-seeking bot would likely
shorten this tail considerably) or on any future feature that assumes
games stay short.

## Next proposed step

Now that this tool exists, natural follow-ups (not started, since this
task was scoped to the tool itself): run a much larger batch (1000+
games) to firm up the noisy per-seat win-rate signal seen in this
100-game run; and once bot AI gains a Tier B (teammate-aware) or
smarter card-play tier, re-run the same simulation to measure whether
it shortens the heavy tail and shifts team win rates, using this same
tool unmodified.
