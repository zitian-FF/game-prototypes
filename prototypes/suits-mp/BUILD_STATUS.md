## Current milestone

Restored the Center HUD's rotating Suit Cycle behavior, by explicit user
override of the immediately prior task's approved spec - **and** kept
that prior task's Lead glow/LEAD label, also by explicit user request.
Both mechanisms now run together: the bezel physically rotates so the
current lead suit's baked-in recess lands at a fixed marker position
(local top), and that same recess is also highlighted with the glow +
label. Nothing else in the prior task's Consolidated asset wave (card
system, background alignment, gameplay logic) was touched.

## Deviation from the prior task's approved spec (for GPT reconciliation)

The immediately prior task ("Consolidated asset wave") made the bezel
and all four recess positions permanently fixed, with only the Lead
glow/LEAD label moving between static recesses - explicitly replacing an
older rotating-wheel mechanism. **This task reverses that rotation
decision by explicit user instruction**, while explicitly keeping the
glow/label mechanism the prior task introduced (the user asked for both
together, not one replacing the other). Net effect for GPT's own
reconciliation notes: rotation is back, but so is the glow/label - this
is not a full revert to the old pre-asset-refresh ring system, since the
underlying mechanism is genuinely different (see below).

## What changed and why

**Files changed**: `dom/overlay/GameOverlay.tsx`, `tune.json`. No changes
needed to `overlayContent.ts` or `GameOverlay.css` (see below).

**The mechanism is not a direct reuse of the old rotating-ring system.**
The old system (before the Consolidated asset wave) rotated separate
DOM/CSS ring elements with independently-positioned badges inside them,
and highlighted whichever badge had rotated to the Invoker's actual seat
(`starterSeat`-tracking, via `SEAT_DEG`). The new bezel
(`ui_suit_cycle_bezel.png`) bakes all four recesses into one texture -
there is no way to move a recess independently any more. So the new
mechanism instead:

- Wraps the bezel `<img>` and all four recess-anchor `<div>`s (each still
  at their fixed `RECESS_OFFSET[i]`) in one rotating group
  (`data-ui="suit-cycle-bezel-group"`), rotated by `suitDeg` - the bezel
  and its baked-in recesses move together as one rigid unit, since
  they're pixels on the same texture.
