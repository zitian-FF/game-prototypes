## Current milestone

Replaced every 2-letter suit-code text badge (YS/CT/SN/NY) with the real
god symbol art. Three locations found and swapped (two named in the task,
one found by auditing the codebase as instructed). Version stamp counter
is at 8 (`version.json`) - unchanged, no deploy has run yet.

## What was implemented

- **New shared god-art data** (not Phaser- or DOM-specific, so both
  layers use the same source of truth instead of duplicating it):
  - `rules/godArt.ts`: `symbolArtFile(god)`/`faceArtFile(god)` (the
    R2 PNG filename convention) and `GOD_MOTIF` (hex for Team Chaos,
    circle for Team Cosmos). `ui/cardArt.ts`'s `GOD_TOKENS` used to carry
    its own local `motif`/`artIndex`/`artSlug` fields per god - refactored
    to pull all three from here instead, so the card-frame compositor and
    this task's new DOM badges can't drift apart on which god gets which
    art/motif.
  - `dom/godArtUrl.ts`: `symbolArtUrl(god)` resolves a god's symbol PNG to
    an `<img>`-loadable URL (`assets/loose/<file>.png`, the same relative
    path convention `ui/cardArt.ts` already uses for Phaser texture
    loads - this DOM layer is mounted into the same page as the canvas,
    so the browser resolves both identically with no separate fetch/
    manifest plumbing needed). Also exports `HEX_CLIP_PATH`, the one hex
    shape every hex badge below uses.
- **Suit Cycle HUD** (`dom/overlay/GameOverlay.tsx`, the four ring badges
  around "Lead"): each badge now shows the real symbol image inside a
  badge shaped to match its god's actual motif (hex clip-path for
  Cthulhu/Nyarlathotep, `border-radius: 50%` for Shub-Niggurath/
  Yog-Sothoth) instead of a generic rotated-square "diamond" for all
  four - see "Key technical decisions" for why the diamond went away
  entirely rather than just getting new content.
  - **Counter-rotation**: the whole ring rotates via the existing
    `rotate(${suitDeg}deg)` wheel transform. Each badge's symbol now sits
    in its own inner wrapper with `rotate(${-suitDeg}deg)`, canceling the
    parent's rotation so the image stays upright at every wheel position -
    verified visually before and after triggering a trick-start rotation.
    Deliberately reuses the wheel's own `tune.suitCycleRotationMs`/
    `suitCycleRotationEasing` for this inner transition rather than a
    separate tune value, so the counter-rotation animates in lockstep
    with the wheel (a different duration would let the symbol visibly
    lag/lead mid-spin instead of staying locked upright throughout).
- **Team/god HUD chips** (`dom/overlay/GameOverlay.tsx`'s "Bound"/"Kin"
  badges): the top line's 2-letter code text swapped for the same real
  symbol image (18px, `object-fit: contain`); the "Bound"/"Kin" label
  line and the chip's own box (background/border/cut-corner shape)
  untouched. `GodChipState` gained a `god: God | null` field (null only
  in the hidden/placeholder state) so `GameOverlay.tsx` can resolve the
  right art - `renderGameView.ts`'s `computeGameOverlayHudState()` now
  passes `state.yourGod`/`teammateGod` through alongside the existing
  `code`/`label`.
- **Third location found by the requested audit**: the Rules modal's
  "Turning of Suits" cycle diagram (`dom/RulesModal.tsx`, ported from the
  original Rules handoff, unrelated to the Overlay work) had the exact
  same rotated-diamond-plus-code-text pattern for its own per-god list.
  Swapped the same way as the Suit Cycle HUD (hex/circle badge + real
  symbol) - no counter-rotation needed there since this diagram is
  static, not a spinning wheel. `dom/rulesContent.ts`'s `CycleGod` gained
  a `god: God` field; its now-unused `cycleColor()` helper (only ever
  used for the code text's own color) was deleted rather than left dead.
- Audited the rest of the codebase for any other 2-letter suit-code
  render (`grep` for `suit.code`/`god.code`/literal `'YS'`/`'CT'`/`'NY'`/
  `'SN'` across every `.ts`/`.tsx`) - no other location found. The
  remaining `code`-string usages are all non-visual (`key`/`data-*`
  attributes, `alt` text) or the Suit Cycle HUD's separate "Lead: Yog-S."
  center label, which is a partial god *name* (`SUITS[i].short`), not a
  2-letter code, and out of this task's scope.

## Key technical decisions

- **Dropped the diamond backing entirely for the Suit Cycle HUD and Rules
  cycle diagram, rather than keeping it behind the new symbol**: the raw
  symbol PNGs have no built-in frame/border of their own (confirmed by
  looking at them at target render size - they're just the god's glyph on
  transparent background, same as the card-frame compositor's own source
  art), so *some* backing is needed for legibility against the busy
  background - but a uniform rotated-square diamond for all four gods is
  strictly less correct than shaping that backing to each god's real
  motif (hex/circle), which the card frames already establish as this
  game's actual per-team visual language. Since switching motifs also
  meant the backing no longer needed the "rotate 45deg then counter-
  rotate -45deg" trick that made a square read as a diamond, that whole
  mechanism was removed rather than layered under a second counter-
  rotation for the wheel - one rotation cancellation (wheel only) instead
  of two nested ones is simpler and less error-prone. This wasn't a fully
  obvious call (the task said to flag it if not), so it's called out here
  explicitly even though the reasoning above is why it didn't block on a
  question.
- **Team HUD god-chip box shape left untouched**: unlike the ring/cycle-
  diagram diamonds, this box isn't a suit-shaped badge on its own - it's
  a two-line label chip (symbol + "Bound"/"Kin") with a generic cut-
  corner rectangle shared by both chips regardless of god, so there's no
  motif redundancy to resolve there; only its top line's content changed.
- **No new tune.json values**: the counter-rotation intentionally reuses
  the wheel's own existing timing/easing (see above - a separate value
  would risk desync, not add real tunability), and badge/symbol sizes
  followed the existing precedent for this HUD's other fixed dimensions
  (the turn wheel's 190px, the suit-cycle-hud's 124px, the god-chip's
  52x36px were never tune.json values either) rather than introducing an
  inconsistent exception for just the new symbols.

## Open questions

- None from this session.

## Known issues

- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`); not live-verified against real human
  peers; Google Fonts fail to load in this dev sandbox's network
  environment (cosmetic fallback only); the Lobby session's Host/Join
  real-vs-placeholder navigation question; no card-back art exists yet;
  Redistribution-log content still stubbed (no design handoff yet).

## Next proposed step

No further suit-code text remains anywhere in the app. Otherwise, the
same carried-over items as before: Redistribution-log content, the Lobby
Host/Join navigation decision, a real human-peer live pass, and card-back
art if the user wants full art parity there too.
