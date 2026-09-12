## Current milestone

Turned the Awakened/Powered Deity Card's foil effect from a one-shot
reveal-only flourish into an ongoing, always-visible idle shimmer:
every Powered Deity Card (hand fan, play area, previous-trick log)
now continuously shows a scrolling rainbow foil sheen for as long as
it stays Powered, stopping automatically the instant the trick ends
(the same point it always reverted from Powered back to Dormant).

## What was implemented

- New `addPoweredIdleShimmer()` in `ui/cardArt.ts`, called from
  `buildCard()`'s existing Powered branch (right where the Deity face
  art gets placed) so every Powered card - anywhere it's drawn - gets
  the effect with no change to any call site.
- The effect is a continuously scrolling repeating 4-color band strip
  (pink/yellow/cyan/purple, the same palette `playAwakenedEffect`'s
  one-shot burst already used), masked to the card's own face-art
  silhouette via the same `BitmapMask` technique that burst already
  established (so the color only ever shows through the painted
  Deity, never as a stray rectangle). It translates by exactly one
  full color-cycle per `tune.awakenedIdleShimmerMs`, so the pattern
  tiles seamlessly and loops forever with no visible snap or reversal.
- Two new tunables: `awakenedIdleShimmerMs` (1100) and
  `awakenedIdleShimmerAlpha` (0.6) - both introduced fresh in this
  task (not pre-existing human-tuned values), so tuned freely per
  CLAUDE.md's rule that only *already-tuned* values are off-limits.
- `playAwakenedEffect` (the existing one-shot reveal burst, fired once
  right when a card first lands or becomes eligible for Powered) is
  completely untouched - it still fires exactly as before; the new
  idle shimmer is a separate, additional, ongoing effect that also
  runs for as long as the card stays Powered afterward.

## Key technical decisions

