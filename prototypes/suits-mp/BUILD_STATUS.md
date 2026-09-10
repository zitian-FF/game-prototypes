## Current milestone

Removed a real CSS artifact from the local nameplate, permanently deleted
the redundant standalone "Lead Player" tag, and closed out four
remaining sizing/position issues (Team compartment symbol size, action
button size, hand-fan position, contextual-hint clearance) - including
a genuine layout-budget conflict between two of those asks that
required user input mid-task rather than a guessed compromise.

## Part 1: Local nameplate glow artifact - found and removed

Confirmed via a real screenshot (not a cache/stale-load artifact): a
visibly lighter rectangular patch sat behind the local nameplate's
right-side Team compartment.

**Investigation**: Walked the entire DOM subtree under `[data-ui="local-
nameplate"]` via live `getComputedStyle()` - every single descendant
element had `backgroundColor: transparent` and `boxShadow: none`; only
the *outer* nameplate `<div>` itself had anything painted: `boxShadow:
0 0 30px rgba(196, 156, 66, 0.22)`. Confirmed this was the actual cause
(not a coincidence) via a real A/B screenshot - removing just that one
`boxShadow` line and re-rendering made the patch disappear completely,
with the board's normal dark texture showing through cleanly in its
place.

**Root cause**: the outer nameplate `<div>` has no `border-radius`, so
its `box-shadow` follows the div's own plain rectangular border box
rather than the carved plate art's real beveled/octagonal-notched
silhouette (confirmed against the source `ui_player_nameplate.png` -
its actual visible plate shape has cut corners, but the CSS box behind
it is a plain rectangle). The shadow read as a flat glowing rectangle
bleeding onto the board background on every side, not a soft ambient
highlight - most visible over the right compartment simply because that
side of the board texture is plainer/darker, giving the added glow more
contrast to stand out against.

**Fix**: removed the `boxShadow` declaration entirely, per the task's
explicit "find why it's visible and eliminate the actual cause" (not
"make it blend in" via a color/opacity tweak). Nothing else in this
file's local/remote nameplates uses an outer glow, and the plate art
itself already carries all the visual weight it needs - this wasn't a
design element worth preserving in a reshaped form.

## Part 2: Standalone "Lead Player" tag - deleted entirely

Removed `data-ui="trick-starter-tag"` (the `isStarter && <div>...Lead
Player</div>` block), the `isStarter` local variable that fed only that
block, and updated three stale comments elsewhere that still described
it as present (`ui/renderGameView.ts`'s file-header list,
`gameOverlayStore.ts`'s `currentTurnSeat` doc comment, and
`GameOverlay.tsx`'s own "LEAD label ... not a standalone Lead Player
badge, which stays deliberately absent from this screen" comment - that
claim predated this fix and was actually false until now).

