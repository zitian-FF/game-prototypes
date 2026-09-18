## Current milestone

Bot AI: final-redistribution win-lock fix (attempted stalemate reduction).
Implemented exactly as specified. Real verification at scale shows it does
NOT meaningfully reduce stalemate rate — root cause identified and
explained below. Reporting plainly per standing instruction, not shipping
this as a win.

## What was implemented

**`botAI.ts` `chooseRedistributeAction`: win-lock detection + override**

- Detection: `ownSuitCount = pool.filter(id => god(id) === ownGod).length; isWinLock = ownSuitCount === 10`
- Reuses botRole.ts's own-suit-count metric, per task suggestion
- Self-knowable only: own hand + own god
- When `isWinLock && ally !== null`: overrides role/ally branching regardless of role
  - `giveaway = pool.filter(id => god(id) !== ownGod)` (all own-suit is trivially held back — `ownSuitCount === 10` forces `keptOwnSuitCount === ownHoldback` in every branch)
  - Ally served LAST, with `allyPreferredGod = null` (no preferential ally-suit routing)
  - Two opponents served FIRST, in original contribution order
- `isWinLock && ally === null`: unaffected, falls through to unchanged Tier A logic (no ally to exclude, per spec)
- Non-win-lock: Section 5.1-5.2 completer/assist logic unchanged

**`chooseRedistributeAction` control flow, updated:**
```
if (isWinLock && ally !== null)      → NEW win-lock branch
else if (ally === null || role === 'completer') → unchanged Tier A
else                                  → unchanged Assist branch (5.1-5.2)
```

**Necessary correction to literal spec** (documented in-code and here):
"Exclude friendlyPlayer entirely... route all cards to the two non-ally
recipients" is impossible to satisfy literally when the ally is a
mandatory trick contributor — `rules/engine.ts`'s `redistribute()` hard-requires
every contributor receive their exact owed card count
(`if (gifts.length !== contribution.size) throw ...`). Implemented as:
ally gets zero PREFERENCE (no special ally-suit routing) and is served
LAST from leftovers, but still receives their mandatory count when they
are a contributor. Cannot be avoided without breaking the engine.

## Masking honesty check

`isWinLock` reads only `pool` (distributor's own hand, already read
elsewhere in this function) + `ownGod`. No new state, no other player's
hand or hidden identity read.

## Verification

`npm run typecheck`: pass
`npm run build`: pass

**Spot-check (10000-game after-run, `simulate.ts` extended with `isWinLock` per redistribution log entry):**

| Check | Result |
|---|---|
| Win-lock events with an identified ally | 864 |
| Ally NOT a contributor → correctly received 0 cards | 0 / 864 |
| Ally WAS a mandatory contributor → forced to receive something | **864 / 864** |
| Of those, ally happened to get a preferred-suit card anyway (no preference given, pure leftover chance) | 329 / 864 (38%) |

**The literal verification criterion ("ally never receives a card at win-lock") cannot be met — in every single observed case (864/864), the ally was a mandatory trick contributor.** The fix removes preference, not presence — matches the necessary correction above, not a bug.

**Before/after, matched batches (before = main branch HEAD prior to this task; after = this branch):**

| Sample size | Before | After | Δ | z | p |
|---|---|---|---|---|---|
| 2000 vs 2000 | 9.95% | 8.55% | −1.40pp | 1.53 | ≈0.13 (not significant) |
| 10000 vs 10000 | 9.63% | **9.88%** | **+0.25pp** | 0.60 | ≈0.55 (not significant, wrong direction) |

**The 2000-game result does not hold up at 10000 games — it was noise, same lesson as the prior Completer/Assist task's 500-vs-2000 finding.** At the larger, more reliable sample, stalemate rate is flat, if anything trending slightly worse (well within noise either way).

## Root cause: why this fix cannot work, proven mathematically

The giveaway pool is built via `shuffled(...)` — a proper Fisher-Yates
shuffle — before any recipient draws from it. For a uniformly shuffled
array partitioned into FIXED-SIZE contiguous chunks (chunk size = each
recipient's exact owed count, which the engine fixes regardless of any
bot preference), the **order** in which recipients claim their chunk does
not change the marginal probability that any specific card lands with
any specific recipient. This is a standard exchangeability property of
uniform random permutations. Reordering "ally last, opponents first" is
therefore provably equivalent, in expectation, to the old "no distinction,
arbitrary order" behavior — there was never a way for this specific
mechanism (reordering within an already-random draw) to change opponent-
completion risk, independent of empirical results. The 10000-game data
confirms this prediction.

**What would need to differ for a real fix:** giving opponents FEWER total
cards (not just reordering who draws first) would change the probability
landscape — but total giveaway count is fixed by trick contribution, not
adjustable by the distributor. Deliberately avoiding a SPECIFIC card that
would complete a SPECIFIC opponent is the only mechanism that could
actually reduce this risk, and that requires knowing an opponent's needed
suit — explicitly out of reach per design doc Section 6 (no
opponent-specific targeting capability exists, masking honesty forbids
guessing).

## Investigation: the ~18% of stalemates this fix cannot touch regardless

Cross-referencing the 2000-game before-run: only 163/199 (82%) of
stalemate games had `isWinLock === true` on the distributor's final
redistribution. The remaining 36/199 (18%) had `role === 'completer'`
(mono hand) but `isWinLock === false` — meaning the stalemate-causing
completion happened by some other path (e.g. a recipient completing via
a received card, independent of the distributor's own completion status).
This fix, even in the theoretical best case, could never address that
minority — not investigated further here, out of this task's scope.

## Key decisions

- Implemented the spec as literally as engine correctness allows (see "necessary correction" above), rather than silently declining or inventing an unrequested alternative mechanism
- Ran BOTH a 2000-game and a 10000-game before/after comparison specifically because the smaller sample's misleading improvement matched a known failure pattern from the prior task — did not stop at the first, more favorable-looking result
- Shipping the change anyway: it is correct, engine-safe, and matches the specified intent (no preferential treatment for an ally once the team has already won) even though it doesn't move the stalemate metric — it's not harmful, just not the fix that's needed

## Open questions

None required asking — spec was fully actionable, including the "if no ally identified: unaffected" symmetric case. Flagging for whoever picks up stalemate reduction next:
- Real progress likely requires either (a) accepting stalemates as a structural feature of masking-honest play (design doc Section 6's own stated boundary), or (b) building the opponent-specific inference capability Section 6 explicitly defers, which is a much larger scope than a redistribution tweak
- The 18% non-win-lock stalemate subset (see Investigation above) was not characterized — may have a different, addressable root cause

## Known issues

None in shipped code (spot-checked, correct). The fix is empirically ineffective at its stated goal — documented as a known limitation, not a defect: implemented and verified exactly as specified, real data shows no meaningful stalemate-rate change.

## Next proposed step

Do not pursue further redistribution-ordering tweaks for stalemate reduction — mathematically proven ineffective by this task. If stalemate reduction remains a priority, next options are (a) investigate the 18% non-win-lock stalemate subset for a distinct, addressable mechanism, or (b) treat current stalemate rate (~9.5-10%) as accepted baseline behavior under current masking-honesty constraints and move on to Section 5.3 / personalities per the design doc's own recommended order.
