## Current milestone

Visual asset integration: real R2-fetched art (card frames, Deity Symbol/
Face, rank badges, tabletop, action-slab buttons) wired into the card
compositor and board, replacing the earlier CSS-recolorable token frame
system entirely. Read all 5 handoff documents fresh (GDD, architecture/
pipeline doc, approved preview PNG, the reconstructable HTML/CSS mockup,
runtime asset manifest doc) before touching code, per this task's own
read-before-code rule, and got the two already-resolved conflicts (card
frame system, no "Awakened [Deity]" text) plus three further genuinely
ambiguous points (Menu/Set/Log button semantics, centre-inlay behavior)
answered by the user before implementing, rather than guessing.

## What was implemented

**Card compositing (`ui/cardArt.ts`, full rewrite)** - `buildCard()` now
composites three real PNG layers instead of Canvas2D-generated ones:
`card_frame_<deity>.png` as the full card background (a per-god frame with
a baked-in main window and a baked-in bottom-left circular badge socket -
both measured directly off the real art via alpha-channel inspection,
since no pixel spec doc came with the handoff; see the git history's
measurement script for the method), the god's `deity_symbol_<deity>.png`
(numbered cards, and a Dormant Deity Card) or `deity_face_<deity>.png` (a
Powered Deity Card only) in that window, and a `rank_badge_chaos_portal.png`/
`rank_badge_cosmos_galaxy.png` (by Team) in the badge socket, with a live
Phaser.Text on top per root CLAUDE.md's DPR rule - the plain rank numeral
for a numbered card, or the Dormant/Powered marker ("1"/"★") for a Deity
Card. The entire earlier token system (`GOD_TOKENS`, `drawFrameTexture`,
`drawSymbolPlate`, `drawMotifOrnaments`, `ellipseRadialFill`,
`roundedRectPath`, `hexPolygon`, `fillPolygon`, `ensureCardFrameTextures`,
`frameKey`'s Canvas2D generation, the old `AUTH_W`/`AUTH_H`/`TEX_SCALE`/
`SYMBOL_SAFE`/`ACE_BLEED`/`RANK_SAFE` constants) is deleted, not layered
under the new art - confirmed via the same rewrite, and its two call sites
(`HostGameScene.ts`/`PlayerGameScene.ts`'s `ensureCardFrameTextures(this)`)
removed, since real PNGs load via the existing manifest-driven
`preloadCardArt`, no per-god texture generation step needed anymore.
- **A Deity Card's display name never changes between states** -
  `rules/cards.ts`'s `deityCardDisplayName()` (added, unused, in the prior
  engine task) returned `"Awakened [Deity]"` when Powered; per this task's
  resolution that's now wrong, and since nothing had started consuming it
  yet, it's deleted outright rather than patched into a no-op.
- **`rules/godArt.ts`**: the god->filename slug convention updated to match
  the real manifest exactly (`deity_symbol_<god>`/`deity_face_<god>`/
  `card_frame_<god>`, underscore-separated - the old convention used
  `symbol_1_cthulhu`/hyphenated `shub-niggurath` and would not have
  resolved to any real file). Added `frameArtFile()` and a Team-keyed
  `rankBadgeArtFile()`.
- **`tune.json`**: `cardStandardWidth` 42->76, `cardMiniWidth` 18->33 -
  the new `card_frame_<deity>.png` is a clean 1024x1536 (2:3) image,
  nothing like the old token system's narrow 300:816 "Air Deck" authoring
  ratio the previous card-frame task tuned these to. The brief's own
  "preserve source alpha and aspect ratio" requirement made this
  unavoidable (stretching the new frame art to the old narrow ratio would
  distort it); heights are unchanged to minimize disruption to the
  layout constants already tuned around them. Same category of change as
  the prior card-frame task's own height bump (82->114) for the same
  reason - an art-driven dimension fix, not arbitrary tuning.