- `suitDeg = useForwardRotation(leadGodIndex, 4, -90)`. Recess `i`'s home
  angle is `i * 90` (local top/right/bottom/left, matching
  `SUITS`/`GOD_TO_SUIT_INDEX`'s order); rotating the whole group by
  `-leadGodIndex * 90` always brings that recess to angle 0 (local top),
  regardless of which suit currently leads. Reuses the same
  forward-only/freeze-on-null/never-snap-back `useForwardRotation` hook
  the pointer already used - only which index it follows differs.
- **Not coupled to `starterSeat`/the Invoker's seat this time** - the
  marker is a single fixed screen position (local top), not a
  seat-tracking one like the old ring. The task didn't ask for
  seat-tracking, so this stays simpler than the pre-asset-refresh system.
- Each recess's symbol (and its Lead glow/LEAD label, when lit) sits in
  an inner `<div data-ui="suit-cycle-counter-rotate">` that rotates by
  `-suitDeg` - the exact inverse of the group's rotation - so it stays
  visually upright regardless of the bezel's current angle. This is the
  same counter-rotation trick the old per-badge ring elements used,
  reapplied to the new single-overlay-per-recess structure.
- `litGodIndex` (`useLastKnown(leadGodIndex) ?? 0`) is unchanged from the
  prior task - by construction, whichever recess is lit is always the one
  the rotation has brought (or is animating toward) the marker position,
  so the same index drives both the rotation target and the highlight.
- The current-turn pointer (`turnDeg`, `useForwardRotation(turnSeatIndex,
  4, 90)`) is completely untouched and structurally outside the rotating
  group - it keeps rotating independently toward `currentTurnSeat`, never
  coupled to `suitDeg`.

**Rotation-safety check (gate, before implementing)**: measured
`ui_suit_cycle_bezel.png` directly - pixel-diffed the art against its own
90/180/270-degree rotations and built a 4-panel visual comparison.
Confirmed genuine 4-fold rotational symmetry: four identical circular
recesses at N/E/S/W, four identical crescent-moon medallions and diamond
spike gems at the diagonal/cross-arm positions, no unique orientation
marking, no asymmetric decoration, no text or baked-in "top" cue. Safe to
rotate as a rigid unit - proceeded.

**`tune.json`**: restored `suitCycleRotationMs` (950) and
`suitCycleRotationEasing` ("cubic-bezier(0.3, 1.08, 0.2, 1)") - the exact
pre-Consolidated-asset-wave values, reused rather than reinvented, now
driving both the bezel group's rotation and each recess's counter-
rotation (kept in lockstep so the symbol/label visually stay locked to
their recess through the whole transition, not just at rest). Kept
`leadGlowPulseMs`/`leadGlowPulseEasing` (2200 / "ease-in-out") unchanged,
since the glow they drive is still present.

**No changes needed to `overlayContent.ts`**: `SEAT_DEG` was not restored
since the new marker is a single fixed position, not
`starterSeat`-tracking - there was nothing for it to drive here.

**No changes needed to `GameOverlay.css`**: rotation is done via inline
`transform`/`transition` (matching the pointer's own existing pattern),
not a CSS keyframe - the existing `suitsMpLeadGlowPulse` keyframe and its
"one deliberate exception to no continuous loops" comment are unchanged
and still accurate, since the glow mechanism itself didn't change.

## How this was verified

- `npm run typecheck` (repo root) - clean.
- `npm run build` (repo root) - clean.
- Real asset pipeline re-run (`fetch:assets`/`pack:assets suits-mp`) -
  bezel/symbol/pointer art unchanged (same ETag), confirmed present
  locally.
- **Live Playwright verification** via a temporary debug hook
  (`window.__testOverlay` in `main.ts`, calling `gameOverlayStore`'s
  `showGameOverlay` directly with fabricated state - added, used, then
  fully reverted; confirmed via `git status`/`git diff` that only
  `GameOverlay.tsx` and `tune.json` remain changed):
  - **Lead suit = Cthulhu, turn = top seat**: bezel rotated so Cthulhu's
    recess landed at the fixed top marker, with the cyan glow + upright
    "LEAD" label on it; Yog-Sothoth/Shub-Niggurath/Nyarlathotep rotated
    consistently to left/right/bottom as a rigid group (confirmed by
    pixel-sampling each recess's accent color, not just eyeballing).
    Pointer pointed up, matching `currentTurnSeat: 'top'`.
  - **Lead suit = Nyarlathotep, turn = left seat**: bezel rotated further
    (forward-only, per `useForwardRotation`) so Nyarlathotep's recess
    landed at the same fixed top marker, with the purple glow + label
    now on it; the other three suits rotated correspondingly. Pointer
    pointed left, matching `currentTurnSeat: 'left'`, **decoupled** from
    the bezel's own rotation (confirmed via each element's independent
    `getComputedStyle().transform` matrix).
  - In both states, all four symbol icons and the "LEAD" text rendered
    fully upright (no visible tilt) despite the bezel sitting at a
    non-zero rotation angle - counter-rotation confirmed working.
  - `center-hud`'s on-screen bounding-box center measured
    `getBoundingClientRect()` = `(195, 305)` in both states, exactly
    `CENTER_X`/`CLUSTER_CENTER_Y` - confirms the fixed marker position
    still lines up with the tabletop sigil (re-verified, not assumed,
    since a rotating child inside a centered fixed-size parent shouldn't
    move the parent's own bounding box, but the task asked this be
    checked live rather than assumed).
- `page.on('pageerror')` empty on every run; console errors limited to
  the same pre-existing baseline noise from prior tasks (a sandboxed
  Google Fonts request failing in this environment) - confirmed present
  identically on an un-instrumented boot of the real landing page, so
  not a regression from this change.

## Open questions

None new this task. The task's own instructions were explicit enough
(fixed marker at local top, no Invoker-seat coupling requested) that no
mid-session clarification was needed.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); `ui_player_nameplate.png` still applies to the local seat
tag only (deliberate); the `'partner'` hand-fan state still has no
working visual differentiation from `'legal'`; the itch.io iframe
canvas-scale fix and the asset pipeline's downscale/recompress output
still want a real-device/live-deploy glance; this task's rotation change
has likewise only been checked in a local dev-server Playwright pass, not
against an actual itch.io build.

## Next proposed step

Relay this task's deviation (rotation restored **and** glow/label kept,
both together - not a straight revert) back to GPT/Codex for
`suits-mp-screen-reference.md` reconciliation, alongside the earlier
symbol-size-unification override. A real-device/live-deploy pass covering
everything listed under "Known issues" remains the next open loop.
