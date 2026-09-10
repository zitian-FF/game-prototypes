## Current milestone

Implemented the 2026-09-10 Live Asset Layout Corrections brief in full:
runtime sizing/positioning/alignment fixes across the Center HUD, face-
down cards, remote/local nameplates, the contextual hint panel, and the
bottom action button. No source artwork, gameplay logic, or anything
outside the brief's explicit scope was touched.

## Pre-flight: R2 asset re-verification

Per the task's own instruction, re-verified the prior task's
`card_backdrop_nyarlathotep.png` corruption blocker was genuinely
resolved on R2 before starting - fresh fetch, not cached:

- Cleared `.cache/suits-mp.etag` and deleted `assets-src/`/`public/
  prototypes/suits-mp/assets/` entirely, then re-ran `npm run
  fetch:assets suits-mp` from clean state.
- Confirmed the fetched `card_backdrop_nyarlathotep.png` hash-matches the
  already-verified fix (SHA-256 `12140ae9...`), has a valid `IEND`
  chunk, and `npm run pack:assets suits-mp` processes all 36 files
  cleanly. No regression - this file isn't touched by this task's own
  changes.

## Findings per brief item

Investigated all 7 numbered items against the real running app (pixel
measurement + live DOM/`getBoundingClientRect()` inspection, not just
reading the code) before changing anything. Two items were already
correct; five needed real fixes.

### 1. Center HUD position - already correct, no change

