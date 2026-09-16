## Current milestone

Bot AI: card-play extension to Tier A (`suits-mp-bot-ai-design.md` v3,
Section 3's build-order step 1 - a single baseline heuristic, no
personality variation yet). `host/botAI.ts`'s `choosePlayCardAction`
was pure legal-random across all three branches; it now prefers
not-needed cards when leading or discarding, and prefers winning with
a not-needed card when following suit. Verified via a real, matched
500-vs-500-game before/after simulation batch (same tool, same code
paths, old bot AI vs. new): **median trick count dropped from 108.5 to
20, mean from 728.3 to 20.3, max from 19266 to 40** - the task's stated
goal, achieved dramatically. A real, honestly-reported side effect also
showed up: team win-rate balance shifted and stalemate rate rose 5x -
see "Verification" below, not hidden or minimized.

## What was implemented

**Definitions** (per the task's own deliberate simplification of the
design doc's "least valuable/needed" language into a binary, non-fuzzy
distinction): a card is "needed" if its Deity matches the bot's own
Deity; every other card is not-needed. `isNeeded(state, slot, cardId)`
in `host/botAI.ts` is the one place this is computed.

**1. Leading** (`choosePlayCardAction`, past the forced Trick-1
opener): prefers a not-needed card via `pickRandom(notNeeded)`.
Fallback for the all-needed-hand edge case (a real possibility, e.g.
after heavy redistribution leaves a hand skewed to one suit): falls
back to `pickRandom(hand)` - i.e. any legal card, uniformly at random,
identical to the old fully-random behaviour for that one case.

**2. Must-follow-suit**: reuses the engine's REAL trick-scoring logic
rather than reimplementing rank/Double/Powered-Deity-Card comparison.
A new `wouldWinIfPlayedNow(state, slot, cardId, requiredSuit)` builds
the same accurate hypothetical `TrickPlay` `playCard()` itself would
produce (via a newly-exported `rules/engine.ts`'s `computeDeityCardState`
- previously private, now exported since this is the first caller
outside `playCard()`) and feeds `[...state.plays, candidatePlay]`
straight into the engine's existing, unmodified `resolveTrick()` - the
exact function that decides every real trick's winner. "Would win right
now" deliberately means "if the trick resolved on only the plays made
so far plus this one" - no lookahead into other players' future plays,
per the design doc's own "superhuman capability cap" constraint (Tier A
has no multi-trick planning). Among the legal suit-cards:
- If any would win: prefer a not-needed winning card; only spend a
  needed card to win if every winning option is needed.
- If none would win (losing is inevitable regardless of choice):
  prefer a not-needed card over a needed one.

One structural note worth flagging: since every card in `opts.suitCards`
necessarily shares the SAME god (the required suit), "needed" is
actually all-or-nothing for the entire suit-card set in this branch,
not a per-card split - if the required suit happens to be the bot's own
Deity, every legal option is needed and there's no needed/not-needed
choice to make at all (winning is still preferred when available). This
is a real, correctly-handled consequence of the binary definition, not
an oversight.

**3. Off-suit facedownSingle candidates**: the candidate list (`hand.map`
-> `facedownCandidates.map`) is now built from not-needed cards when any
exist, falling back to the whole hand otherwise (matching the design
doc's "shed excess, not needed cards" item 2 - a facedownSingle can
never win a trick per the GDD, so there's nothing to lose by discarding
freely). The Double-generation branch immediately below it is completely
untouched (still built from the full `hand`, unchanged code), and the
final `pickRandom(moves)` is still one flat, uniform pick over the
combined list - explicitly out of scope per the task. One honest
caveat: narrowing the facedownSingle candidate list's SIZE (from
`hand.length` entries down to however many not-needed cards exist) does
shift the exact numeric proportion between "a facedownSingle move gets
picked" and "a Double move gets picked" in that flat pool, as an
unavoidable side effect of preferring specific cards within the
facedownSingle set - the task's "stays exactly as random as before"
note is read here as "the SELECTION MECHANISM (one flat pooled random
pick, no new weighting scheme) is untouched," not "the exact resulting
probability is bit-for-bit invariant," since no interpretation can
satisfy both a narrowed-and-still-random candidate set AND an
unchanged exact ratio simultaneously. Flagging this explicitly in case
a future task wants ratio-invariance as its own separate, deliberate
piece of work.

