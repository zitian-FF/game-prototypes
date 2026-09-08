## Current milestone

Added automatic image downscale/recompression to the shared asset-pack
pipeline (`scripts/pack-assets.js`), opted suits-mp into it, and measured
a 27.2MB -> 1.1MB (96%) reduction in the loose-asset payload. This is a
pipeline fix, not a one-off manual resize: it runs automatically inside
the existing `fetch:assets`/`pack:assets` flow and applies to any future
R2 upload for suits-mp, at whatever resolution it arrives at, with no
manual pre/post-processing step by anyone.

## What was implemented

- **`scripts/pack-assets.js`** (shared by every prototype): added an
  `IMAGE_OPTIMIZATION_RULES` config, keyed by prototype name, opt-in per
  prototype - a prototype with no entry gets exact byte-for-byte
  passthrough, unchanged from before. Each rule can set `maxDimension`
  (fit inside an NxN box, aspect preserved, never enlarges) and/or
  `format`/`quality` (currently only `'webp'` is implemented). The loose-
  asset copy loop now runs each file through the first matching rule (if
  any) via `sharp` before writing it into `public/prototypes/<name>/
  assets/loose/` and hashing it into the manifest - the manifest's
  existing content-hash cache-busting is computed on the final processed
  bytes, so it picks up a resize/format change exactly like any other art
  change, with no changes to that mechanism itself (per this task's
  explicit instruction not to touch it).
  - Logs a one-line before/after size summary (`optimized loose/ -
    X.XMB -> Y.YMB (Z% smaller)`) whenever a prototype has rules, so this
    is visible on every future `pack:assets` run, not just this one.
  - Verified zero behavior change for prototypes with no rules entry: ran
    `fetch:assets`/`pack:assets` for `digger` (which has real `loose/`
    PNGs) and confirmed its output files are byte-identical (`sha256sum`
    match) to the source, exactly as before this change.