`ui/renderGameView.ts`'s `drawTabletop()` already anchors the
background's real sigil center (measured fresh off the current
`background_tabletop_stone.png`: bbox mid at 49.91%/47.40% of the
image, matching the code's existing `TABLETOP_SIGIL_ANCHOR` constant
exactly) to the same `(CENTER_X, CLUSTER_CENTER_Y)` point the DOM
Center HUD (`dom/overlay/GameOverlay.tsx`'s `center-hud`) is pinned to.
Verified by overlaying a crosshair at the HUD's own measured
`getBoundingClientRect()` center on real screenshots in both Play Card
and Select Delegate ("Redistribution") phases - the background's
decorative ring/glyph pattern is visually centered on that same point
in both. No code change made - this was likely already fixed by a
change the brief predates, or the background art referenced by the
original report has since been corrected.

### 2. Center HUD recess symbols - fixed

The four `deity_symbol_*.png` badges were oversized relative to their
recess: measuring the actual rendered badge (its own dark backplate
fill, not the brighter glow effect) against the bezel's real recess
opening (~0.273 of the bezel's own width/height, confirmed by a
brightness-profile scan) showed the badge at the prior task's `0.37`
size fraction landing close to ~88% of the recess diameter, closer to
crowding the ring than sitting comfortably inside it. Reduced to
`suitCycleSymbolSizeFraction: 0.335` (from `0.37`) - derived from the
target 75-80% band against the limiting (largest) per-Deity content-
fill fraction (0.681, Cthulhu/Nyarlathotep's own canvas height), then
nudged up slightly after a live screenshot measurement showed the
first-pass value landing a touch under that band. Centering was already
correct (each symbol master's own visible content is centered within
its own canvas, confirmed via bounding-box measurement) - no separate
centering fix was needed.

### 3. Face-down card size - already correct, no change

`ui/cardComponent.ts`'s `drawCard()` already draws `card_back.png` at
the exact same `dims` (`CARD_DIMS_STANDARD`) every face-up played card
uses, via the same call sites (`drawCardRow`/`animateCardPlayIntoPlayArea`
in `ui/renderGameView.ts`). Verified with a real forced off-suit
facedown play alongside a real face-up played card in the same
screenshot - both render at the same width/height/silhouette. This was
already fixed by the 2026-09-10 Player UI Asset Wave's own `card_back.
png` wiring; no change needed here.

### 4. Remote player nameplates - fixed

The three remote seat tags were previously sized independently by
width alone (94-120px) with a fixed 34px height, ignoring the real
`ui_remote_player_nameplate_*.webp` source aspect ratio (measured
fresh: exactly 1774:887 = 2:1 across all four states) - squashing the
carved plate into an illegible sliver. Now one uniform
`tune.remoteNameplateWidth` (96px) for all three seats, with height
derived from that same real 2:1 ratio (48px) rather than a second
independent constant. Width couldn't grow much further at left/right -
anchored 10px from the screen edge with the Center HUD's own box
starting at x=111, 96px leaves only a ~5px clearance - confirming the
brief's own "grow height, not width" framing was the right fix.
Confirmed the button's own box (now `height` instead of the old
`minHeight`) still exactly matches the visible plate, so the hit area
stays exact.

### 5. Local player and Team nameplate - fixed

Increased both Team Deity symbols from a fixed 18px to
`tune.localTeamSymbolSize` (36px, ~2x), and grew the outer plate's
`minHeight` from 56 to 64px so the bigger symbols fit cleanly without
overflowing the compartment. Removed the teammate's "Kin" label
entirely (`teammateGodChip.label` is now `''` at its source in
`computeGameOverlayHudState`, `ui/renderGameView.ts`) - this reconciles
the prior task's own interim choice (documented as an open question in
that task's BUILD_STATUS.md, pending exactly this clarification): the
local player's own "YOU" marker is unaffected. A fixed-height label
slot is still reserved under both icons regardless, so the two stay
vertically aligned even though only one now shows text. Which remote
seat holds the teammate Deity is still never revealed - this
compartment never showed a seat/player identity to begin with.

### 6. Contextual hint panel - fixed

Was a full-width bar (390 - 2×14 = 362px) crowding the space above the
hand. Now `tune.contextualHintWidth` (226px, ~58% of the 390px
reference viewport) horizontally centered, `tune.contextualHintHeight`
(48px, within the requested 45-50px band). Shortened "Required Suit" to
"Suit" so the longest canonical god name (Nyarlathotep, 12 characters)
still fits alongside the icon and value text at the narrower width -
confirmed live. **Follow-on fix required**: the panel's height growth
(34px -> 48px) pushed its bottom edge down into the hand fan's own
top edge - caught via a real screenshot, not assumed away. Fixed by
shifting `ui/renderGameView.ts`'s `FAN_BASELINE_Y` down by the same 14px
the panel grew (648 -> 662), per the brief's own "move the hand
downward only as necessary; do not resize cards" - `CARD_DIMS_STANDARD`
itself is untouched. Verified the hand's new position also still clears
the (now taller) action button below it.

### 7. Bottom action button - fixed

Grown from 154x58 to `tune.actionButtonWidth`/`actionButtonHeight`
(177x78 - ~15% wider, ~35% taller) so two-line label+hint text (e.g.
"Delegate to Player 2" / "Commit the chosen card") no longer overflows
past the visible slab art's own edges - confirmed live with exactly
that text in the Select Delegate phase. Text layout was already flex-
centered within the button's own box (bound to the asset's real bounds,
not separate procedural coordinates), so it re-centered automatically
at the new size with no layout math to update. State selection (waiting/
disabled/ready/pressed) is untouched.

## How this was verified

Real gameplay state throughout, not fabricated component data - temporary
`ForcedDeal`/`debugPlayCard`/`debugSelectDelegate`/`debugState`/
`debugMasked`/`pauseBots` debug hooks in `HostGameScene.ts`/`main.ts`,
added for this session and fully reverted before finishing (`git diff
--stat` against `main` for both files is empty). Bot auto-play was
paused (`debugBotsPaused`) during forced scenarios so a scripted play
sequence can't race against the existing bot-driving loop - discovered
this race first-hand when chaining multiple forced deals in one page
session produced a inconsistent hybrid render (new god assignment,
stale hand); switched to one fresh page load per scenario instead of
chasing the timing further, since re-loading is simpler and more robust
than trying to out-wait an unrelated bot-AI interaction this task's own
debug hooks introduced, not a product bug (confirmed: a totally
unforced real boot with no debug hooks invoked never reproduces it).

- `npm run typecheck` / `npm run build` - clean, at each step of the
  implementation and again after every debug hook was reverted.
- All 7 of Section 9's required captures, via real engine state:
  1. **Play Card with three face-up played cards** - a real trick with
     3 of 4 seats played face-up, 4th (local) still to act.
  2. **A state containing a face-down card** - a real forced off-suit
     play from a remote seat (not local, so it's genuinely masked
     facedown on the local client, matching the real masking rule),
     alongside a normal face-up local play in the same trick.
  3. **Redistribution with remote delegation states visible** - a real
     Double-card win (the only path to `chooseDelegate`, confirmed via
     `rules/engine.ts` - a single-card win self-redistributes with no
     delegate step) showing all three remote seats in the real
     `eligible` state.
  4. **A selected remote delegation target** - a real Playwright click
     on the eligible seat tag, confirming `selected` state and the
     Action button updating to "Delegate to Player 3".
  5. **At least two Lead Players and lead suits** - Yog-Sothoth led by
     Player 2, Cthulhu led by the local player, and Cthulhu led by
     Player 2 again in the Double-win scenario (3 distinct
     leader/suit pairs across the captures above).
  6. **Local Chaos and Cosmos Team states** - Team Chaos (local
     assigned Cthulhu) in captures 1-2, Team Cosmos (local assigned
     Yog-Sothoth) in captures 3-4.
  7. **Hint text containing "Nyarlathotep"** - the contextual hint
     panel showing "Suit  Nyarlathotep" at its new, narrower width with
     no truncation, in captures 1-2.
- **Report**, per Section 9:
  - Before/after screenshots: captured for every item above (before the
    Item 2/4/5/6/7 fixes, and after all seven), plus a final pass after
    the Item 6 hand-fan follow-on fix.
  - Final rendered bounds (via live `getBoundingClientRect()`, not
    estimated): Center HUD 168x168 at (111, 221); recess symbols'
    visible backplate now inside the recess ring, confirmed via pixel
    overlay against the measured recess-opening circle; remote
    nameplates 96x48 (all three, uniform); local nameplate 260x64 with
    36x36 Team symbols; contextual hint 226x48 centered at x=82-308;
    action button 177x78 centered at x=106.5-283.5.
  - Confirmed the Center HUD does not shift between Play Card, Select
    Delegate, and Redistribution-adjacent phases (same crosshair-vs-
    sigil check as item 1, above).
  - Confirmed all four HUD symbols stay centered and unclipped through
    real bezel rotation across the 3 distinct lead-suit scenarios
    tested above.
  - Confirmed no unrelated behavior or layout changed: Menu/Sort/Log
    buttons, hand fan angles/ordering/card sizing, bezel rotation
    mechanism, counter-rotation, Lead Suit/`LEAD` treatment, and gameplay
    rules are all untouched - only `dom/overlay/GameOverlay.tsx`,
    `ui/renderGameView.ts` (the `FAN_BASELINE_Y` follow-on fix and the
    `teammateGodChip.label` source change), and `tune.json` changed.
- **Real, unforced boot** into Single Player, trick 1 (local genuinely
  holding and leading the forced Yog-Sothoth-2 opener - untouched real
  gameplay rule): confirmed the same fixes read correctly with no
  forced state, hand fan clears the hint panel and action button
  cleanly, and the console is clean (only the pre-existing sandboxed
  `net::ERR_CONNECTION_RESET`/404 noise present in this environment).
  Confirmed the temporary debug hooks are fully absent from this real
  boot (`window.__forceDeal`/`__playCard`/`__selectDelegate`/
  `__debugState`/`__debugMasked`/`__pauseBots`/`__container` all
  `undefined`).
- Confirmed all 7 new `tune.json` values (`suitCycleSymbolSizeFraction`,
  `localTeamSymbolSize`, `remoteNameplateWidth`, `contextualHintWidth`,
  `contextualHintHeight`, `actionButtonWidth`, `actionButtonHeight`) are
  live-editable under `?debug=1` via Tweakpane's existing generic
  "iterate every `tune.json` key" wiring - no new panel code needed.

## Key technical decisions

- Kept items 1 and 3 as verified-no-change rather than making a
  defensive edit "just in case" - both were provably already correct
  (measured against the real current assets, not just re-reading old
  code comments), and editing already-correct code risks a real
  regression for no benefit.
- Sized the recess symbols against the *measured* recess opening and
  each symbol's own *measured* content-fill fraction, not a guess -
  same pixel-measurement methodology the prior Suit Cycle sizing task
  established, just re-targeted at this brief's explicit 75-80% band
  instead of "reach the ring with a small margin."
- `FAN_BASELINE_Y`'s 14px shift is a deliberate, minimal fix scoped
  exactly to the hint panel's own height growth (34px -> 48px) - not a
  broader hand-fan repositioning, per the brief's own "move the hand
  downward only as necessary."
- Removed `teammateGodChip.label` at its source (`renderGameView.ts`)
  rather than special-casing it away only in the render - keeps
  `GameOverlay.tsx` rendering both chips identically off one shared
  data shape, with no `chip === yourGodChip` branch needed.

## Open questions

None raised to the user this session - every ambiguity (the exact
`suitCycleSymbolSizeFraction`/nameplate dimensions/hint panel width,
whether items 1/3 needed changes at all) was resolved by direct pixel
measurement and live verification rather than guessing, and the one
explicit reconciliation the brief flagged (`Kin` label removal) was
already a direct instruction, not an open choice.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps; the
`'partner'` hand-fan state still has no working visual differentiation
from `'legal'`; the itch.io iframe canvas-scale fix, the asset
pipeline's downscale/recompress output, the Center HUD easing curve,
the trick-result dwell hold, the card-play arc animation, the Awakened
reveal, and the end-of-trick collect animation all still want a real-
device/live-deploy glance. suits-mp still has no permanent
`?debug=1`-gated `ForcedDeal` hook (unlike the sibling `suits`
prototype's `rules/debugScenarios.ts`) - this is now the ninth task in
this feature area to build and tear down its own one-off version, this
time also adding matching one-off `debugSelectDelegate`/`debugState`/
`debugMasked`/`pauseBots` hooks to chase down a chooseDelegate-phase
requirement and a cross-scenario test-harness race.

**New from this task (test-harness note, not a product bug)**: chaining
multiple `debugForceDeal` calls within one page session raced against
the existing `driveBotsIfNeeded` bot-driving loop, producing an
inconsistent hybrid render during verification scripting. Confirmed
this never occurs in real, unforced gameplay - documented here only so
a future one-off debug harness in this area knows to either pause bots
before the *first* forced deal (not just before the first play) or use
one fresh page load per scenario, as this task ended up doing.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the standing next open loop. For this task specifically,
the seven new `tune.json` values are all first-pass measured/derived
values, live-tunable under `?debug=1` - worth a quick look on a real
phone alongside the rest of the recent asset work, since several (the
remote nameplate's tight 5px HUD clearance in particular) were sized
against exact desktop-viewport pixel measurements that are worth
confirming still read well at real mobile pixel density.
