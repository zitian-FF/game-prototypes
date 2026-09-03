## Current milestone

Implemented the GDD's Deity Card Dormant/Powered mechanic, replacing the
old "Ace beats a 10 if played after it" concept entirely. Read the GDD
fresh this session (same file, "Winning a Trick" section had been
substantially restructured since the last read) and confirmed the new
terminology and rules directly from it, per this task's explicit
instruction not to reuse any prior session's understanding of "Ace"
behavior. This also resolves the "Area 5: Ace-vs-10 ordering isn't
implemented" bug flagged as a known issue in the prior full-audit
session (PR #70) - that finding is superseded by this fuller spec.
Engine/logic only, as scoped; no rendering/visual work.

## What was implemented

- **`rules/types.ts`**: `Rank`'s `'Ace'` literal renamed to
  `'DeityCard'`. New `DeityCardState = 'dormant' | 'powered'` type.
  `TrickPlay` gained a `deityCardState: DeityCardState | null` field -
  null covers both "not a Deity Card" and "played face down as an
  offsuit Single" (an offsuit play stays fully hidden and always scores
  0, so its actual identity never matters for this).
- **`rules/engine.ts`**: new `computeDeityCardState(kind, cardIds,
  priorPlays)` helper, called inside `playCard()` using `state.plays`
  (this trick's plays strictly *before* the one being constructed) -
  the play's Dormant/Powered state is fixed once, at the moment it's
  made, and stored on the `TrickPlay` itself. It's never recomputed
  from the finished trick afterward. `resolveTrick()`'s `scoreOf()` now
  reads that stored state directly (`powered` -> 11, `dormant` -> 1)
  instead of the old `hasTenInTrick()`/`rankValue()` pair, which
  scanned the whole finished trick with no regard for play order - the
  actual bug this task fixes. Doubles-beat-Singles, highest-rank-wins,
  and the latest-play tiebreak (`>=` in the comparison loop) are
  untouched, exactly as scoped - they now just receive the correct
  per-card rank. `checkSuitCompletion()`'s doc comment updated from
  "reveal their Deity Cards" to "reveal their Deity Identities" to
  match the GDD's now-distinct terminology (a Deity Identity is a
  player's secret role; a Deity Card is the physical top card of a
  suit - previously conflated).
- **`rules/cards.ts`**: the four old per-Deity Ace flavor names ("Heart
  of Cthulhu," "Aspect of Nyarlathotep," "Seed of Shub-Niggurath,"
  "Core of Yog-Sothoth") are removed from `CARD_NAMES`, replaced with
  each Deity Card entry using its plain Deity display name (`'DeityCard'`
  rank, e.g. `['DeityCard', 'Cthulhu']`) - these old names are removed
  from canon per the task's explicit instruction. `RANK_SORT_ORDER`'s
  `Ace: 9` -> `DeityCard: 9` (same sort position). New exported
  `deityCardDisplayName(god, state)` helper (`'Cthulhu'` when dormant,
  `'Awakened Cthulhu'` when powered) - added for the rendering layer to
  consume later, per requirement #3; not wired into any UI yet, as
  scoped.
