## Current milestone

Real card compositing (frame + god art + rank numeral) for all 40 playing
cards, per the "Suit of Madness Card Frame" Claude Design handoff. Every
face-up card anywhere in the game (hand fan, play areas, previous-trick
log) now renders the real per-god card frame, the real symbol/face art
fetched from R2, and a live rank numeral - no more `GOD_ABBR_SHORT` text
placeholder. Facedown/empty cards are unaffected (no card-back art exists
yet). Version stamp counter is at 8 (`version.json`) - unchanged, no
deploy has run yet.

## What was implemented

- New `ui/cardArt.ts`: `buildCard(scene, god, rank, dims)` - the single
  reusable compositor the task asked for, built from a data-driven
  `GOD_TOKENS` map (line/plate/glow/deep/label per god, motif hex vs
  circle), not 40 hand-authored cards.
  - **Frame**: 4 textures total (one per god, rank-independent), each
    generated once at runtime via `scene.textures.createCanvas` +
    Canvas2D (radial gradients, clip-path-equivalent polygon/rounded-rect
    fills) - reproduces the background wash, tint, vignette, gold
    border/corners, hex-or-circle motif ornaments, and the symbol-plate's
    nested rings + gradient fill. Baked at a fixed 150x408 texture
    (half the design's 300x816 reference, ~3-4x oversampled versus this
    game's largest on-screen card), then scaled down per call site via
    `setDisplaySize` - sharp at both `cardStandardWidth`/Height and
    `cardMiniWidth`/Height without regenerating anything.
  - **Symbol/face art**: the real R2 PNG (`symbol_<god>` for ranks 2-10,
    `face_<god>` for Aces), contain-fit into the design's safe rect (or
    the wider Ace bleed rect) and centered, as its own `Image` layered on
    the frame - this is what lets one frame texture serve every rank.
  - **Rank numeral**: a live `Phaser.Text` (never baked), sized/positioned
    from the same authoring-space math, with a `Graphics`-drawn plate
    shape (hex or rounded-rect, matching motif) behind it. Both are
    simply not added to the card's container for Aces, per the handoff's
    "hide the plate entirely on Aces" note.
  - `ui/cardComponent.ts`'s `drawCard()` now delegates its `faceup`
    branch to `buildCard()`, keeping the caller-supplied `CardStyle`
    (selected/legal/illegal/partner colors) as a thin rim outline + alpha
    over the real art, so the existing legality/selection color-coding in
    the hand fan didn't get silently dropped. `facedown`/`empty` are
    unchanged (still the placeholder rectangle/stripe/dashed-box - no
    card-back art exists in this handoff).
  - Scoped out (documented in `cardArt.ts`'s header comment): the
    design's engraving dot-pattern, linen hatch, and SVG grain-noise
    texture layers. All three are sub-pixel detail at this game's actual
    on-screen card size and were judged not worth the Canvas2D
    implementation cost; every layer that's actually visible at this
    scale (background/tint/vignette/border/corners/motif/symbol-plate/
    team-tag) is reproduced.
- **R2 asset pipeline**: the 8 PNGs (`symbol_<god>`/`face_<god>` x4) were
  found on R2 under `Suits-of-Madness_assets.zip`, not the
  `<prototype-name>_assets.zip` convention `scripts/fetch-assets.js`
  assumes (confirmed by testing both URLs directly - `suits-mp_assets.zip`
  404s, `Suits-of-Madness_assets.zip` is the real object). Added a
  backward-compatible optional 3rd CLI arg to `fetch-assets.js` for this
  exact case (every other prototype's invocation is unchanged) and wired
  it into both `deploy-suits-mp-itch.yml` and the shared `deploy.yml` Pages
  workflow (which also builds suits-mp's page, since Vite builds every
  prototype's entry together - see its existing "One block per prototype
  that has art in R2" comment). Also fixed `pack-assets.js`, which
  `fail()`ed on an assets-src with an empty `packed/` folder (this handoff
  is loose-only, no packed animations) - now treated the same as no
  `packed/` folder at all, matching every other prototype's behavior when
  it has no animations.
  `HostGameScene`/`PlayerGameScene` gained `preload()` (suits-mp's first
  ever use of real art loading - both call `preloadCardArt()`, which
  loads the manifest then every `loose/` entry it lists, same pattern as
  `prototypes/digger/src/main.ts`) and call `ensureCardFrameTextures()`
  at the top of `create()`.
- **Card size / layout rework** (see "Key technical decisions" for why):
  `tune.cardStandardHeight` 82->114, `cardMiniHeight` 35->49 (widths
  unchanged at 42/18), matching the design's true 300:816 ratio exactly.
  This cascaded into re-deriving most of the vertical layout constants in
  `ui/renderGameView.ts` (`TOP_BOX_Y`, `CLUSTER_CENTER_Y`, `BOTTOM_BOX_Y`,
  `FAN_BASELINE_Y`) and their matching values in `GameOverlay.tsx`
  (`CLUSTER_CENTER_Y`, `TOP_TAG_TOP`, `SIDE_TAG_TOP`, `BOTTOM_TAG_TOP`,
  `TEAM_HUD_TOP`, `SORT_BUTTON_TOP`) - both files' comments cross-
  reference each other same as before. Verified visually via Playwright
  through several iterations (taller cards initially overlapped the Team
  HUD bar and the action button before the constants were retuned).

## Key technical decisions

- **Asked the user rather than guessing the aspect-ratio reconciliation**,
  per the task's explicit instruction: the design's 300x816 reference
  (ratio ~0.368) didn't match this game's existing card proportions
  (~0.512-0.514). Presented "shrink width to match ratio" vs "grow height
  and rework layout" vs "keep existing ratio, stretch the art" as
  concrete options with their tradeoffs; the user chose "grow height,
  rework layout" - full art fidelity over layout convenience. That choice
  is what drove the tune.json height bump and the cascading layout work
  above.
- **4 frame textures, not 40 (or 8)**: only god + motif determine a
  frame's appearance - rank never does - so `ensureCardFrameTextures()`
  generates exactly one canvas texture per god, reused by every rank via
  a separate symbol/face `Image` and a separate rank `Text`/`Graphics`
  layered on top per call. This is also what makes hiding the rank-plate
  entirely on Aces trivial (it's just not added to that card's container),
  rather than needing a second "Ace variant" frame texture per god.
  `createCanvas` (native Canvas2D) was used over Phaser's Graphics API
  specifically because Graphics has no radial-gradient support, which the
  design leans on heavily (tint, plate fill, vignette).
- **Symbol/face art is contain-fit + centered, not stretched**: the 8 R2
  PNGs are irregular/varied source sizes (498x721 to 513x757) with
  transparent backgrounds already tight-cropped per the task brief, so
  `buildCard()` computes `min(safeRect.w/srcW, safeRect.h/srcH)` and
  centers the result - this is what keeps every god's art at its own
  correct aspect ratio inside the frame regardless of its exact source
  pixel dimensions.
- Existing `CardStyle`-driven legality/selection feedback (gold-tinted
  "selected", teal "partner", dimmed "illegal") is preserved as a rim
  outline + alpha over the real card art rather than dropped - losing
  that color-coding would have been a real gameplay-usability regression,
  even though the task's own brief didn't mention it.

## Open questions

- None new from this session - the aspect-ratio question above was
  already resolved via `AskUserQuestion` before any code was written, per
  the task's own instruction to ask rather than guess.

## Known issues

- The hand fan's outermost 1-2 cards graze the bottom edge of the "Thy
  covenant" Team HUD bar by a few px at certain hand sizes - reduced
  substantially through three rounds of constant retuning (see "What was
  implemented") but not fully eliminated; the fan's now-114px-tall cards'
  total vertical envelope is very close to the available gap between the
  Team HUD row and the fixed-position Action button. Matches this
  screen's pre-existing tolerance for similar flush/negative gaps
  elsewhere (e.g. the original 82px-card layout already had the Trick
  Starter tag overlapping its own seat's play-area card by 9px) rather
  than a new regression, but flagging it as the one visual tightness spot
  worth a second look if a future session touches this screen's layout
  again.
- Team tag text ("TEAM CHAOS"/"TEAM COSMOS") is baked into each frame
  texture per the design, but at this game's actual card size it renders
  at under 2px tall - present for correctness/fidelity but not legible in
  play. Not worth a separate live-Text treatment since the task's DPR
  rule specifically calls out the rank numeral, not this label.
- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`); not live-verified against real human
  peers; Google Fonts fail to load in this dev sandbox's network
  environment (cosmetic fallback only); the Lobby session's Host/Join
  real-vs-placeholder navigation question.

## Next proposed step

No card-back art exists yet for facedown cards (still the placeholder
rectangle/stripe pattern) - a natural next Claude Design handoff if the
user wants full art parity there too. Otherwise, the same carried-over
items as before: Redistribution-log content (no design yet), the Lobby
Host/Join navigation decision, and a real human-peer live pass.
