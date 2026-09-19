## Current milestone

Bot AI Section 5.3: Suit-Cycle lead-engineering for a confirmed ally.
Implemented as specified. Real verification at 10000 games: statistically
significant improvement in ally-guess accuracy (39.2%→41.2%, p≈0.017);
trick-count median/mean essentially unchanged; full end-to-end mechanism
traced and confirmed working in a real game. Matches the task's own
"measurable but not total improvement" expectation exactly.

## Context discrepancy, flagged upfront

The task's stated "current floor=0.3 lean baseline (median 29, mean 93,
max 8262, accuracy 69.0%)" does not correspond to anything in this
repository. `botTrust.ts` has no `bestGuessAlly`/"lean"/floor mechanism -
`identifyFriendlyAlly` is the only function, already strict (hard
threshold, binary null-or-confirmed). Checked all `proto/suits-mp/*`
remote branches for related unmerged work - none exists. Proceeded by
measuring a fresh, real baseline from current `main` (median 23, mean
25.9-26.1, ally accuracy 39.2-39.7% across 2000/10000-game runs) and
comparing against that, per this project's standing verification
practice. The GATE requirement ("STRICT, not lean") is satisfied by
construction, since no lean variant exists to accidentally use.

## What was implemented

**`botAI.ts`: new `chooseSuitCycleLeadForAlly(slot, ally, notNeeded)`**

- GATE (enforced at the only call site): `determineRole(state, slot) === 'assist'` AND `identifyFriendlyAlly(state, slot) !== null` - strict, no fallback guess
- For each card in `notNeeded` (Section 3's own-suit-exclusion already applied): compute the position (1-3) where `requiredSuitForPosition(position, candidateGod) === ally.friendlyPlayerDeity`, reusing `engine.ts`'s own function, not reimplemented
- Exclude: target position === `allySeatOffset` (would force the ally itself to leak)
- Prefer: target position is one of the two opponent seats
- No qualifying card → return `null`, caller falls through to Section 3's unchanged `pickRandom(notNeeded)` baseline

**`choosePlayCardAction` leading branch**: tries `chooseSuitCycleLeadForAlly` first when the gate passes; falls back to existing behavior unchanged otherwise (byte-identical for Completer, no-ally, and no-valid-target cases).

**`scripts/simulate.ts`**: added `leadChoices` per-game log (role/ally/led-card at lead time) and `suitCycleTarget` (independently recomputed via the same `requiredSuitForPosition`/`turnOrder`, not read from bot internals) - verification-only, does not affect game logic.

## Masking honesty check

Reads only: own hand (`notNeeded`), own seat (`slot`), and `identifyFriendlyAlly`'s own output (`friendlyPlayer`, `friendlyPlayerDeity` - already masking-verified in an earlier task). No other player's hand or hidden identity read. `requiredSuitForPosition`/Suit Cycle math is public game structure, not hidden state.

## Verification

`npm run typecheck`: pass
`npm run build`: pass

**Before/after, matched batches (before = main branch HEAD prior to this task; after = this branch):**

| Metric | 2000 before | 2000 after | 10000 before | 10000 after | Verdict (10000, more reliable) |
|---|---|---|---|---|---|
| Trick count median | 23 | 23 | 23 | 23 | Unchanged |
| Trick count mean | 25.87 | 25.82 | 26.09 | 26.13 | Unchanged (noise) |
| Trick count max | 332 | 144 | 231 | 389 | Noise-dominated, no reliable direction |
| Ally-guess accuracy | 39.7% | 41.8% | 39.2% | **41.2%** | **Real, significant** (z≈2.40, p≈0.017) |
| Stalemate rate | 9.2% | 9.6% | 9.69% | 9.86% | Unchanged (noise) |

The 2000-game max-trick-count drop (332→144) looked promising but did not
hold at 10000 games (231→389, wrong direction) - same noise lesson as
every prior task in this series. The one metric that DOES hold up at
scale is ally-guess accuracy, a real ~2pp gain.

**Funnel, from a real 10000-game run (`leadChoices`/`tricks`/`redistributions` cross-referenced):**

| Stage | Count |
|---|---|
| 5.3 fires (finds a valid opponent-targeting lead) | 32277 |
| ...opponent genuinely forced to reveal AND leader wins that trick | 2982 (9.2% of fires) |
| ...ally receives a matching card in the very next redistribution | 2120 (71% of the above) |

**Real traced example (game 17, trick 7)**: Player 2 (ShubNiggurath, role=assist, ally=Player 1/YogSothoth) leads Nyarlathotep-10. Suit Cycle: position 1 (Player 3, an opponent) required suit = YogSothoth. Player 3, forced, plays YogSothoth-3. Player 2 wins the trick (rank 10 beats 3/3/7). Redistribution: Player 1 (the ally) receives YogSothoth-3 - the exact extracted card. Full mechanism confirmed working end-to-end on real data.

## Key decisions

- Collected qualifying CARDS (not suits-then-card) into the candidate pool for `pickRandom` - avoids a `Set` iteration-order bias that would have favored whichever suit happened to appear first in hand order
- `candidateGod === allyGod` naturally excluded by the position-1-to-3 loop (never matches, since those positions cover the 3 OTHER suits in the cycle) - no separate special case needed
- Kept `chooseSuitCycleLeadForAlly` as a pure function taking `notNeeded` as a parameter, rather than recomputing it - avoids duplicating Section 3's own-suit filter

## Open questions

None required asking for the implementation itself. The task's stated baseline numbers not matching the repository (see discrepancy section above) was resolved by measuring fresh, real data rather than blocking - flagging here in case the referenced "lean" work exists elsewhere and should be reconciled.

## Known issues

None in shipped code (real end-to-end mechanism verified on live data). As the design doc itself predicted, this is a partial mitigation: most tricks are led by someone other than the Assist, entirely outside 5.3's control - trick-count median/mean are unaffected, only the (already-working) ally-delivery accuracy improved.

## Next proposed step

Per design doc Section 10: re-run simulation after each Section 5 step, watching stalemate rate and ally-guess accuracy specifically - done here. Next candidates: (a) Section 7 personality parameterization of role-commitment strength, now that the base role/trust/lead-engineering system is solid, or (b) accept current stalemate rate (~9.5-10%, flat across every fix attempted in this series so far) as the practical floor under current masking-honesty constraints and move on.