- **Dormant/Powered state now reaches the renderer for real**: `TrickPlay`'s
  `deityCardState` (added in the prior engine task, previously unconsumed)
  is threaded through `net/actions.ts`'s `MaskedTrickPlay` and
  `host/mask.ts`'s `buildMaskedState()` (both `currentTrick` and
  `previousTrick`), then into `ui/cardComponent.ts`'s `CardFace` (a new
  optional field on the `faceup` variant) and finally into `buildCard()`.
  A card still sitting in a hand or a redistribution stack has no
  `deityCardState` (it hasn't been played yet) and always renders its
  Dormant treatment, per the engine's own rule that state is only ever
  determined at the moment of play.
- **Board**: `background_tabletop_stone.png` drawn full-bleed as the first
  (bottom-most) canvas element every render pass; a procedural (no asset
  provided for this) dark rounded-rect "recess" drawn behind each of the 4
  play-area slots.
- **Menu / Set / Log**: a new top-left "Menu" button (carved black-and-gold
  `ui_action_slab.png` family, per the approved preview) opens a new
  `dom/MenuModal.tsx` hosting the two things that used to sit behind their
  own top-bar buttons - Rules and the previous-trick log. The bottom-left
  Sort button is relabeled "Set" (same behavior, `⌘` glyph per the
  preview); the bottom-right Redistribution Log button is relabeled "Log"
  (same behavior). The old canvas-drawn top-bar Rules/Log buttons are
  removed from `renderTopBar` (which now only draws the Trick/Phase text).
- **Required Suit banner** - new DOM element between the player cluster and
  the hand fan, showing the live required suit's symbol + name (or "Any
  Suit" while leading) - the player-facing prompt the board requirements
  asked for. Does not duplicate a symbol inside the centre inlay (see
  below).
- **"Invoker" -> "Lead Player"** - the seat tag text in
  `dom/overlay/GameOverlay.tsx` renamed to match both the approved preview
  and the fresh GDD read this session, which no longer uses "Invoker"
  anywhere (a second, independent terminology drift beyond the Ace->Deity
  Card one, caught by the same fresh-read discipline).
- **`dom/rulesContent.ts`**'s "Taking a Trick" copy rewritten from the
  stale "The Ace overcomes a Ten only when it falls after it..." sentence
  (already flagged stale in the prior engine task) to the real Dormant/
  Powered mechanic in the same voice as the rest of that section.
- **Centre Suit Cycle HUD / turn-indicator ring**: per explicit user
  decision, kept exactly as-is functionally (rotation, freeze-on-null,
  lead-marker highlighting all untouched) - not re-skinned as static hex/
  circle wells. A visual "carved stone well" re-skin of the existing ring
  badges (same shape/rotation behavior, different surface treatment) is
  left as a follow-up polish item, not attempted this pass.

## Two conflicts already resolved by the user (applied as given)

- **Card frame system**: switched to the baked images, old token system
  removed outright rather than layered - see above.
- **Powered Deity Card display name**: name never changes; state is
  Symbol/Face art + "1"/"★" marker only - see above. **Important
  discrepancy found and reported, not silently resolved**: the brief
  stated "The GDD has been updated to match this decision." A fresh read
  of the live GDD this session shows it has **not** - the Card List
  section, its "Deity Card visual activation concept" paragraph, all four
  per-Deity rows, and the Compact Card Representation section all still
  say "Awakened [Deity]" throughout. This was reported to the user
  directly in-session rather than assumed away; implementation proceeded
  on the user's own explicit in-chat resolution (which functions as an
  override regardless of the document's current text), but **the GDD
  document itself still needs a manual edit** - this session has no tool
  capable of writing Google Doc body content (only title/location
  metadata), so it could not make that edit itself.

## Three further ambiguities the user resolved before implementation

- **Menu button** (new, no equivalent in the current UI): opens a real
  hub, not just a Rules relocation - implemented as `MenuModal.tsx` hosting
  Rules + Previous Trick.
- **Set button**: confirmed to be the existing hand Sort toggle, relabeled.
- **Log button**: confirmed to be the Redistribution Log (not the
  previous-trick log, which moved into the new Menu instead).
- **Centre inlay**: confirmed to keep its existing rotating/highlighting
  behavior rather than becoming a static decorative element - see above.

## How this was verified

- `npm run typecheck` (repo root) - clean.
- `npm run build` (repo root) - succeeds; real R2 art fetched via
  `npm run fetch:assets suits-mp` + `npm run pack:assets suits-mp`
  (existing pipeline, no second loader) - all 17 manifest filenames
  present and correctly hash-keyed into `public/prototypes/suits-mp/assets`.
- **R2 zip structure discrepancy found and reported, non-blocking**: the
  manifest doc says the zip "must open directly to loose/ and packed/, no
  enclosing folder," but the real uploaded zip wraps everything in one
  `suits-mp_assets/` folder. `scripts/fetch-assets.js` already has an
  explicit one-level-flatten step for exactly this case (confirmed by
  running it against the real zip) - not a hard failure in practice, but
  flagged here since it doesn't match the manifest doc's own stated rule.
- **Isolated card-compositing verification**: a temporary Phaser harness
  page (`harness-test.html`, deleted before finishing) called `buildCard()`
  directly for 6 cases - Dormant and Powered YogSothoth, Dormant and
  Powered Cthulhu, plus two ordinary numbered cards (ShubNiggurath 7,
  Nyarlathotep 10) - and both screenshotted the result and read the actual
  Phaser.Text marker values back out of the scene. Confirmed exactly
  right: Dormant shows Deity Symbol art + "1"; Powered shows Deity Face
  art + "★"; numbered cards show Deity Symbol art + their plain rank. The
  marker was initially illegible against the badge art at small sizes -
  fixed by adding a dark stroke/outline to the marker text (real,
  necessary contrast fix, applied before finishing rather than left as a
  known issue).
- **Full-game Playwright pass** against `npm run preview`: booted the
  lobby (clean), started a single-player-vs-bots game, and confirmed via
  screenshot at a portrait viewport (430x900 - the default headless
  viewport is landscape-ish enough to trigger the pre-existing portrait-
  guard overlay, which then hides the whole canvas behind an opaque "please
  rotate" screen; not a regression, just a test-viewport artifact) that
  the tabletop background, real per-god card frames on both played cards
  and the hand fan, the Required Suit banner, the renamed Lead Player tag,
  and the new Menu/Set/Log buttons all render together correctly. Opened
  the Menu modal and confirmed Rules opens cleanly from inside it - a real
  bug was caught and fixed here: the first wiring left the Menu modal
  state open underneath Rules (both stacked) because switching
  `ui.overlay` away from `'menu'` never called `closeMenu()`; fixed by
  calling it explicitly in both of Menu's own button callbacks before
  reassigning `ui.overlay`.
- Browser console clean on boot and through a played trick, aside from the
  known pre-existing Google Fonts sandbox-network failure and one
  intermittent, previously-established-as-unrelated 404 (present before
  this task too, never reproduced by a targeted response-listener run
  either time it was checked).

## Key technical decisions

- **Frame window/badge-socket coordinates were measured off the real
  images, not assumed** - the handoff came with exact filenames but no
  pixel-layout spec for internal placement. Used alpha-channel contiguous-
  run detection on `card_frame_cthulhu.png` to find the main window and
  the bottom-left badge socket's true bounds, then applied the same
  fractional coordinates to every god's frame (all four share the same
  layout, only the art differs).
- **Marker legibility was treated as an in-scope bug, not a known issue**
  - a state indicator nobody can read defeats the point of the mechanic;
  fixed with a text stroke rather than deferred.
- **The old per-god `GOD_TOKENS` color/motif system is gone from
  `cardArt.ts`** (the frame images bake in their own team accents now) -
  but `rules/godArt.ts`'s `GOD_MOTIF` (hex/circle per Team) is kept, since
  it's still real and load-bearing for the DOM chrome (Suit Cycle HUD
  badge shapes, RulesModal's cycle diagram, the Required Suit banner's
  icon frame) which never used the token system to begin with.

