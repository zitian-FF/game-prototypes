## Current milestone

Investigated why the Powered idle shimmer (`addPoweredIdleShimmer` in
`ui/cardArt.ts`, built in the immediately preceding task) is "still not
very obvious" in real play, per the required 3-step order: renderer
fallback first, then genuine attach/animate confirmation, only then
tuning. **Case 3 applies** - WebGL is active, the shimmer object
genuinely attaches and animates, so this is a legitimate legibility
question, not a rendering failure. Shipped a permanent, real-device-
testable diagnostic; did not touch the tuned values themselves (that
stays the user's call, per this repo's tuning rule).

## What was implemented

- `debug/shimmerDiagnostics.ts` (new): a small shared, mutable object
  (`rendererType`, `attachCount`, `lastTweenX`) plus three setter
  functions, exposing exactly the two facts the investigation's steps 1
  and 2 required a way to check on a real device with no devtools:
  - `recordRendererType(type)` - called once from `main.ts`'s existing
    `READY` handler with the real `game.renderer.type` the `AUTO` config
    actually resolved to (only knowable after `Game#boot()`, which is
    what `READY` already waits on - no new timing dependency introduced).
  - `recordShimmerAttached()` / `recordShimmerTweenTick(x)` - called from
    `addPoweredIdleShimmer()` itself (`ui/cardArt.ts`) every time it
    actually runs and while its tween ticks.
- `debug/debugPanel.ts`: added a "Powered shimmer diagnostics" folder to
  the existing `?debug=1` Tweakpane panel, with three read-only, polled
  (`interval: 250`) monitor bindings against the object above. Not tune
  values (nothing here is written back to `tune.json`) - a diagnostic
  addition alongside the existing tunable bindings, same pane.
- `main.ts` / `ui/cardArt.ts`: minimal wiring calls into the above (see
  diff - three small additions, no logic changed).

## Key technical decisions

- **Investigated in the required order, did not jump straight to
  tuning.** Confirmed via Phaser's own source
  (`node_modules/phaser/src/core/CreateRenderer.js` /
  `device/Features.js`) that this prototype's `type: Phaser.AUTO`
  config (`main.ts`) is a genuine risk: `AUTO` resolves via a real
  `canvas.getContext('webgl')` feature-detection test at boot, which can
  legitimately return Canvas on some real devices/browsers (battery-saver
  GPU throttling, embedded/in-app webviews, very old hardware, privacy-
  hardened browsers) - and `addPoweredIdleShimmer`'s existing
  `scene.renderer.type !== Phaser.WEBGL` guard makes it a complete no-op
  under Canvas. This is why the diagnostic's first field is
  `rendererType`, read from the real post-boot value, not assumed.
