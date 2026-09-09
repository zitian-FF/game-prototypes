## Current milestone

Made the Suit Cycle bezel's rotation seat-relative, by explicit user
request/override of the immediately prior task's fixed-top-marker
design: the lead suit's recess now rotates to the *actual seat* of
whoever led the trick (top/right/bottom/left, matching the seat tags
already surrounding the HUD), rather than always landing at a single
fixed screen position regardless of who led. Verified with real,
varied multi-trick gameplay, not fabricated state.

## Why (user-reported, from a live screenshot)

The user pointed out a real screenshot (Trick 2, Nyarlathotep leading
from the **left** seat, Player 2) where the bezel's LEAD glow/label sat
at the fixed **top** marker instead of rotating to align with Player
2's actual seat - and gave the exact expected correction ("it should be
90 degrees ccw"). That is: the center HUD sits at the middle of the
four seat tags around it, so its four cardinal recess positions read as
those same four seats to a player glancing at it - the lit recess
should point toward *who* led, not just show *what* suit leads. The
immediately prior task's fixed-top-marker design (itself a deliberate,
explicit override of the original approved Center HUD spec) didn't do
this; this task overrides that in turn.

## What changed

**Files changed**: `dom/overlay/GameOverlay.tsx`,
`dom/overlay/overlayContent.ts`. No changes needed to `tune.json` or
`GameOverlay.css` - this is pure rotation-target math, reusing the
exact same `useForwardRotation` hook, CSS transition, and counter-
rotation mechanism from the immediately prior task unchanged.

- **`overlayContent.ts`**: restored `SEAT_DEG` (`{ top: 0, right: 90,
  bottom: 180, left: 270 }`) - the same seat-to-angle mapping the
  turn-indicator pointer's own `SEAT_ORDER`-based math already encodes,
  reused here rather than re-derived. This is the exact same export
  that existed before the Center HUD asset redesign (removed then as
  dead code, since the intermediate fixed-recess design had no seat-
  relative math to drive) - restoring a known-good, previously-shipped
  piece rather than inventing new geometry.
- **`GameOverlay.tsx`**'s `suitDeg` computation: previously
  `useForwardRotation(leadGodIndex, 4, -90)` (always rotates the lead
  suit to a fixed local-top position). Now:
  ```
  const starterIndex = starterSeat === null ? null : SEAT_DEG[starterSeat] / 90;
  const suitIndex = starterIndex === null || leadGodIndex === null ? null : (((starterIndex - leadGodIndex) % 4) + 4) % 4;
  const suitDeg = useForwardRotation(suitIndex, 4, 90);
  ```
  Recess `i`'s home screen angle is `i * 90` (SUITS[0]/Yog-Sothoth at
  local top, clockwise); rotating the whole bezel group by
  `suitIndex * 90` brings the lead suit's recess (`leadGodIndex`) to
  `starterSeat`'s real screen angle (`SEAT_DEG[starterSeat]`). This is
  a direct port of the pre-Center-HUD-redesign ring's own "Invoker's
  actual seat" fix (see git history - a real, previously-shipped
  formula for this exact problem, adapted from independently-rotating
  per-badge DOM elements to this single-rigid-bezel-rotation mechanism
  the asset redesign requires). Indeterminate (freezes at the last real
  position, same `useForwardRotation` semantics as before) whenever
  either `starterSeat` or `leadGodIndex` is null - between tricks, or
  before any trick has ever had a real leader.
- `litGodIndex` (drives the Lead glow/label) is unchanged - still just
  `leadGodIndex` itself, frozen the same way - since which suit is
  "lit" doesn't depend on where it's rotated to.
- Updated every affected comment (constants block, the `suitDeg`
  computation, the Center HUD JSX header, the rotating-bezel-group
  comment) that previously described the marker as "a single fixed
  screen position, not a seat-tracking one" - that description is now
  wrong and has been corrected to describe the seat-relative behavior.

## How this was verified

Same real-gameplay-driven methodology as the immediately prior task
(no fabricated `gameOverlayStore` state), extended to also drive the
`selectDelegate` and `redistribute` phases (needed this time since
seat-relative rotation depends on *who* led, so the test had to survive
past whichever trick the *human* player happened to win, not just the
one forced trick-1 case):

- `npm run typecheck` / `npm run build` (repo root) - clean, both with
  the temporary debug hooks in place and after reverting them.
- Two temporary, read-only/plan-computing debug hooks (`HostGameScene.ts`
  storing the host's own last-built `MaskedState`; `main.ts` exposing it
  plus helpers that call the real, unmodified `computeHandLegality`/
  `computeSuitRing`/`computeFanScale`/`computeFanLayouts` to find real
  legal cards, a real redistribution plan, and their real on-canvas
  coordinates) - added, used, then fully reverted; confirmed via
  `git status`/`git diff` that only `GameOverlay.tsx`/`overlayContent.ts`
  remain changed.
- A Playwright script played a real Single Player game through **5**
  consecutive real tricks - real card clicks + real "Play Card"/
  "Delegate to..."/"Redistribute" button presses for whichever phase
  came up (including real redistribution: staging a real card then
  tapping a real contributor's stack, the same two-tap flow a human
  uses), bots playing automatically via the untouched
  `driveBotsIfNeeded`/`chooseBotAction`. At each trick's real lead
  suit, recorded the bezel's live `getComputedStyle().transform` and
  compared it against the value predicted by the seat-relative formula
  above, using the real live `starterSeat` and `leadGodIndex`:

  | Trick | Real starter seat | Real lead suit | Expected angle | Actual transform | Lit recess |
  |---|---|---|---|---|---|
  | 1 | bottom (You) | Yog-Sothoth | 180deg | matches | YS |
  | 2 | left | Yog-Sothoth | 270deg | matches | YS |
  | 3 | right | Yog-Sothoth | 90deg | matches | YS |
  | 4 | left | Nyarlathotep | 0deg | matches | NY |
  | 5 | top | Cthulhu | 270deg | matches | CT |

  All 5 tricks matched exactly, across 4 different real starter seats
  and 3 different real lead suits in one continuous game - conclusively
  exercising the seat-relative formula's actual variable (which seat
  led), not just its previously-tested suit variable. A screenshot at
  trick 1 (You led with Yog-Sothoth from the bottom seat) visually
  confirms the gold recess and LEAD glow/label sitting at the **bottom**
  of the bezel - exactly the corrected behavior the user's original
  screenshot was missing.
- Browser console clean throughout the full 5-trick playthrough - only
  the pre-existing, unrelated sandboxed Google Fonts network noise
  present on every boot in this environment.

## Open questions

None new - the user's report included the exact expected correction
(seat, direction, and magnitude), so no ambiguity needed resolving
mid-session.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); `ui_player_nameplate.png` still applies to the local seat
tag only (deliberate); the `'partner'` hand-fan state still has no
working visual differentiation from `'legal'`; the itch.io iframe
canvas-scale fix, the asset pipeline's downscale/recompress output, and
the hand-fan edge-bound fix still want a real-device/live-deploy glance;
this task's own real-gameplay verification was still a local dev-server
Playwright pass (single-player vs. bots), not an actual itch.io build or
a real multi-human-peer game.

## Next proposed step

Relay this task's deviation (bezel rotation is now seat-relative,
overriding the immediately prior task's fixed-top-marker design, itself
an override of the original approved Center HUD spec - three decisions
deep now) back to GPT/Codex for `suits-mp-screen-reference.md`
reconciliation, alongside the earlier symbol-size and rotation-restore
overrides. A real-device/live-deploy pass covering everything listed
under "Known issues" remains the next open loop.