**What's preserved**: `starterSeat` itself (the prop, `gameOverlayStore.
ts` field, and `computeGameOverlayHudState`'s computation in `ui/
renderGameView.ts`) is untouched - it's still load-bearing for the
Center HUD bezel's own seat-relative rotation (`GameOverlay.tsx`'s
`starterIndex`/`suitIndex`/`suitDeg`). Only the separate, redundant
per-seat text tag is gone; the wheel's rotation-to-seat behavior and its
`LEAD` label are unaffected.

**Verified on every seat, not just local**: real Playwright captures
with the local player leading (screenshot 1) and with a remote seat
(Player 3, forced via `leaderId`) leading (screenshot 2) - both confirm
`document.querySelectorAll('[data-ui="trick-starter-tag"]').length ===
0` and no "Lead Player" text anywhere in `document.body.innerText`.

## Part 3: Remaining sizing/position fixes

### 3.1 Team compartment symbols now match the Center HUD's own symbols exactly

Measured both live via `getBoundingClientRect()` rather than assuming:
the Center HUD's own per-symbol anchor box (`[data-suit]`) renders at
**56.265625 x 56.265625px** (`HUD_SIZE(168) * tune.
suitCycleSymbolSizeFraction(0.335)`). Set `tune.localTeamSymbolSize` to
that same value (`56.27`) - re-measured after the change and confirmed
both now render at the identical `56.265625 x 56.265625px`.

**Fit check, not assumed**: the right compartment's own box is only
~120px wide, and two 56px symbols plus an 8px gap need ~120.5px -
looked like it might not fit. Rather than guess a smaller compromise
size, implemented the exact match and measured the *real* rendered
result: the symbol row lands at `x: 204.78-325.31` against the
compartment's own `x: ~205-324.9` - a sub-pixel (~0.3px) overflow,
confirmed via a real screenshot to be completely invisible (no clipping
or crowding). The outer plate grew from 69px to 89.27px tall to
accommodate the bigger symbols (flex `alignItems: stretch` on its own
`minHeight: 64` box) - this is a real, visible, and intentional side
effect, not a bug (see 3.4 below for the knock-on spacing fix it
required).

**Caveat for future tuning**: `tune.json` is static data, so
`localTeamSymbolSize` and `suitCycleSymbolSizeFraction * HUD_SIZE`
aren't formula-linked - if `suitCycleSymbolSizeFraction` is tweaked
later (e.g. live via `?debug=1`), `localTeamSymbolSize` won't
automatically follow and would need a matching manual update to stay
in sync. Flagging this rather than silently coupling them, since the
task named `localTeamSymbolSize` as an existing tune key to reuse
rather than restructuring it into a derived value.

### 3.2 Action button enlarged a further 50%

`tune.actionButtonWidth`/`Height`: 177x78 -> **266x117** (both axes
scaled by the same 1.5x factor, so the aspect ratio is unchanged from
the prior pass - already "close to native" per that pass's own
decision, and uniform scaling can't move it further from or closer to
that). Text remains flex-centered within the button's own box (bound to
the asset's real bounds, not procedural coordinates), so both the
short label and the long two-line "Delegate to Player 3" / "Commit the
chosen card" case stay fully inside the visible slab with no overflow -
confirmed via a real screenshot of that exact long-text state.

### Real conflict found: enlarged button vs. "lower the fan further"

Growing the action button in place (same `BOTTOM_ROW_BOTTOM` anchor)
pushed its own top edge 39px further up the screen (from y=712 to
y=673) - directly into the same vertical band the hand fan needed, and
with no room left for a full 114px-tall card between it and the
contextual hint panel above regardless of where the fan's own baseline
sat. This wasn't a "nudge a constant" situation, so per this task's own
"report the constraint rather than guessing a compromise" instruction
(applied here even though it was stated for 3.1, since the same
principle covers any conflict like this), stopped and asked the user
directly rather than picking a resolution unilaterally. **User's
choice: move the whole bottom row down** (reduce
`BOTTOM_ROW_BOTTOM`), accepting that this also repositions Menu/Sort/
Log.

Implemented: `BOTTOM_ROW_BOTTOM` 54 -> **16**, reclaiming most of the
button's growth (new button top: y=711, just 1px higher than the
original pre-task y=712). `REQUIRED_SUIT_BANNER_TOP` 590 -> **596** to
clear the taller local nameplate from 3.1 (see 3.4). This freed enough
room for `FAN_BASELINE_Y` to move from 662 to **674** (662 -> 670 in a
first pass, confirmed via a real screenshot to leave generous room
below but almost none above; nudged to 674 to even out both gaps) - a
genuine, if modest, "further lower" within the space this reclaiming
actually created, verified clean at both boundaries (see 3.4).

### 3.3 Hand fan lowered

`ui/renderGameView.ts`'s `FAN_BASELINE_Y`: 662 -> **674** (see above for
the full reasoning chain - this number is a direct consequence of the
3.2 conflict resolution, not an independent free choice).

### 3.4 Contextual hint panel clearance - re-verified with fresh screenshots

- **Above** (vs. the now-taller local nameplate): nameplate bottom
  (589.27, at `top: 501` + `height: 89.27`) vs. hint panel top (`596`,
  up from 590) - a clean ~7px gap, confirmed via a real screenshot (no
  more sub-pixel overlap).
- **Below** (vs. the hand fan): hint panel bottom (`596 + 48 = 644`) vs.
  the fan's own topmost card edges at `FAN_BASELINE_Y = 674` - confirmed
  via a real screenshot showing a clean, real gap (not just "not
  technically overlapping").
- **Fan vs. action button**: confirmed via a real screenshot showing a
  clean, visible gap between the lowest card edges and the button's own
  top edge (`y = 711`).

## Final measured bounds (all via live `getBoundingClientRect()`)

| Element | Bounds |
|---|---|
| Center HUD symbol (`[data-suit]`) | 56.27 x 56.27 |
| Team compartment symbol (`[data-ui="god-chip"] > div`) | 56.27 x 56.27 (exact match) |
| Local nameplate | x:65, y:501, w:260, h:89.27 |
| Local nameplate `boxShadow` | `none` (was `0 0 30px rgba(196,156,66,0.22)`) |
| Contextual hint panel | x:82, y:596, w:226, h:48 |
| Action button | x:62, y:711, w:266, h:117 |
| `trick-starter-tag` elements (any seat) | 0 |
| `BOTTOM_ROW_BOTTOM` (Menu/Sort/Log/Action shared anchor) | 16 (was 54) |
| `FAN_BASELINE_Y` | 674 (was 662) |

## How this was verified

Real gameplay state throughout - temporary `ForcedDeal`/`debugPlayCard`/
`pauseBots` debug hooks in `HostGameScene.ts`/`main.ts`, added for this
session and fully reverted before finishing (`git diff --stat` against
`main` for both files is empty).

- `npm run typecheck` / `npm run build` - clean, at each step and again
  after every debug hook was reverted.
- Real screenshots covering:
  1. Local player leading trick 1 (real, unforced) - no glow, no Lead
     Player tag, correct Team symbol size.
  2. A remote seat (Player 3) leading a forced trick - confirms the
     Lead Player tag removal isn't local-seat-specific.
  3. A real Double-card win reaching `chooseDelegate`, before picking a
     delegate - long "Select a delegate above" action-button text,
     fully contained.
  4. The same flow after a real Playwright click selects a delegate -
     "Delegate to Player 3" / "Commit the chosen card" two-line text,
     fully contained in the enlarged button.
- Live DOM measurement (`getComputedStyle`/`getBoundingClientRect`) in
  every scenario above confirming: zero `trick-starter-tag` elements,
  no "Lead Player" text anywhere in the page, `boxShadow: none` on the
  local nameplate, and the Center HUD/Team-compartment symbol sizes
  matching exactly.
- **Real, unforced boot** into Single Player, trick 1: confirmed all of
  the above reads correctly with no forced state, and the console is
  clean (only the pre-existing sandboxed `net::ERR_CONNECTION_RESET`/404
  noise present in this environment). Confirmed the temporary debug
  hooks are fully absent from this real boot (`window.__forceDeal`/
  `__playCard`/`__pauseBots` all `undefined`).
- Confirmed all `tune.json` values touched this task
  (`suitCycleSymbolSizeFraction`, `localTeamSymbolSize`,
  `actionButtonWidth`, `actionButtonHeight`) remain live-editable under
  `?debug=1` via Tweakpane's existing generic wiring - no new panel code
  needed.

## Key technical decisions

- Diagnosed the glow via a real A/B screenshot (shadow present vs.
  removed) rather than trusting a plausible-sounding theory from
  reading the CSS alone - an earlier hypothesis (uniform box-shadow
  bleed, more visible against a plainer background) turned out to be
  exactly right, but only the A/B test confirmed it rather than a
  second, equally plausible theory (background texture variance).
- Kept `starterSeat`'s own plumbing entirely intact when removing the
  tag it used to feed - conflating "this prop only exists for the tag"
  with "this prop only has one consumer" would have broken the Center
  HUD's bezel rotation, which reads the same value.
- Escalated the button/fan space conflict to the user rather than
  picking a resolution myself (shrinking the button back down, silently
  ignoring "lower the fan", or letting cards visibly clip behind the
  button) - the four resolutions were all real, mutually exclusive
  design trade-offs a human should decide, not something to guess
  around under a "measure, don't guess" directive that explicitly
  named this exact kind of situation.
- Chose `BOTTOM_ROW_BOTTOM: 16` (not lower) even though the user's
  chosen direction could in principle go closer to `0` - kept a small
  real margin from the literal screen edge for the Sort/Log buttons'
  own tap targets and general polish, since nothing in the request
  asked for them flush against the edge.

## Open questions

- **`localTeamSymbolSize` vs. `suitCycleSymbolSizeFraction`**: these two
  `tune.json` values must currently be kept in sync by hand if either
  is ever tuned again (see 3.1's caveat above) - flagging since
  `BRIEF.md` doesn't currently document this coupling anywhere a future
  session would find it before making that mistake.
- **The button/fan space budget is now fully spent**: with
  `BOTTOM_ROW_BOTTOM` at 16 and the action button at 117 tall, there is
  very little further room to grow either the action button or the
  local nameplate again without re-opening the same conflict - worth
  flagging in `BRIEF.md` if either is expected to grow further in a
  future pass.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps; the
`'partner'` hand-fan state still has no working visual differentiation
from `'legal'`; the itch.io iframe canvas-scale fix, the asset
pipeline's downscale/recompress output, the Center HUD easing curve,
the trick-result dwell hold, the card-play arc animation, the Awakened
reveal, and the end-of-trick collect animation all still want a real-
device/live-deploy glance. suits-mp still has no permanent
`?debug=1`-gated `ForcedDeal` hook (unlike the sibling `suits`
prototype's `rules/debugScenarios.ts`) - this is now the tenth task in
this feature area to build and tear down its own one-off version.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the standing next open loop. For this task specifically,
the newly-tight `BOTTOM_ROW_BOTTOM`/`FAN_BASELINE_Y`/action-button
budget (see "Open questions" above) is worth a real-phone check - all
of today's measurements were taken at the reference 390px desktop
viewport, and margins this thin (single-digit pixels in a few spots)
are the kind of thing that can read differently at real mobile pixel
density.
