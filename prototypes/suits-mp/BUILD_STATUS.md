## Current milestone

Removed "Twin Awakening" terminology regression from the live build's
action button (`renderGameView.ts`), and added the missing mid-
selection UI guidance for building toward a Double - a plain
terminology/UX fix per the GDD, no gameplay rules, card-selection
legality, layout, artwork, or animation timing changed.

## What was implemented

- `computeActionButtonState()` (`ui/renderGameView.ts`): the confirmed
  bug - `'Twin Awakening'` shown once two matching-rank cards are
  staged and ready to commit - is now `'Play Double'`, matching the
  existing `'Play Card'` naming pattern for singles. The `'Commit the
  chosen card'` hint for this state is unchanged.
- **New mid-selection guidance state**: when exactly one card is
  selected (off-suit forced, `playType === 'facedownSingle'`) AND at
  least one other card of the same rank exists elsewhere in the
  player's hand, the button now shows label `'Double'`, hint `'Select
  two cards of the same rank.'` (disabled - nothing to commit yet).
  When no matching-rank card exists elsewhere in hand, the button
  falls through completely unchanged to the existing `'Facedown Card'`
  / `'Commit the chosen card'` state, since a facedown single really is
  the only real option there and showing anything else would be
  misleading. This is purely additive: it reads `state.yourHand` (via
  `cardById`) to check for a same-rank partner and only ever overrides
  the label/hint/enabled/onClick for that one specific case - no change
  to `computeHandLegality`'s own selection/legality state machine
  (`ui/handLegality.ts`), which decides what's tappable, or to the
  engine's play-validation logic (`rules/engine.ts`), which decides
  what's actually legal to send.
- Low-priority comment cleanup (all internal, non-player-facing):
  updated 4 code comments still saying "Twin Awakening" to "Double" -
  `rules/engine.ts` (~line 219), `ui/handLegality.ts` (2 spots, ~55 and
  ~125), `ui/renderGameView.ts` (~332 and ~1518).

## Key technical decisions

- The new "Double" guidance branch is gated specifically on
  `type === 'facedownSingle' && cards.length === 1` - the only shape
  `computeHandLegality` ever produces for "one card selected, off-suit
  forced" (confirmed by reading `handLegality.ts`'s own state machine).
  This can't fire for the `leading`/`mustPlaySuit` single-select cases
  (those always resolve to `playType: 'single'`, never
  `'facedownSingle'`), so leading/following-suit behavior is completely
  untouched.
- Partner-lookup reuses the exact same `cardById(id).rank` comparison
  `computeHandLegality`'s own off-suit branch already uses to compute
  the 'partner' (highlighted) card-visual-state - no new concept
  introduced, just read from `state.yourHand` at the one point that
  needed it (the action button), rather than re-deriving it from
  scratch.

## Verification

- Confirmed via direct codebase search that `rulesContent.ts` (the
  in-game Rules popup, rewritten in a prior task this session) already
  contains zero references to "Twin"/"Twin Awakening" - already
  correctly says "Double: 2 cards of the same rank, any Suits" and
  "Any Double beats every Single." No changes needed there; verified,
  not re-edited.
- Full case-insensitive codebase search for "Twin" after all edits: the
  only remaining hit is `NetWinInfo` (a substring false-positive - "Ne**tWin**Info" -
  completely unrelated to Twin Awakening). Zero real references remain.
- **Protected items confirmed untouched** (grepped before and after
  every edit):
  - `"Black Goat's Awakening"` (`rules/cards.ts`) - Shub-Niggurath's
    canonical rank-10 card name. File never touched.
  - The Awakened reveal-animation feature (`playAwakenedEffect`,
    `awakenedHandCardIds`, `newlyAwakenedThisRender`, `cardArt.ts`) -
    never touched beyond the 2 comment-only wording tweaks noted above
    (which don't reference any of these identifiers, just the English
    phrase "Twin Awakening" describing what a double-card win *is*).
- **Real-gameplay Playwright verification**, driven through an actual
  live Single Player game (host + 3 local bots, the same code path a
  real player uses) via a temporary forced-deal debug hook (added to
  `host/gameHost.ts`/`scenes/HostGameScene.ts`, fully reverted before
  commit - confirmed via `git status` showing no diff on either file):
  - **(a) Mid-selection state**: dealt a hand with `ShubNiggurath-5`
    and `Nyarlathotep-5` (matching rank, different suits) off-suit
    forced. Selecting `ShubNiggurath-5` alone showed **"Double" /
    "Select two cards of the same rank."** exactly as specified.
  - **(b) Confirm state**: selecting both matching cards showed
    **"Play Double"** / "Commit the chosen card" - confirmed NOT
    "Twin Awakening".
  - **Unchanged fallback**: selecting a card with no partner
    (`ShubNiggurath-2`, the only card of its rank in that hand) showed
    the existing **"Facedown Card"** / "Commit the chosen card" state,
    completely unchanged - confirming the new guidance never fires for
    a genuinely unachievable Double.
  - **(c)** `"Black Goat's Awakening"` confirmed unchanged by direct
    file read of `rules/cards.ts` (Shub-Niggurath's rank-10 entry) -
    not something reachable to screenshot in isolation, so verified at
    the source instead.
  - **(d)** The Awakened reveal-animation trigger was exercised through
    a second live scenario: a forced deal where a bot leads a Ten
    before the local player's turn, with the local player still
    holding an unplayed Deity Card. Confirmed via the real
    `PersistentUIState.awakenedHandCardIds` set (exposed only through
    the same temporary debug hook) that it correctly contained
    `'YogSothoth-DeityCard'` after the Ten landed - the exact trigger
    condition the feature has always used, working identically to
    before this task's changes. (Card art itself doesn't load in this
    sandboxed offline environment - a pre-existing, known limitation
    unrelated to this change, see every prior BUILD_STATUS entry - so
    the internal state check stood in for eyeballing the '★' marker
    directly; this is a more precise verification than a screenshot
    would have been anyway.)
- `npm run typecheck` and `npm run build` both pass with no errors.
- Browser console clean on boot and through both forced-deal scenarios
  (only the known sandboxed `fonts.googleapis.com`/asset-fetch 404
  noise present in every prior task this session).
- Confirmed no debug-hook residue: `git status` shows only
  `rules/engine.ts`, `ui/handLegality.ts`, and `ui/renderGameView.ts`
  changed - `host/gameHost.ts` and `scenes/HostGameScene.ts` (both
  touched only for temporary verification hooks) show no diff at all.

## Open questions

None - the task's own bug report, new-state spec, and protected-items
list were all explicit and unambiguous; no judgment calls required
asking the user mid-session.

## Known issues

None found beyond the pre-existing, already-documented offline-sandbox
limitation that card art doesn't fetch from R2 in this environment
(unrelated to this task).

## Next proposed step

None specified by this task; awaiting further direction.