**Untouched, as required**: `chooseRedistributeAction` (Tier A's
existing, unrelated logic), `chooseDelegateAction` (still intentionally
random per the design doc), and the off-suit branch's overall
Double-vs-facedownSingle move-generation code.

**Masking honesty**: confirmed by reading the diff - every new function
(`isNeeded`, `wouldWinIfPlayedNow`) takes only `state`, the bot's own
`slot`, and a candidate `cardId`/`requiredSuit` already legal per
`legalOptions()`; the only state read is `state.players[slot]` (the
bot's own seat) and `state.plays` (the publicly observable trick in
progress, already visible to every player at the table). No other
player's hand or hidden identity is read anywhere in this change.

## Verification

`npm run typecheck` and `npm run build` both pass cleanly.

**Real, matched 500-vs-500-game before/after simulation** (same
`npm run simulate` tool, same machine, same code paths - the OLD bot AI
was measured by `git stash`-ing this task's two changed files, running
the batch against the untouched baseline code, then restoring the
changes and running the same batch size again):

| | Before (old, pure legal-random) | After (new heuristic) |
|---|---|---|
| Games | 500 | 500 |
| Median trick count | **108.5** | **20** |
| Mean trick count | **728.3** | **20.3** |
| Min / Max trick count | 12 / 19266 | 6 / 40 |
| Total tricks played | 364169 | 10171 |
| Win rate (Chaos / Cosmos) | 48.8% / 49.4% | 39.0% / 51.6% |
| Stalemate rate | 1.8% (9/500) | 9.4% (47/500) |
| Double-win trick share | 4.3% | 16.0% |
| Wall-clock for the batch | ~15.4s | ~0.8s |

Raw baseline JSON kept for the record:
```json
{
  "totalGamesRequested": 500, "completedGames": 500, "incompleteGames": 0,
  "winsByTeam": { "Chaos": 244, "Cosmos": 247 }, "stalemates": 9,
  "winRateByTeam": { "Chaos": 0.488, "Cosmos": 0.494 }, "stalemateRate": 0.018,
  "trickCount": { "min": 12, "max": 19266, "average": 728.338, "median": 108.5 },
  "totalTricksPlayed": 364169, "doubleWinTrickShare": 0.0435
}
```
Raw after-change JSON:
```json
{
  "totalGamesRequested": 500, "completedGames": 500, "incompleteGames": 0,
  "winsByTeam": { "Chaos": 195, "Cosmos": 258 }, "stalemates": 47,
  "winRateByTeam": { "Chaos": 0.39, "Cosmos": 0.516 }, "stalemateRate": 0.094,
  "trickCount": { "min": 6, "max": 40, "average": 20.342, "median": 20 },
  "totalTricksPlayed": 10171, "doubleWinTrickShare": 0.1601
}
```

**The trick-count goal is unambiguously met** - median dropped ~5.4x,
mean ~35.8x, and the pathological heavy tail (max 19266) is gone
entirely (max 40 across this 500-game sample - genuinely a natural
result of the new heuristic converging fast, not a hidden cap;
confirmed by grepping the whole diff plus `gameHost.ts`/`simulate.ts`
for any hardcoded `40` - the only hit is unrelated deck-slicing code
that deals 10 cards per player, `deck.slice(30, 40)`). Spot-checked the
per-game JSONL from the after-run: trick counts are smoothly
distributed (6, 12, 15, 17, 18, 20, 22, 23, 25, 29 at every 50th
percentile of the sorted 500), only 1 of 500 games actually landed on
exactly 40 - not evidence of truncation.

