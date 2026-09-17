## Current milestone

Bot AI Section 5.1-5.2: Completer/Assist redistribution + repurposed trick
control. Design doc: suits-mp-bot-ai-design.md v6, Section 5 (unchanged
from v5).

## What was implemented

**New file `host/botRole.ts`**
- `determineRole(state, slot): 'completer' | 'assist'`
- Metric: own-suit fraction of hand (`ownSuitCount / hand.length`)
- Threshold: `ROLE_MONO_THRESHOLD = 0.5` (placeholder, not tuned)
- `>= 0.5` own-suit → completer, else → assist
- Pure function of `(state, slot)`, no caching, re-evaluated every call
- Reads only `state.players[slot]` (own hand/god)

**`botAI.ts` `chooseRedistributeAction` rewritten**
- Branch on `role = determineRole(...)`, `ally = identifyFriendlyAlly(...)`
- `ally === null || role === 'completer'` → byte-identical old Tier A logic (unchanged)
- `role === 'assist' && ally !== null` → new logic:
  - 4-way pool split of distributor's hand: ownHighRank (9/10/DeityCard of own god), ownLowRank (own god, other ranks), allySuit (`ally.friendlyPlayerDeity`), genericOther
  - Holdback fill priority (up to required `ownHoldback` count): ownHighRank → genericOther → allySuit → ownLowRank
  - Giveaway = everything not held back
  - Ally (if among this trick's contributors) draws first from giveaway, preferring allySuit cards, topped up from whatever's left if allySuit runs short
  - Every other recipient draws from what remains, no distinction between opponents
- New file-local helpers: `isHighRank(id)`, `takeCards(pool, count, preferredGod)`

**`choosePlayCardAction` — investigated, NOT modified**
- Conclusion: Section 3's existing logic already serves Assist's purpose unmodified
- Reasoning:
  - "Prefer winning" is unconditionally useful regardless of role (Completer wants tricks to feed itself; Assist wants tricks to gain redistribution rights) — no role split needed
  - "Conserve needed cards, spend not-needed" also holds for Assist: a card played into a trick and LOST (opponent wins) is uncontrolled and irreversible; redistribution (not trick play) is where the bot has precise, deliberate control to route dead-weight cards away
  - Role is re-evaluated live (5.4) — an Assist could revert to Completer later; carelessly dumping needed cards during trick play forecloses that reversibility for no benefit
  - No code change made; this is a verified "no-op" investigation result, not an oversight

**Out of scope, not touched:** Section 5.3 (Suit-Cycle lead engineering), opponent-specific targeting, `chooseDelegateAction`, `computeTrustScores`/`identifyFriendlyAlly` internals.

## Masking honesty check

- `determineRole`: reads `state.players[slot]` only
- New redistribution branch: reads `state.players[distributorId]` (own hand/god) + `identifyFriendlyAlly(state, distributorId)` output (already masking-verified in the prior task)
- No other player's hand or hidden identity read anywhere in the diff

## Verification

`npm run typecheck`: pass
`npm run build`: pass

**Correctness spot-checks (2000-game after-run JSONL, `simulate.ts` extended with `role`/`friendlyPlayerId`/`friendlyPlayerDeity` per redistribution log entry):**

| Check | Result |
|---|---|
| Ally receives `min(owed count, ally-suit cards available in pool)` ally-suit cards | 5152/5152 correct, 0 misroutes |
| Own-suit HIGH-RANK (9/10/DeityCard) given away during assist+ally redistribution | 0 / 5152 (should be ~0, confirmed) |
| Own-suit LOW-RANK given away during assist+ally redistribution | 10652 instances (expected, working as designed) |

Mechanism is implemented correctly and behaves exactly as specified when it runs.

**Real-world engagement rate (2000-game after-run, all 52066 redistribution decisions):**

| Path | Count | % of all redistributions |
|---|---|---|
| Completer (unchanged logic) | 20096 | 38.6% |
| Assist, no ally identified yet (fallback = unchanged logic) | 26818 | 51.5% |
| Assist, ally identified (NEW logic actually runs) | 5152 | **9.9%** |

**Root cause of muted aggregate impact**: the new logic only executes in ~1 out of 10 redistribution decisions. Ally identification requires `FRIENDLY_TRUST_THRESHOLD = 2` net trust to accumulate first (host/botTrust.ts, prior task) — most redistributions happen before any bot has confidently identified its ally yet.

**Before/after, matched 2000-vs-2000 games** (before = main branch, HEAD prior to this task; after = this branch):

| Metric | Before | After | Verdict |
|---|---|---|---|
| Stalemate rate | 10.4% | 10.0% | Flat (z≈0.4, not significant) |
| Trick count median | 20 | 23 | **Worse** |
| Trick count mean | 20.6 | 26.0 | **Worse** |
| Trick count max | 50 | 177 | **Worse** |
| Ally-guess accuracy (confident) | 32.3% | 35.2% | Marginal (z≈1.65, p≈0.10, not clearly significant) |
| Confident-guess rate | 19.0% | 17.35% | Slightly down |
| Win rate Chaos/Cosmos | 46.05%/43.55% | 46.3%/43.7% | Unchanged |

An initial 500-vs-500 run showed a more favorable-looking stalemate delta (12.6%→9.6%); re-run at 2000-vs-2000 to reduce noise, and that delta collapsed to 10.4%→10.0% (not significant). The smaller run was noise, not signal — reporting the larger, more reliable result as the real finding.

**Plain verdict, per task instruction**: numbers do NOT meaningfully improve. Stalemate rate is flat, trick count got measurably worse, ally-guess accuracy shows only a marginal, not-clearly-significant uptick. This is not attributed to a code defect (correctness independently verified above) — it's attributed to the new logic engaging too rarely (9.9% of decisions) to move whole-game aggregates, compounded by a real, unexplained trick-count regression that warrants attention before this is layered further (Section 5.3, personalities).

## Key decisions

- `ROLE_MONO_THRESHOLD = 0.5`: unturned placeholder, same status as `FRIENDLY_TRUST_THRESHOLD`
- Role/redistribution logic kept in separate files (`botRole.ts`, `botAI.ts`) matching the existing `botTrust.ts` separation pattern
- Holdback fill order (ownHighRank → genericOther → allySuit → ownLowRank) chosen so low-rank own-suit is given away first whenever any alternative exists, matching design doc 5.1's "does not hold back for self" requirement
- `takeCards()` mutates a shared `remaining` pool across sequential per-recipient calls — ally served first (priority claim), then every other recipient in original contribution order, matching old code's behavior exactly in the completer/no-ally branch (verified: identical output shape, same iteration order)

## Open questions

None required asking mid-task — spec was explicit. Flagging for the next task's own consideration:
- Should `FRIENDLY_TRUST_THRESHOLD`/`ROLE_MONO_THRESHOLD` be tuned before or after Section 5.3 lands? Current data doesn't isolate which parameter, if any, is the lever.
- Trick-count regression (median 20→23, max 50→177) is unexplained by anything in scope here — worth investigating before adding Section 5.3 on top, since 5.3 will only increase how often Assist mode's cards move around.

## Known issues

None in shipped code (correctness verified). The trick-count regression and flat stalemate rate are real, measured facts about current behavior — not implementation bugs, per the spot-checks above, but a genuine limitation of this step considered in isolation.

## Next proposed step

Per design doc Section 10:
1. Investigate the trick-count regression before proceeding — re-run with `role`/`friendlyPlayerId` logging (already in `simulate.ts`) on more games to see if it's a real mechanism (e.g. high-rank retention removing cards from circulation) or noise at this sample size too.
2. Section 5.3 (Suit-Cycle lead engineering) - separate task, per design doc.
3. Consider whether `FRIENDLY_TRUST_THRESHOLD`/`ROLE_MONO_THRESHOLD` tuning should come before 5.3, given the 9.9% engagement rate is the likely limiting factor on any measurable effect.
