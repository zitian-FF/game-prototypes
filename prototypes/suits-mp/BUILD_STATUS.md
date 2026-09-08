## Current milestone

Replaced the card presentation with the approved runtime-composited
three-state card system (Numbered / Dormant / Powered) for all four
Deities. This is a visual/asset-composition change only - every existing
game rule, state transition, card interaction, hand/played-card behavior,
selection/highlighting logic, suit logic, and Powered/Dormant
determination is unchanged; only how a face-up card is drawn changed.

## What was implemented

- **`rules/godArt.ts`**: added `backdropArtFile(god)` (`card_backdrop_<slug>`)
  and `nameplateArtFile(god)` (`deity_nameplate_<slug>`), following the
  exact pattern of the existing `symbolArtFile`/`faceArtFile`/
  `frameArtFile`. The existing `GOD_SLUG` map needed no changes - it
  already produces the slugs the new filenames use (e.g. `shub_niggurath`,
  `yog_sothoth`). Removed `rankBadgeArtFile` and its now-unused `Team`
  import - see the "rank badge" answer below.
- **`ui/cardArt.ts`** (the card compositor - the one place a face-up card
  is assembled, reused unchanged by `cardComponent.ts`'s `drawCard()` for
  hand-fan cards, every play-area recess, and the previous-trick log, all
  via the same `CardDimensions`-parameterized call): rewrote `buildCard()`
  to the approved back-to-front layer model, driven by one
  `cardVisualState()` helper (`'numbered' | 'dormant' | 'powered'`) that is
  a direct, unchanged re-expression of the prior state-determination
  branching:
  - **Numbered** (rank 2-10): backdrop -> Deity Symbol (760x760 box,
    top y=290) -> frame -> runtime rank numeral. No nameplate.
  - **Dormant** (DeityCard, not powered): backdrop -> Deity Symbol
    (1130x1130 box, top y=170, intentionally wider than the 1024px canvas)
    -> frame -> nameplate -> runtime "1".
  - **Powered** (DeityCard, powered): backdrop -> Deity Face/anime art
    (850x1190 box, top y=180) -> frame -> Deity Symbol again, at the small
    top-badge scale (400x400 box, top y=-40) rendered *after* the frame so
    it is never masked -> nameplate -> runtime "★".
  - All symbol/face/nameplate layers use one shared `placeContain()`
    helper: uniform aspect-preserving ("contain") fit within a named
    reference-canvas box, centered on both axes, scaled by
    `k = dims.width / 1024` - the same helper and the same reference-canvas
    boxes are used regardless of caller (hand fan vs played-card recess vs
    mini log card), so there is exactly one composition function, not four
    per-Deity or per-state copies.
  - The frame renders on top of the backdrop and the main symbol/face
    layer (masking Dormant's oversized symbol box and any other overflow
    against the frame's own opaque border/rank-quadrant art) but *before*
    Powered's small top-badge symbol, per the approved invariant that this
    one layer must never be masked beneath the frame.
  - Runtime rank numeral/star text is live `Phaser.Text` (never baked into
    art), centered on reference-canvas point (220, 1308) - the frame's
    integrated lower-left rank quadrant - sized ~158px (numeral) / ~176px
    (star) on the reference canvas, scaled by the same `k`.
  - Backdrop and frame are both drawn at full `dims.width x dims.height`
    (matching the "do not stretch independently from frame" instruction);
    the backdrop's own alpha already keeps it inside the card silhouette,
    so no opaque rectangular container was added behind it.
- Ran the real asset pipeline (`npm run fetch:assets suits-mp` then
  `npm run pack:assets suits-mp`) to pull the replaced/new R2 art into
  `assets-src/loose/` and regenerate `public/prototypes/suits-mp/assets/
  manifest.json` (hash-keyed, not filename-keyed - unchanged mechanism).
  No loader code changes were needed: `preloadCardArt()`/
  `queueLooseImages()` already discover every `loose/`-prefixed manifest
  entry generically, keyed by filename minus extension, so the two new
  categories (`card_backdrop_*`, `deity_nameplate_*`) load automatically.
- `cardComponent.ts` was **not** touched - its `drawCard()` already called
  `buildCard(scene, god, rank, dims, deityCardState)` and used its
  `BuiltCard` return shape exactly as the rewritten function still does,
  so the hand fan/played-card/log call sites needed no changes at all.

## Key technical decisions

- **`rankBadgeArtFile` / `BADGE_CENTER` / `BADGE_DIAMETER` removed as dead
  code**, not just flagged. Visual inspection of the new
  `card_frame_<deity>.png` masters (see "How this was verified") confirms
  the lower-left rank quadrant plate is now baked directly into the frame
  art itself (a teal-glass corner treatment matching the rest of the new
  frame), replacing the old separate circular badge-image-plus-text
  approach entirely. `rank_badge_chaos_portal.png`/
  `rank_badge_cosmos_galaxy.png` (still present in the R2 zip, unchanged)
  are visually a completely different, incompatible style (gold/purple
  fantasy portal) from the new frame's own teal rank-quadrant art, and the
  new placement spec (a single runtime text glyph centered on a fixed
  point, no image at all) has no place for them. They are now dead assets.
  `GOD_TEAM` (used elsewhere for real team-name display, e.g.
  `renderGameView.ts`) was kept - only its one caller inside the old badge
  logic was removed.
- **One `placeContain()` helper + one `cardVisualState()` three-way switch**
  rather than four per-Deity or three per-state implementations, per the
  task's explicit requirement - Deity only ever selects which texture key
  to pass in, never a different code path.
- **Frame drawn after the main art layer, before Powered's top badge** -
  a genuine z-order change from the prior implementation (which always
  drew the frame first). Alpha-inspecting the new frame masters (see
  below) confirmed they now have a real transparent window over the main
  art area with an opaque border, which is what makes this masking work
  correctly instead of hiding the main art layer entirely.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Visual/alpha inspection of the new master art** (Python/PIL, before
  writing any placement code): confirmed `card_frame_cthulhu.png` has a
  large transparent window (alpha 0) over the main art area with an opaque
  (alpha 255) border, confirmed its lower-left rank-quadrant area is
  already opaque frame art (see the rank-badge decision above), confirmed
  `card_backdrop_*` has real alpha shaping it to the card silhouette,
  confirmed Chaos gods (Cthulhu, Nyarlathotep) use a hexagonal symbol
  backplate and Cosmos gods (Shub-Niggurath, Yog-Sothoth) a circular one,
  confirmed Yog-Sothoth's symbol is the flat atom/orbit mark (not her
  planets, which appear only in her anime face art), and confirmed
  Cthulhu's face art has no duplicate octopus emblem on her head.