- **Confirmed step 2 end-to-end, not just theoretically.** Built a
  temporary forced-deal (`ForcedDeal`, already a permanent engine/type
  since a much earlier task - only the debug-only call site was
  temporary) to reach a real Powered Deity Card almost immediately, fully
  reverted before commit (`git status`/`git diff` show only the four
  files above changed - `host/gameHost.ts` shows zero diff). This
  surfaced a real bug in my first attempt at the forced deal: the
  required suit for each position in a trick is **not** simply the
  leader's own suit - it rotates through `SUIT_CYCLE` one step per
  position (`requiredSuitForPosition`/`suitAfterSteps`, `rules/
  engine.ts`/`rules/cards.ts`), a mechanic I hadn't accounted for. Once
  corrected, the forced Cthulhu Deity Card play resolved to
  `deityCardState: "powered"` exactly as expected, and:
  - `buildCard` was called with `state === 'powered'` and a real,
    loaded `faceImage`.
  - `addPoweredIdleShimmer` ran past its WebGL guard, attached the
    shimmer (`attachCount` incremented), and its tween genuinely
    animated (`lastTweenX` changed across repeated samples: -66, -29,
    -80, -43, -7).
  - **A real screenshot of this exact moment shows the rainbow shimmer
    visibly rendering** across the Cthulhu Deity Card's face art in the
    play area (sent to the user alongside this task) - this sandbox's
    software-rendered WebGL (SwiftShader fallback, same as every prior
    task's console warning) does **not** block BitmapMask-masked content
    from painting here, contradicting the previous task's more
    tentative "known verification gap" note. Whether that finding
    generalizes to every software-WebGL path isn't something one
    screenshot proves, but this sandbox's own instance of it clearly
    renders.
- **Did not change `awakenedIdleShimmerAlpha`/width/speed myself.**
  Root CLAUDE.md is explicit that tuned values are the user's call, set
  from actually playing the game - this task's own framing ("this
  becomes a pure visibility/tuning question") is a diagnosis, not a
  standing instruction to pick a new number. Recommendation, not applied:
  the shimmer is real but visually subtle against dark/moody Deity face
  art at alpha 0.6, and the concern about hand-fan scale specifically
  (cards render markedly smaller there than in the play area shown in
  the screenshot) is well-founded from this evidence - increasing alpha
  and/or widening the bands are the most direct levers already exposed
  in `tune.json`/Tweakpane.
- **Considered and rejected forcing `type: Phaser.WEBGL`.** Per Phaser's
  own `CreateRenderer.js`, forcing `WEBGL` on a device that genuinely
  lacks WebGL support throws (`'Cannot create WebGL context, aborting.'`)
  and the game fails to boot entirely - trading "one cosmetic effect
  invisible for some users" for "unplayable for a different set of
  users" is a worse trade without knowing this game's actual real-world
  device mix, which this sandbox has no way to measure. Left `AUTO` as
  is; the new `rendererType` diagnostic is the way to actually find out
  whether this matters in practice, from real playtests.

## Verification

- `npm run typecheck` and `npm run build` both pass with no errors.
- Playwright, this sandboxed headless Chromium only (see below for why
  real-device testing could not be performed from this environment):
  - Clean-boot console check, both with and without `?debug=1`, through
    a full Single Player start: only the same known sandboxed noise
    every prior task in this repo has logged (`ERR_CONNECTION_RESET`/404
    on an unrelated resource, present before this task too) - no errors
    introduced by the new diagnostics code.
  - `rendererType` reads `"WEBGL"` in this sandbox (a software/
    SwiftShader-backed WebGL context, per the same
    "Automatic fallback to software WebGL has been deprecated" console
    warning noted in the prior task) - confirms the diagnostic itself
    reads a real value, not a stub.
  - Forced-deal run (temporary, reverted): `attachCount` went from 0 to
    2 (one per render pass) the instant the forced Powered play landed,
    and `lastTweenX` kept changing on every ~700ms sample afterward -
    both the "attach" and "still animating" halves of step 2 directly
    confirmed, not just assumed reachable.
  - Screenshot of that exact moment (sent alongside this task) shows the
    shimmer visibly painting across the card - as close to a real visual
    check as this sandbox allows.
- **Real-device testing was not possible from this environment** (no
  physical device access) - this is the one piece of the task's explicit
  ask I could not perform. The new `rendererType`/`attachCount`/
  `lastTweenX` monitors under `?debug=1` are shipped specifically so a
  real playtest can check this directly next time, without needing
  devtools: open the panel, watch `rendererType` (should read `WEBGL`)
  and, during a trick where a Deity Card goes Powered, watch
  `attachCount` increment and `lastTweenX` keep changing.

## Open questions

None that need a `BRIEF.md` update - this was a pure investigation task
with an explicit 3-step order already fully specified by the user.
One judgment call worth flagging explicitly even though it's resolved:
whether to increase `awakenedIdleShimmerAlpha`/widen the bands is left
to the user's own next real playtest (with the new diagnostic panel
confirming rendererType first), per root CLAUDE.md's tuning rule -
happy to make that change directly once a real-device (or at least a
directly-observed) verdict on legibility comes back.

## Known issues

- Known sandboxed asset-fetch console noise (unrelated host, present
  since before this task) still appears on every boot in this
  environment - not a regression, not investigated further here (out of
  this task's scope).
- No real-device confirmation yet that `rendererType` is `WEBGL` for
  this game's actual player base on itch.io - the diagnostic panel now
  makes that checkable, but nobody has checked it on a real phone yet.

## Next proposed step

Per this task's own conclusion: get a real-device (or at minimum a
teammate's non-sandboxed browser) read of the new `?debug=1` panel
during an actual Powered trick. If `rendererType` reads `CANVAS` there,
that's the real explanation and no tuning helps until that's addressed
separately (a real-world-support-rate question, not a code one). If it
reads `WEBGL` (as expected on most modern phones) and the shimmer still
reads as too subtle by eye, increase `awakenedIdleShimmerAlpha` and/or
widen the bands in `tune.json` - the two most direct levers already
exposed - focusing specifically on hand-fan scale legibility, since
that's the scale this task's own report singled out as the weaker case.