- **`package.json`**: added `sharp` as a real, direct `devDependency`
  (pre-approved for this exact purpose per root CLAUDE.md's dependency
  rule) - it was previously only present transitively (via
  `free-tex-packer-cli`'s own dependency on it), which is not something
  to build new functionality on top of.
- **suits-mp's `IMAGE_OPTIMIZATION_RULES` entry** (two rules, checked
  against every real call site before picking numbers - see below):
  1. `background_tabletop_stone`: `format: 'webp', quality: 88` -
     **no `maxDimension`, deliberately**. See "Key technical decisions."
  2. Everything else (card backdrops/frames/symbols/faces/nameplates,
     the two `ui_*` chrome textures, and the two now-dead `rank_badge_*`
     files still shipped from the R2 zip - see the three-state-card-
     system task's `BUILD_STATUS.md`): `maxDimension: 512, format:
     'webp', quality: 88`.
- **`dom/godArtUrl.ts`**: `symbolArtUrl()`/`actionSlabUrl()`/
  `nameplateUrl()` now build `.webp` URLs instead of `.png` - the only
  code that needed to change for the format switch. Everywhere else
  (the canvas loader, `ui/cardArt.ts`'s manifest-driven
  `queueLooseImages()`) derives its texture key by stripping whatever
  extension a file actually has, so it needed no changes at all.

## Key technical decisions

- **512px card-art bound, derived from real usage, not guessed.**
  Traced every consumer of the card-family art: the canvas compositor
  (`ui/cardArt.ts`'s `placeContain()`, `k = dims.width / 1024`) tops out
  at `CARD_DIMS_STANDARD` (76x114 logical) x `handFanPopOutScale` (1.08,
  the hand fan's only enlargement) x `PIXEL_RATIO` (capped at 2x) =
  ~165x246 physical px at most; every DOM `<img>` use of the same
  `deity_symbol_*` art (`GameOverlay.tsx`'s Suit Cycle HUD badges at
  `WELL_SIZE * 0.68` = ~29px logical, the Required Suit banner icon at
  18px logical) is smaller still. 512 leaves roughly 2x headroom above
  the real ~246px ceiling while still being a large real reduction from
  the 1024x1536 authoring canvas (a 3x reduction per edge, ~9x fewer
  pixels).
- **The tabletop background is NOT downscaled - this reverses the
  task's own working assumption, backed by the numbers.** Its real
  on-screen footprint isn't a plain fit-to-canvas: the prior task's
  alignment fix (`ui/renderGameView.ts`'s `drawTabletop()`) places it via
  an anchor-and-cover formula so its measured sigil point lines up with
  the DOM center wheel, which for this specific wheel position needs a
  *covering* scale of ~0.566x the native size in logical px - i.e. a
  displayed size of ~476x1059 logical px, or ~952x2118 **physical** px at
  2x device pixel ratio. The asset's actual native resolution is
  841x1870 - already *below* that physical-pixel requirement, meaning
  it's already being slightly upscaled (~1.13x) at max DPR under the
  current alignment. Downscaling it further would make an existing
  slight-upscale situation worse, not fix an oversized asset - so this
  rule recompresses to WebP only, at native resolution, and says so in
  its own comment rather than silently doing nothing. This is exactly
  the "don't apply blanket rules blindly" case the task's brief called
  out by name.
- **WebP scope ended up including everything, not just the "photographic/
  painterly" subset the brief hedged on** - once the manifest-driven
  canvas loader was confirmed extension-agnostic, the only real cost was
  three hardcoded `.png` suffixes in one DOM-layer file
  (`dom/godArtUrl.ts`), which was a 3-line change. Visually inspected
  `ui_action_slab.png`/`ui_player_nameplate.png` (also painted/textured,
  not flat vector graphics) before including them - no banding risk
  expected or observed.
- **`quality: 88`** chosen from a direct visual comparison (see
  Verification) rather than picking a number off a general guideline -
  even a full-resolution 1:1 crop of the tabletop background (the
  asset most likely to show lossy artifacts, given it's recompressed
  without any resolution reduction to also hide small errors) showed no
  visible difference from the PNG original.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Real measured payload size** (not estimated): ran the actual
  `fetch:assets suits-mp` + `pack:assets suits-mp` pipeline.
  - **Before** (current production PNGs, measured directly - the
    R2-sourced originals, not a re-derived estimate): 27,194,727 bytes
    (27.2MB) raw on disk. Gzipping them (to check whether the "27MB"
    figure in the brief was a pre- or post-compression number) barely
    moves it: 27,082,601 bytes (27.0MB) - PNG is already internally
    DEFLATE-compressed, so gzip on top saves under 1%. **The 27MB figure
    is effectively the real network-transfer size either way**, not an
    uncompressed-only artifact.
  - **After**: 1,091,516 bytes (1.1MB) raw; 1,091,815 bytes gzipped
    (WebP is likewise already compressed, so gzip is a similar no-op).
  - **Net: 27.2MB -> 1.1MB, a 96% reduction**, confirmed identically via
    the built `dist/prototypes/suits-mp/assets/loose/` output.
- **Visual quality, at real display sizes, not just file-size deltas**:
  - Resized both the original PNGs and the new WebP outputs down to
    their actual real on-screen size (165x246 physical px, the card-art
    ceiling derived above) and compared side by side for
    `card_frame_cthulhu`, `deity_face_cthulhu`, and `card_backdrop_
    cthulhu` - no visible difference in either linework or painted detail.
  - For the tabletop background (recompressed only, not resized):
    compared a native-resolution 1:1 crop of the sigil's ring detail
    between the original PNG and the new WebP - no visible banding,
    blur, or artifacting despite this being the highest-risk comparison
    (no downscaling to help mask small errors).
  - **Live-game Playwright screenshots**, both at the repo's standard
    1x viewport and with `deviceScaleFactor: 2` (Playwright's own device-
    pixel-ratio emulation, matching this app's `PIXEL_RATIO` cap) to
    stress-test the worst case for texture upsampling: hand-fan cards,
    the center wheel's suit badges, and the tabletop background are all
    crisp with no visible blur/artifacts at both scales.
  - Confirmed digger's `pack:assets` output is still byte-for-byte
    identical to its source `loose/` PNGs (`sha256sum` match on
    `coin.png`/`tile_grass.png`/`ui_go.png`) - the new pipeline code is a
    true no-op for every prototype that hasn't opted in.
- `page.on('pageerror')` empty; console errors limited to the same
  pre-existing baseline noise from prior tasks (a sandboxed Google Fonts
  request, one intermittent unrelated 404).

## Open questions

None from `BRIEF.md`. The brief's own two open questions are answered
above: (1) the 27MB figure is effectively the real transfer size, gzip
or not, since both PNG and WebP are already internally compressed; (2)
the achieved reduction is 96% (27.2MB -> 1.1MB), measured directly.

## Known issues

- Carried over, untouched by this task: genuine gameplay verification of
  off-suit masking via real bot/human play is still pending; Rules-modal
  content gaps (no Setup section, off-suit hidden-identity nature
  unstated in the copy); the other three seat tags still don't use
  `ui_player_nameplate.png` (deliberate, from an earlier visual pass);
  the itch.io iframe canvas-scale fix, the asset-preload progress bar's
  `PlayerGameScene` path, and this task's own pipeline output all still
  want a real-device/live-deploy glance (nothing here changes runtime
  behavior in a way expected to interact badly with any of them, but
  none of the three has been checked against an actual itch.io build).
- `rank_badge_chaos_portal.png`/`rank_badge_cosmos_galaxy.png` are still
  fetched, packed, and now optimized even though no code references them
  (confirmed dead in the three-state-card-system task) - harmless, but
  removing them from the R2 zip itself (not something this pipeline
  controls) would save a little more.

## Next proposed step

None specific to this task. If another prototype ever wants this same
downscale/recompress treatment, add its own entry to
`scripts/pack-assets.js`'s `IMAGE_OPTIMIZATION_RULES` following the
pattern here - see `STACK.md`'s new "Art asset pipeline" section for the
general guidance on picking real (not guessed) thresholds.