## Open questions

- The GDD document itself needs the manual text edit described above
  (removing "Awakened [Deity]" from the Card List section, its visual-
  activation-concept paragraph, the four per-Deity rows, and the Compact
  Card Representation section) - this session found the discrepancy and
  reported it, but has no tool that can write Google Doc body content, so
  the edit itself is still pending outside this repo.
- `ui_player_nameplate.png` is fetched/packed and available but **not**
  applied to the seat name tags in this pass - the existing gold-bordered
  "You" tag and teal/gold staged-vs-default other-seat tags carry real
  functional meaning (delegate-selection state), and a naive full-image
  background swap risked losing that color cue without more design
  iteration time than this pass had. Flagged rather than guessed at.
- The centre Suit Cycle HUD ring's *visual surface* (still the original
  glowing-badge treatment, not a carved-stone "well" look) is unchanged,
  per the user's explicit "keep rotation" decision - a lighter re-skin
  that preserves the exact same rotation/marker logic is a reasonable
  follow-up if the visual gap to the approved preview's compact look
  matters enough to revisit.

## Known issues

- Two items above (`ui_player_nameplate.png` unapplied, centre-HUD visual
  surface unchanged) are deliberate scope decisions for this pass, not
  bugs, but are real gaps versus the approved preview's pixel treatment.
- Carried over, untouched by this task: `advanceBlocker()`'s premature
  `checkSuitCompletion()` call; the facedown-card masking leak in
  `host/mask.ts`; Rules-modal content gaps (no Setup section, off-suit
  hidden-identity nature unstated).

## Next proposed step

Apply `ui_player_nameplate.png` to the seat tags without losing the
delegate-staged color cue (e.g. tint the art rather than replacing the
background outright), and/or a lighter carved-stone re-skin of the Suit
Cycle HUD ring's badge surface - both are visual polish on top of what's
already wired up, not new plumbing. Separately: get the GDD document's own
"Awakened [Deity]" text corrected (a manual edit outside this repo).
