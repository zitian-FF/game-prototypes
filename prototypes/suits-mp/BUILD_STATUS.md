## Current milestone

Gave the Center HUD's two rotating elements (the Suit Cycle bezel and
the current-turn pointer) a natural wind-up/settle easing curve, in
place of the existing custom curve that read as mechanically uniform
despite already being a cubic-bezier. Pure easing-curve change - the
rotation-target math (seat-relative `suitDeg`, `useForwardRotation`)
is completely untouched.

## What changed

**Files changed**: `tune.json` only.

- `suitCycleRotationEasing`: `"cubic-bezier(0.3, 1.08, 0.2, 1)"` ->
  `"cubic-bezier(0.86, 0, 0.07, 1)"` (the standard "easeInOutQuint"
  curve) - a pronounced slow start (overcoming inertia) and a
  pronounced slow settle at the end, symmetric around the midpoint. The
  old curve's `y > 1` control point (`1.08`) produced a slight
  overshoot/bounce past the target before settling back, which isn't
  the same thing as a wind-up/settle feel and wasn't what was asked for
  here - the new curve never overshoots, it just accelerates and
  decelerates more dramatically than the old curve did.
- `turnWheelRotationEasing`: `"cubic-bezier(0.24, 0.86, 0.16, 1)"` ->
  the same `"cubic-bezier(0.86, 0, 0.07, 1)"`, for visual consistency
  between the HUD's two rotating elements (the bezel and the pointer) -
  no reason found for them to feel different, so defaulted to matching
  per the task's own instruction.
- `suitCycleRotationMs` (950) and `turnWheelRotationMs` (700) are
  **unchanged** - only the curve shape changed, not the duration, per
  the task's explicit requirement.
- No code changes anywhere: both `GameOverlay.tsx` transitions
  (`transform ${tune.suitCycleRotationMs}ms ${tune.suitCycleRotationEasing}`,
  used identically for the bezel group and each recess's counter-
  rotation, plus the separate pointer transition) already interpolate
  `tune.json`'s easing string directly - a value-only change was
  sufficient, nothing to wire up.
- Confirmed still live-tunable: `debug/debugPanel.ts`'s Tweakpane panel
  binds every `tune.json` key generically (string values, including
  every easing curve, get a plain text field automatically - no
  per-key code), so both new values are exposed under `?debug=1` with
  zero additional work, same as before.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- Confirmed both `suitCycleRotationEasing` and `turnWheelRotationEasing`
  still appear as live text-editable fields in the `?debug=1` Tweakpane
  panel, showing the new curve values.
- **Sampled the actual rendered animation**, not just the CSS string:
  a temporary, read-only debug hook (`HostGameScene.ts` storing the
  host's last-built `MaskedState`; `main.ts` exposing it plus a real-
  legal-card click-target helper - same pattern as the two immediately
  prior tasks, added, used, then fully reverted; `git diff` against
  `main` is empty except `tune.json`) drove one real trick's forced
  Yog-Sothoth opener, and a Playwright script polled
  `getComputedStyle().transform` on the bezel group every ~30ms during
  the transition, converting each frame's rotation matrix to an angle
  and unwrapping across the atan2 ±180deg discontinuity. The resulting
  angular-velocity profile (degrees moved per ms, between consecutive
  samples) came out as: ~0.06/ms in the first ~150ms, rising to a peak
  of ~1.5/ms around the transition's midpoint (~350-440ms of the
  950ms total), then decaying back down to ~0.01/ms by ~900ms before
  settling exactly on the target angle - a clean, symmetric slow-fast-
  slow sigmoid, confirming the easeInOutQuint curve is actually
  producing the intended wind-up/settle motion in the real rendering
  pipeline, not just declared in a config string.
- Browser console clean on boot (only the pre-existing, unrelated
  sandboxed Google Fonts network noise present on every boot in this
  environment) - both with the temporary debug hooks in place and
  after reverting them.

**This change still wants the user's own eyes on a real device.** The
angular-velocity sampling above proves the curve *shape* is a genuine
ease-in-out (not linear, not the old curve's slight overshoot), but
"does this feel like natural weight/momentum" is a subjective call a
number sequence can't fully settle - please give the rotation a look
on your own device via `?debug=1` (or just normal play) before
considering this fully done; the `suitCycleRotationEasing`/
`turnWheelRotationEasing` Tweakpane fields are right there to try
alternate curves live if this one doesn't land.

## Open questions

None new.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); `ui_player_nameplate.png` still applies to the local seat
tag only (deliberate); the `'partner'` hand-fan state still has no
working visual differentiation from `'legal'`; the itch.io iframe
canvas-scale fix, the asset pipeline's downscale/recompress output, and
the hand-fan edge-bound fix still want a real-device/live-deploy glance;
this task's easing change likewise has only been sampled in a local
dev-server Playwright pass - the user's own on-device judgment on the
new curve's feel is the real open item here, not an automated check.

## Next proposed step

Awaiting the user's own live verification of the new easing feel (see
above). A real-device/live-deploy pass covering everything listed under
"Known issues" remains the next open loop.