- **Live-game Playwright verification** (temporary debug hooks -
  `window.__debugGame` in `main.ts`, `window.__buildCard` in `cardArt.ts` -
  added, used, then fully reverted before finishing; `git diff` against
  `origin/main` confirms only `rules/godArt.ts` and `ui/cardArt.ts` differ):
  - Booted real Single Player (bots), waited for the real `HostGame` scene
    and real loaded card textures, then called the live game's own
    `buildCard()` - same function, same scene, same fetched textures the
    hand fan/play areas use - for all 4 Deities x all 3 states (12 cards),
    positioned on-screen and screenshotted (DOM HUD overlay hidden for the
    screenshot only, since it's painted over the same canvas region by
    CSS - a screenshot aid, not a game change).
  - Confirmed by inspection: all 4 Deities render correctly in all 3
    states; Numbered cards never show a nameplate; Dormant cards show the
    extra-large symbol nearly filling the window width without touching
    the frame, the nameplate, and "1"; Powered cards show the anime art,
    the small symbol badge genuinely floating above the frame's top edge
    without covering the character's face, the nameplate, and "★"; Chaos
    symbols are hexagonal, Cosmos symbols are circular; Yog-Sothoth's
    Powered art shows her planets, her symbol (Numbered/Dormant/Powered
    badge) is the flat atom mark throughout.
  - **Real gameplay smoke test** (no debug hooks - actual mouse clicks on
    the real interactive hand-fan cards and the real "Play Card" commit
    button): confirmed a real Dormant Deity Card in the local player's
    hand (Cthulhu, symbol + "1" + nameplate, all correctly rendered
    though visually cropped by normal fan overlap, same as any fanned
    card) and a real Numbered card (Yog-Sothoth "2") landing correctly in
    a played-card recess after being played by a bot - confirming both
    call sites still work unmodified through the real interaction/network
    (single-player, no real peers) path.
  - `page.on('pageerror')` empty across every run; console errors limited
    to the same pre-existing baseline noise from prior tasks (a sandboxed
    Google Fonts request, one intermittent unrelated 404).

## Open questions

None new from `BRIEF.md`'s own scope. The one open question posed by this
task's brief is answered above under "Key technical decisions": the
`rank_badge_*.png` files are dead, superseded by the new frame's baked-in
rank quadrant, and their code path (`rankBadgeArtFile`, `BADGE_CENTER`,
`BADGE_DIAMETER`) has been removed.

## Known issues

- Carried over, untouched by this task: genuine gameplay verification of
  off-suit masking via real bot/human play is still pending; Rules-modal
  content gaps (no Setup section, off-suit hidden-identity nature unstated
  in the copy); the other three seat tags still don't use
  `ui_player_nameplate.png` (deliberate, from an earlier visual pass); the
  itch.io iframe canvas-scale fix (prior task) still needs a live-deploy
  re-check.
- `rank_badge_chaos_portal.png`/`rank_badge_cosmos_galaxy.png` remain in
  the R2 zip's `loose/` folder (unchanged, per the handoff) and so still
  get fetched/packed into the manifest, but nothing in code references
  them any more - harmless (the fetch/pack step is generic over the zip
  contents either way) but worth knowing they're inert if anyone goes
  looking for where they're used.

## Next proposed step

Return this task's implementation facts/evidence (file list, manifest/
asset keys, verification results, screenshots, the rank-badge answer) to
GPT/Codex per the handoff, for it to reconcile
`suits-mp-screen-reference.md` against the new three-state system - that
doc was not edited by this task.