- **Two minimal, mechanical renames**, unavoidable to keep the build
  typechecking once `Rank`'s `'Ace'` literal changed, with no visual/
  behavioral change beyond the literal swap:
  - `dom/RedistLogModal.tsx`'s `CardBadge`: `card.rank === 'Ace' ? 'A' :
    card.rank` -> `card.rank === 'DeityCard' ? '★' : card.rank`.
  - `ui/cardArt.ts`'s `buildCard()`: `isAce` -> `isDeityCard`, compared
    against `'DeityCard'` instead of `'Ace'`. Which art asset gets
    loaded (face art vs. symbol art) and whether the rank-numeral plate
    is drawn are unchanged - same branches, renamed condition only.

## Rendering-layer "Ace" references found but NOT fixed here (flagged, per scope)

This task is engine/logic only; these are real UI/copy work for the
later rendering task once new art is ready:

- **`dom/rulesContent.ts`** (Rules modal copy, "Taking a Trick"
  section): still says "The Ace overcomes a Ten only when it falls
  after it within the same trick. Laid before, the Ten stands." This is
  now stale prose describing the old simple Ace-beats-10 rule, not the
  new Dormant/Powered mechanic. Pure string content - does not affect
  typechecking or the build, left untouched. The GDD's own player-facing
  text for this is available whenever the rules-modal copy gets
  updated: "Powered: Rank 11 if a 10 was played earlier this Trick."
- **`ui/cardArt.ts`**: beyond the unavoidable `isAce`->`isDeityCard`
  rename above, the file's header comment and constant name
  (`ACE_BLEED`) still say "Ace" / describe "full face art (Aces)." Left
  as-is - purely descriptive, no type dependency, and renaming/
  restyling this is real rendering-layer work out of this task's scope.
  No Dormant/Powered-specific visual treatment (e.g. distinct art or
  styling for a Powered vs. Dormant Deity Card) exists yet - `buildCard`
  still only branches on "is this a Deity Card at all," not on its
  live state.
- **`BRIEF.md`** (Stage 3a amendment section, describing the shared
  card component): "...over the rank (`A` for Ace)..." - this is a
  historical record of what `cardComponent.ts`'s `drawCard()` displayed
  at the time that stage was built (it renders `String(rank)` with no
  special-casing, so it would now literally show "DeityCard" until the
  rendering task gives Deity Cards their own visual treatment). Left
  untouched, same reasoning as `rulesContent.ts`.
- **`net/actions.ts` / `host/mask.ts`**: `MaskedTrickPlay` only carries
  `{ player, cards, kind }` - no `deityCardState` is exposed over the
  wire yet. Not needed by anything today (no consumer exists), and
  requirement #3 only asked that the data be "available for the
  rendering layer to consume later" - it now is, as a field on the
  engine's own `TrickPlay`, ready to be threaded into `MaskedTrickPlay`
  whenever the rendering task needs it.

## How this was verified

- `npm run typecheck` (repo root) - clean, no errors.
- `npm run build` (repo root) - succeeds; `suits-mp` bundle builds
  normally alongside every other prototype.
- Wrote a scratch script (`scratch-deity-verify.mts`, deleted before
  finishing) driving the real engine via `initGame` + `playCard` +
  `settleAutoPhases` (`rules/engine.ts` / `host/gameHost.ts` - the same
  functions production code calls, not a reimplementation) through all
  4 of the GDD's own worked examples for "Deity Card state," using
  `ForcedDeal` to construct exact hands/turn order for each:
  1. 10 at position 1, Deity Card at position 4 (two other cards
     between) -> Deity Card's stored `deityCardState` is `'powered'`,
     and it wins the trick. **PASS**.
  2. Deity Card at position 1, 10 at position 3 -> Deity Card's stored
     state is `'dormant'`, the 10 wins the trick. **PASS**.
  3. 10 at position 1, Deity Card at position 2, another Deity Card at
     position 4 -> both Deity Cards are `'powered'`; position 4 wins
     the tie via the existing latest-play tiebreak. **PASS**.
  4. A Double of 10s, then a later Double of Deity Cards (both
     necessarily offsuit Doubles, built so each player legitimately
     lacked the required suit) -> the Deity Card Double is `'powered'`
     and beats the 10 Double; `wonByDouble` is `true`. **PASS**.
  All 4 assertions (state + winner, per example) passed against the
  real engine on the first run after the implementation was written.
- Playwright, against `npm run preview`: booted the lobby screen
  (`?debug=1`) and also played into an actual single-player (vs. bots)
  game to exercise real card dealing/rendering with the renamed `Rank`
  literal flowing through `buildCard()`. Console showed only the known
  pre-existing Google Fonts fetch failure (sandboxed network has no
  outbound access to `fonts.googleapis.com`) - no new errors, no
  uncaught exceptions, cards render and the game proceeds normally.

## Key technical decisions

- **State computed once, at time-of-play, and stored on the
  `TrickPlay` itself** rather than recomputed by scanning the finished
  trick in `resolveTrick()`. This was the direct fix for the bug the
  prior audit found (the old `hasTenInTrick()` scanned the whole
  finished trick, order-blind) and it also cleanly satisfies
  requirement #3 (exposing Dormant/Powered state for a later renderer)
  for free - the state is already a first-class field on the play, not
  something a UI would need to re-derive.
- **Old per-Deity Ace flavor names deleted outright, not deprecated or
  kept as a fallback** - the task was explicit these are "removed from
  canon," and `CardDef.name` was confirmed (via a repo-wide grep) to
  have no other reader, so there was no compatibility concern in
  replacing them directly.
- **Two rendering-layer files needed a minimal mechanical rename, not
  zero changes** - `RedistLogModal.tsx` and `cardArt.ts` both compare
  `card.rank`/`rank` against the literal `'Ace'`, which would no longer
  typecheck once `Rank` dropped that literal. Both edits are a straight
  1:1 literal swap with no new behavior, states, or styling - real
  Dormant/Powered visual treatment is left for the dedicated later
  rendering task, as instructed.

## Open questions

None specific to this task - the GDD's "Deity Card state examples"
section was unambiguous and all 4 worked examples verified directly
against the real engine.

## Known issues

Carried over from the prior full-audit session (PR #70), still true,
untouched by this task (out of scope here):

- **`advanceBlocker()`'s premature `checkSuitCompletion()` call** -
  checks for suit-completion victory right after collecting a trick's
  cards into the distributor's hand, before redistribution restores the
  "everyone holds exactly 10 cards" invariant GDD's win check assumes.
  Needs its own task.
- **Facedown-card masking leak in `host/mask.ts`** - an offsuit
  Single's real card ID is still sent to every peer over the wire
  (`buildMaskedState()` doesn't redact `cardIds` for `kind ===
  'offsuit'`), even though the GDD requires its identity stay hidden.
  Still present, still separately tracked.
- **Rules-modal content gaps**: no Setup section; off-suit Singles'
  facedown/hidden-identity nature is unstated. Product decision, not a
  bug.
- New this task, both flagged above under "Rendering-layer 'Ace'
  references found but NOT fixed here": `dom/rulesContent.ts`'s stale
  "Ace overcomes a Ten" copy, and `BRIEF.md`'s stale "`A` for Ace"
  reference in the Stage 3a amendment section.
- Carried over, still true: no card-back art yet; the bottom HUD name
  tag can wrap for a long real name.

## Next proposed step

The rendering task this was explicitly scoped to set up for: give
Deity Cards their own visual treatment (dormant vs. powered - e.g. via
the new `deityCardDisplayName()` helper and `TrickPlay.deityCardState`
now available), update `dom/rulesContent.ts`'s "Taking a Trick" copy to
describe Dormant/Powered instead of the old Ace rule, and decide
whether/how `MaskedTrickPlay` should carry `deityCardState` over the
wire for that UI to consume.