- **Normal alpha blend, not the burst's own ADD blend.** Additive
  blending only ever brightens a pixel - against pale/light card art
  (confirmed live: Yog-Sothoth's own face art is quite pale) it washes
  out toward white with almost no visible color, which is the opposite
  of "obvious." Plain alpha-blended color shows the same rainbow hue
  clearly regardless of the underlying art's own brightness, dark or
  light - required for a foil effect that has to look right across
  all 4 Deities' face art, not just the ones with darker palettes.
- **A repeating band strip, not one big 4-corner gradient.** The first
  attempt reused the burst's own single smooth gradient, sized much
  larger than the card (so a moving/rotating quad would never expose a
  gap) - but that puts the *visible* window near the gradient's own
  middle, where all 4 corner colors blend toward a similar average, so
  the card barely shows any hue change no matter how the quad moves or
  rotates. Explicit bands, each sized as a fraction of the card's own
  width, guarantee real color *contrast* is always visible within the
  card itself. This was found through direct pixel-level comparison
  between captured frames (not just eyeballing screenshots) after two
  earlier design attempts (a small positional sway, then a rotating
  gradient) both proved to move too little relative to how small a
  hand card actually renders on a phone-width canvas.
- **Cleanup/lifecycle**: `ui/renderGameView.ts`'s `renderWithView`
  wipes and rebuilds the *entire* canvas tree from scratch
  (`container.removeAll(true)`) on every single render pass, including
  ones triggered by a mere hover/selection change - not just real
  game-state updates. Without explicit cleanup, an infinitely-looping
  tween (`repeat: -1`) would keep running forever against an
  already-destroyed Graphics object every time that happens - a real,
  accumulating leak given how often a render pass fires. Since Phaser
  containers default to `exclusive: true`, `Container.destroy()`
  cascades to every descendant, so the shimmer's own `DESTROY` event
  reliably fires the instant its card's container is torn down, on
  whichever render pass that happens to be - so
  `shimmer.once(Phaser.GameObjects.Events.DESTROY, () => tween.stop())`
  is enough; no scene-level teardown bookkeeping was needed.
- **"Stops when the trick is over" needed no separate mechanism.** The
  effect only ever gets attached inside `buildCard()`'s `state ===
  'powered'` branch, and `deityCardState` only resolves to `'powered'`
  while the engine's own trick-scoped logic (`rules/engine.ts`'s
  `computeDeityCardState`) says so - which is already reset the moment
  a trick ends. The instant a card stops rendering Powered (played, or
  the trick ended and it reverted to Dormant), the next render simply
  never builds this effect for it at all - nothing further to enforce.

## Verification

- `npm run typecheck` and `npm run build` both pass with no errors.
- Confirmed via a temporary forced-deal debug hook (added to
  `host/gameHost.ts`/`scenes/HostGameScene.ts`, fully reverted before
  commit - `git status` shows no diff on either file) driven through a
  real, live Single Player game:
  - The Dormant → Powered transition itself renders correctly (the
    golden Deity-symbol art swaps to the Deity's face art, '1' marker
    to '★'), confirmed via a precisely-timed before/after screenshot
    pair (using the real `GameState.plays` array to know exactly when
    the Ten had landed, not a guessed wait time).
  - The shimmer's tween is genuinely running and animating (confirmed
    by reading its live `x`/`angle` property directly across several
    iterations of the design, before settling on the final approach).
  - The final band-strip pattern, unmasked, renders vividly and
    correctly (confirmed by a deliberate isolation test with the
    `BitmapMask` temporarily removed) - proving the Graphics drawing
    and tween-loop mechanics are correct.
- **Known verification gap, and why it isn't a defect in this
  change specifically**: with the `BitmapMask` back in place, no
  masked/in-silhouette shimmer was visible in *this development
  sandbox's* screenshots. Investigated directly rather than assumed:
  this sandbox's browser falls back to software WebGL (SwiftShader;
  confirmed via a console warning - "Automatic fallback to software
  WebGL has been deprecated" - plus GPU-stall messages), and passing
  explicit `--enable-unsafe-swiftshader`/`--use-gl=swiftshader` launch
  flags didn't change the result. To isolate whether this was
  something introduced by this task, the exact same test was run
  against the pre-existing, completely untouched one-shot
  `playAwakenedEffect` burst - it shows the identical symptom (no
  visible masked shimmer at the moment a card lands Powered, in this
  same sandbox). This confirms `BitmapMask` rendering itself doesn't
  work in this specific software-rendering sandbox, for either effect,
  old or new - not a regression from this change. `BitmapMask` is a
  standard, broadly-supported Phaser WebGL feature on real (hardware-
  accelerated) GPUs, which itch.io/browser deployment will actually
  use; this sandbox's software fallback is the outlier, not real
  deployment. Reporting this plainly rather than claiming a masked
  screenshot that wasn't actually obtained.
- Browser console clean on boot and through a real Single Player game
  (only the known sandboxed `fonts.googleapis.com`/asset-fetch 404
  noise present in every prior task this session, plus this
  environment's own software-WebGL warnings - neither caused by this
  change).
- Confirmed no debug-hook residue: `git status` shows only
  `ui/cardArt.ts` and `tune.json` changed.

## Open questions

None the user needs to weigh in on for this task's own scope. The one
open item is the sandbox verification gap above, which is an
environment limitation to keep in mind for any *future* task that
needs to visually confirm a `BitmapMask`-based effect in this same
development sandbox - not something this task itself left unresolved.

## Known issues

The verification gap described above: this development sandbox cannot
render `BitmapMask`-masked content at all (confirmed against the
pre-existing burst effect too), so a truly masked-in-silhouette
screenshot of either the old burst or this new idle shimmer could not
be captured here. Real (hardware-accelerated) browsers are expected to
render both correctly, since `BitmapMask` is standard, broadly-
supported Phaser functionality - but this should be spot-checked on a
real device/browser (not just this sandbox) the next time this
prototype is played for real, to close the loop on this specific gap.

## Next proposed step

None specified by this task; awaiting further direction. If a real-
device check of the effect (see Known issues) turns up that it reads
too strong/weak/fast, `awakenedIdleShimmerAlpha`/`awakenedIdleShimmerMs`
in `tune.json` are the two knobs to adjust.