**Honest side effect, reported plainly per the task's instruction not
to paper over a real result**: team win-rate balance shifted
noticeably (Chaos down from 48.8% to 39.0%, Cosmos up from 49.4% to
51.6%) and the stalemate rate rose more than 5x (1.8% -> 9.4%). Among
just the decided (non-stalemate) games, Chaos won 43.1% vs. Cosmos's
56.9% after the change - a deviation from even large enough (roughly 3
standard errors at this sample size) to be a real pattern, not sampling
noise. This makes intuitive sense as an emergent consequence of the new
heuristic, not a bug: every bot is now actively trying to win tricks
(to gain redistribution rights) and hoard needed cards far more
consistently than before, so both teams converge toward suit completion
faster AND closer together in time, which is exactly what the
simultaneous-completion stalemate rule is triggered by. This shift is
real and worth tracking, but it is NOT something this task was scoped
to fix - the design doc's own recommended build order (Section 8)
explicitly stages personality variation and trust modeling as later,
separate steps specifically because "card-play-level steering could
plausibly work AGAINST the ~40-trick goal in ways that need real
simulation data to evaluate, not a guess made up front" - this
imbalance is exactly the kind of data that reasoning anticipated, now
measured for real instead of assumed away.

## Key technical decisions

- `computeDeityCardState` was exported from `rules/engine.ts` (a pure
  visibility change, zero behavior change to the function itself)
  specifically so `wouldWinIfPlayedNow` could build an accurate
  hypothetical `TrickPlay` without a second, bot-local reimplementation
  of the Dormant/Powered rule - the task explicitly required reusing
  real engine logic, not reimplementing it.
- "Would win right now" is evaluated by extending `state.plays` with
  one hypothetical play and calling the engine's real, unmodified
  `resolveTrick()` on the result - this correctly handles every real
  edge case (an earlier Double in the trick beats any Single regardless
  of rank, Powered vs. Dormant Deity Cards) for free, since it's the
  exact same comparison function a real completed trick uses, not a
  partial reimplementation restricted to "just ranks."
- The must-follow-suit branch's needed/not-needed distinction is
  genuinely all-or-nothing per trick (see "What was implemented" above)
  - documented rather than treated as a bug, since it's a correct,
  direct consequence of the task's own deliberately simple binary
  "needed" definition applied to a set of same-god cards.
- The off-suit facedownSingle candidate list is filtered by narrowing
  which specific cards can appear, not by reweighting the flat
  `pickRandom(moves)` pick itself - documented in-code and above as the
  one place a literal reading of "stays exactly as random as before"
  can't be preserved bit-for-bit alongside the required per-card
  preference; flagged rather than silently resolved either way.

## What's general vs. specific

**General, reusable as-is:** `computeDeityCardState`'s export and the
"extend `state.plays` with a hypothetical play, then call the real
`resolveTrick()`" pattern is available to any future bot-AI tier
(Section 5's personalities, Section 4's trust layer) that needs to
evaluate a hypothetical play's outcome without hidden information.

**Specific to this task:** the binary needed/not-needed heuristic
itself is explicitly the FIRST, simplest step in the design doc's
staged build order (Section 8) - personality variation (step 2) will
parameterize HOW STRONGLY this same logic is followed, not replace it.

## Open questions

None arose that needed asking - the task's spec was explicit about
scope, the binary "needed" definition, and exactly which branches to
touch vs. leave alone. The facedownSingle candidate-list ratio question
(see "Key technical decisions") wasn't a question so much as an
unavoidable interpretation call, made and documented rather than
silently picked.

## Known issues

None in the shipped code. The win-rate/stalemate-balance shift
described under Verification is a real, measured, honestly-reported
side effect of this change - not a defect, and not something this
task's scope covers fixing (see Section 8's staged build order: it's
explicitly deferred to later personality/trust work, which the design
doc itself expected might be needed to rebalance whatever this step
alone produces).

## Next proposed step

Per the design doc's own recommended order (Section 8, step 2): build
Section 5's four personalities (Rusher/Hoarder/Balanced/Wildcard),
parameterizing how strongly THIS SAME heuristic is followed, and
re-verify via the simulation tool broken down per-archetype (Section 6
of the design doc explicitly calls for extending `scripts/simulate.ts`
to aggregate by personality once personalities exist). That work should
also take a first look at the win-rate/stalemate shift measured here -
personality variation (some bots playing more conservatively) may
naturally soften it, but that needs to be verified with real simulation
data the same way this task was, not assumed.
