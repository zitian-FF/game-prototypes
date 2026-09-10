## Current milestone

Shipped the 2026-09-10 Player UI Asset Wave: real art now backs the
local player's identity nameplate (merged with the former separate
Team HUD panel), all 4 remote-seat delegate-selection states, face-down
plays, the Menu/Sort/Log utility buttons, the bottom-center Action
button, and the landing screen's title logo. This replaces the last
several procedurally-drawn or generic-placeholder UI surfaces in
suits-mp with real packaged assets.

## Package verification

- Fetched `suits-mp_assets.zip` fresh from R2 (`.cache/suits-mp.etag`
  cleared first to force a real re-download, not a cache hit).
- SHA-256 of the fetched zip: `358586243b39451f5dda7ac2698bf09b3bb3ea20
  4d7ae1bc1e534d05fdd2c79b` - matches the handoff's stated hash exactly.
- All 36 `loose/` PNGs extracted; `packed/` is empty, as expected.
- **Blocker found and worked around locally**: `card_backdrop_
  nyarlathotep.png` inside this exact, hash-verified zip is truncated
  (515,584 bytes, valid PNG signature, but no `IEND` chunk - confirmed
  independently via both Pillow, which raises "image file is
  truncated", and `sharp`/libvips, which raises "vipspng: libpng read
  error"). This blocks `scripts/pack-assets.js` for the *entire*
  prototype (one failed file aborts the whole run), which in turn
  blocks a working local build/Playwright verification pass. Re-
  downloading independently (outside the fetch-assets cache path)
  reproduced the exact same corrupted bytes, so this is not a transient
  network/download issue on this end - the file is genuinely corrupted
  inside the object currently hosted at R2, despite the overall zip's
  hash matching the approved handoff exactly.
  - This file is **not** one of this wave's own new/replaced assets -
    it's a pre-existing per-Deity card backdrop, included only because
    the package is "complete, not a delta." No code in this task reads
    or depends on it beyond it needing to exist for the shared asset
    pipeline to process the *whole* package.
  - Per explicit user direction, worked around this locally only: my
    own local `assets-src/loose/card_backdrop_nyarlathotep.png` was
    temporarily swapped for a duplicate of `card_backdrop_shub_
    niggurath.png` purely to unblock `pack-assets`/`build`/Playwright
    for this session. `assets-src/` and `public/` are both gitignored
    (confirmed) - this substitution never touched anything committed
    and will vanish with this container. **A real, corrected `card_
    backdrop_nyarlathotep.png` still needs to be re-uploaded to R2
    under the same object name before this package can be considered
    genuinely complete** - the next fetch (this session's or any
    future one) will hit the same corrupted bytes and the same build
    failure until that happens. This is the one outstanding blocker
    from this task, unrelated to anything the code changes below do.

## What changed

**Files changed**: `dom/godArtUrl.ts` (new URL helpers), `dom/overlay/
GameOverlay.tsx` (local nameplate merge, remote nameplate 4-state art,
Menu/Sort/Log + Action button real backgrounds, real `pressed` state
tracking), `dom/overlay/GameOverlay.css` (two now-dead hover rules
removed), `dom/overlay/gameOverlayStore.ts` (doc comment only, no shape
change), `dom/lobby/LobbyFlow.tsx` (landing-screen logo), `ui/
cardComponent.ts` (`card_back.png` wiring), `ui/renderGameView.ts`
(local seat label / god-chip label content only). No changes to
`rules/engine.ts`, `host/gameHost.ts`, `host/mask.ts`, or the card
compositor's own layer logic (`cardArt.ts`) beyond the `card_back.png`
wiring explicitly called for.

### Local player identity (`ui_player_nameplate.png`)

- **Structural change beyond a reskin**: the handoff's own asset is a
  *single* two-compartment image (2170×725, one vertical divider baked
  in near center) - the codebase previously had this as TWO separate
  DOM blocks (a plain single-compartment name tag using the old
  nameplate art, plus an entirely separate "Team HUD" panel below it
  with its own procedural purple gradient background showing "Thy
  covenant / Team X / god chips"). This wave **merges both into one
  `data-ui="local-nameplate"` control** stretched across the new
  image - this is what the new asset's own shape requires, not a
  discretionary redesign. The old separate Team HUD block (`data-
  ui="team-hud"`) is fully removed, along with its now-dead
  `LOCAL_TAG_HEIGHT`/`LOCAL_INVOKER_TAG_HEIGHT`/`teamHudTop` layout
  constants.
- Left compartment: `seatLabels['bottom']`, computed via a new
  `rawPlayerNameFor()` helper in `renderGameView.ts` (identical to the
  existing `playerLabelFor()` but without its `(You)` suffix) - scoped
  to just the local seat's own label; every other consumer of
  `playerLabelFor` (the delegate-target action-button label, the
  Redistribution Log, the Game Over identity reveal) is untouched and
  still shows "(You)" where it already did, since the handoff named
  only the nameplate specifically.
- Right compartment: `teamName` (`Team Cosmos`/`Team Chaos`, rendered
  with `text-transform: uppercase` to read "TEAM COSMOS"/"TEAM CHAOS")
  plus both `yourGodChip`/`teammateGodChip` symbol icons
  (`symbolArtUrl`, unchanged source), each clipped to its Team's real
  motif (hex for Chaos/Cthulhu+Nyarlathotep, circle for Cosmos/Shub-
  Niggurath+Yog-Sothoth) via the same existing `GOD_MOTIF`/
  `HEX_CLIP_PATH` mechanism already used elsewhere in this file (Suit
  Cycle HUD, Required Suit banner) - not a new clipping mechanism, and
  the packaged `deity_symbol_*.png` files themselves are never
  redrawn/recolored/cropped.
- **`YOU`/`Kin` label decision (real information-preservation call, not
  just a reskin)**: `yourGodChip.label` changed from `'Bound'` to
  `'YOU'` in `computeGameOverlayHudState` - this is exactly the
  handoff's "small runtime YOU marker on the local player's own Deity
  symbol only" (rendered under that one icon, physically separate from
  the player-name compartment, so it's never "beside the name").
  `teammateGodChip.label` (`'Kin'`) is **deliberately left unchanged**.
  The handoff is silent on the teammate symbol; the GDD's own
  Information Visibility rule requires "[the local HUD] must not
  visually connect the local player to another seat or imply which
  player holds the other allied Deity" while still allowed to show
  "their own Deity, Team and the two Deities belonging to that Team" -
  dropping the teammate's own label would flatten it into an unlabeled
  second icon and lose the "this is specifically my team's *other*
  Deity" distinction the existing design already correctly carried.
  Kept the identical visual treatment (small label under the icon) for
  both, for consistency.
- Local nameplate box widened from 208px to 260px (height ~56px) to fit
  the right compartment's extra content without touching
  `BOTTOM_TAG_TOP`/seat-tag row geometry elsewhere.

### Remote nameplates + delegate selection (4-state art)

- `ui_remote_player_nameplate_{neutral,eligible,pressed,selected}.png`
  wired to the seat-tag `<button>`'s `background`, replacing the
  procedural teal/gold staged/not-staged gradient entirely. State
  priority (highest first): `pressed` (real, transient pointer/touch-
  down feedback - new local `pressedSeat` React state in
  `GameOverlay.tsx`, tracked via `onPointerDown`/`onPointerUp`/
  `onPointerLeave`/`onPointerCancel`, cleared defensively if the
  pressed seat stops being tappable mid-press) > `selected`
  (`delegate.staged`) > `eligible` (`delegate.tappable`) > `neutral`
  (everything else). The underlying `computeSeatDelegateState`
  (`tappable`/`staged`/`onPick`) in `renderGameView.ts` is **completely
  unchanged** - "pressed" is a pure presentation/pointer concept the
  game-logic layer has no reason to know about, so it's derived
  entirely in `GameOverlay.tsx`.
- **`selected` state mapping decision (explicitly flagged by the
  handoff as needing one)**: this codebase has no persistent post-
  commit "confirmed delegate" interval to show `selected` during - the
  entire delegate-picker UI (the whole `isDelegating`/`delegateChoices
  !== null` gate) disappears the instant the real `selectDelegate`
  network action resolves and `turnPhase` moves to `redistribute`.
  Per the handoff's own "retain the state for the confirmed transition
  or short confirmation state instead of deleting it from the UI
  contract" instruction, `selected` is mapped to the local, pre-commit
  staged pick (`delegate.staged`, i.e. `view.delegateChoice === pid`) -
  the moment between tapping a seat and pressing the actual confirm
  action button. Verified this is the only sensible interpretation
  live: real gameplay never showed a state where a delegate was
  "confirmed" but the picker UI was still visible.
- No team/Deity/teammate/suit information is exposed anywhere on any of
  the 4 states - confirmed live (see verification below) by inspecting
  the actual masked state alongside the rendered plates through an
  entire real trick + delegate-selection flow.

### Card back (`card_back.png`)

- Wired into `cardComponent.ts`'s `drawCard()`, replacing the old
  placeholder (a plain rectangle + 3 diagonal stripes,
  `drawFacedownPattern`, now deleted entirely as dead code) with the
  real, complete `card_back.png` drawn full-canvas - the same
  full-canvas technique `buildCard()` already uses for a face-up card's
  own frame layer. `CardStyle.alpha` (e.g. `stackNeededStyle()`'s 0.55
  dim for a not-yet-filled redistribution slot) still applies to the
  whole card exactly as it did on the old placeholder.
- **Applies uniformly to every facedown context this one shared
  component already served**, not just the off-suit-play spot the
  handoff named explicitly: the redistribution-progress mini-stack
  (`renderRedistributionStack`, showing how many cards a player is
  owed back) already reused the identical `{kind:'facedown'}` branch
  before this task, so it now also shows real `card_back.png` art
  instead of the old placeholder. This is a straightforward
  consequence of `cardComponent.ts`'s own "one shared component, no
  per-context logic" design (see its header comment) - special-casing
  just one of its two existing facedown call sites would have been the
  actual divergence from that architecture, not this.
- Confirmed live: an off-suit facedown play renders the real card-back
  art with no Deity frame/symbol/rank/nameplate/face composited onto
  it, and stays exactly that way through the entire trick-result dwell
  and delegate-selection flow that follows (see verification below) -
  never revealed to this client at any point.

### Bottom controls

- `ui_square_control.png` now backs Menu/Sort/Log (all three identical
  square buttons), replacing their procedural inset-stone gradient -
  resolves the screen-reference doc's own previously-open "no dedicated
  square-button asset exists" note. Icons (☰/⌘/☷) and labels stay
  runtime content, unchanged.
- **Label correction**: the bottom-left hand-sort button's visible text
  changed from `Set` to `Sort` - `Sort` was already the canonical
  label per `sortLabel`/`onToggleSort`'s own naming and the screen-
  reference doc's explicit prior correction; only the literal DOM text
  itself had never been fixed to match.
- The bottom-center Action button now uses the real 4-state `ui_
  action_slab_{waiting,disabled,ready,pressed}.png` art (distinct from
  the generic, still-unused `ui_action_slab.png`), replacing its old
  two-layer procedural gold/gray gradient - resolves the screen-
  reference doc's own "remains unresolved" open question on whether an
  action-slab asset should back this button. Label/hint stay runtime
  text (`actionLabel`/`actionHint`), unchanged.
  - **State mapping** (the handoff named the driving props -
    `turnPhase`/`actionLabel`/`actionHint`/`actionEnabled` - but left
    the exact 4-way split to be worked out against the real state
    machine): `pressed` while a real pointer/touch is currently held
    down (new local `actionPressed` React state, same pattern as the
    seat tags above); `ready` when `actionEnabled` and not currently
    pressed; when `!actionEnabled`, `waiting` specifically when
    `actionLabel` starts with `"Waiting"` (`computeActionButtonState`'s
    own `"Waiting for X..."`/`"Waiting..."` labels - the one case this
    button can actually distinguish "not your turn at all" from every
    other not-yet-actionable case using only its existing props, since
    no new boolean was added to the props contract), `disabled` for
    every other case (e.g. `"Select a card to play"` with nothing
    selected yet, `"Select a delegate above"`, `"Assign all cards"`).

### Title logo (`logo_suits_of_madness.png`)

- Wired into `LobbyFlow.tsx`'s shared masthead, shown **only when
  `screen === 'landing'`** - the masthead itself is shared verbatim
  across every screen state (Lobby/Join/Waiting/all 5 error kinds, per
  the existing Title/Landing screen reference doc's own architecture
  note), and the handoff named the landing screen specifically. Every
  other screen keeps the plain "Suit of Madness" text masthead,
  unchanged - confirmed live (see verification below).
- `width: 130, height: 'auto'` - the browser's own native aspect-ratio
  preservation (a fixed width with `height: auto` on an `<img>`) rather
  than any explicit CSS aspect-ratio math, so the image can never be
  stretched/cropped regardless of future edits nearby. 130px was
  chosen (down from an initial 190px attempt, confirmed too tall) to
  fit within the masthead's existing vertical budget above the landing
  screen's own fixed `top: 268` content block without overlapping it -
  confirmed via a real screenshot showing the previous 190px attempt's
  overlap, then the corrected 130px result cleanly clear of it.

## How this was verified

Real gameplay via Playwright (temporary `ForcedDeal`/`debugPlayCard`-
based debug hooks in `HostGameScene.ts`/`main.ts`, added and fully
reverted before this PR - `git diff --stat` against `main` confirms
only the 7 files listed above changed).

- `npm run typecheck` / `npm run build` (repo root) - clean, after
  working around the corrupted-asset blocker above.
- `npm run pack:assets suits-mp` - all 36 files processed, output
  confirms "wrote 36 file(s)".
- **Real, unforced boot** into Single Player under `?debug=1`:
  confirmed all three remote plates render Neutral during normal play
  (no delegation active), the local nameplate shows the merged two-
  compartment layout with no `(You)` suffix and the correct team text/
  symbols/`YOU` marker, `Sort` reads correctly, and the console is
  clean (only the pre-existing sandboxed `net::ERR_CONNECTION_RESET`/
  404 noise present on every boot in this environment). Confirmed the
  temporary debug hooks are fully absent from this real boot
  (`window.__gs`/`__forceDeal`/`__debugPlayCard` all `undefined`).
- **Single forced-but-real scenario exercising every remaining
  required check at once**: a forced deal where the local player wins
  a trick outright via a legal Double (only Double present, so it wins
  automatically) while a different seat in the *same* trick is forced
  into a genuine off-suit facedown play (their only legal move, no
  bypass) - every position's play was driven through the real
  `playCard` action/validation (`debugPlayCard`, never bypassing
  legality, only bypassing which *legal* move a bot's own random
  choice would have picked), so no different from four real players'
  real turns as far as the engine or the render pipeline can tell.
  - During the trick-result dwell: confirmed the facedown seat's play
    area shows real `card_back.png` art, not the old placeholder, with
    no Deity frame/symbol/rank visible on it.
  - Once `turnPhase` became `selectDelegate` (after the dwell): the
    local player's own client correctly received real
    `delegateChoices` (all 3 other seats) - confirmed all 3 remote
    plates (top/left/right) render the `eligible` state, unclipped, no
    team/Deity/suit information visible on any of them.
  - A real, coordinate-based `mouse.down()` (held, not released) on the
    'left' seat's tag: confirmed `data-visual-state="pressed"` and a
    genuinely different rendered image (pixel-diffed against the
    `eligible` screenshot - non-empty diff bounding box).
  - Releasing (`mouse.up()`): confirmed `data-visual-state="selected"`,
    again pixel-distinct from both `eligible` and `pressed`, and the
    Action button correctly updated to `"Delegate to Player 2 / Commit
    the chosen card"`, enabled.
  - Clicking the real, now-enabled Action button: confirmed the real
    `selectDelegate` network action fired (`turnPhase` →
    `redistribute`, `currentTurn` → exactly the tapped seat's real
    slot) and the whole delegate-picker UI disappeared, matching the
    `selected`-state mapping decision above.
  - Confirmed the facedown card's real identity was never exposed to
    the local client at any point across this entire flow (`previous
    Trick`'s masked entry for that play stayed `cards: []` throughout -
    checked at every state snapshot, from the moment the trick resolved
    through the final `redistribute`-phase render, where the same play
    now also renders as a real-`card_back`-art mini-stack slot in the
    delegate's own redistribution-progress display).
  - All 4 seat positions' new nameplates (bottom/top/left/right)
    checked unclipped on the real 390px-wide mobile viewport throughout
    this whole flow - no play-area geometry changed (card positions/
    sizes are untouched by this task).

**This change benefits from the user's own live verification on a
real device**, per standing house practice for any presentation-layer
wave - the automated checks above confirm every state-to-asset mapping
and masking guarantee is correct, but whether the new art reads well
at real size/contrast on a phone (especially the eligible/pressed
distinction, which is visually subtle at this control's small 34px-tall
size) is a feel judgment best made live.

## Deliberately unused assets

- `ui_action_slab.png` (the original generic, wide-bar slab) remains
  unused, exactly as before this task - it was never a candidate for
  Menu/Sort/Log (wrong aspect ratio) and the bottom-center Action
  button now uses the 4 real per-state slab variants instead, which
  resolves the one open question this asset's use was tied to.

## Open questions

None from the handoff itself - its own explicit reconciliation notes
(the `selected`-state mapping, the `YOU`/`Kin` label decision, dropping
`(You)`) were specific enough to resolve directly, and are each
documented above with the reasoning. The one real open item is
external to this task's code: **the corrupted `card_backdrop_
nyarlathotep.png` in the currently-hosted R2 zip needs a real re-
upload** before a fresh fetch (by CI, or any future session) will
succeed without a local workaround.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps (no
Setup section, off-suit hidden-identity nature unstated in the copy);
the `'partner'` hand-fan state still has no working visual
differentiation from `'legal'`; the itch.io iframe canvas-scale fix,
the asset pipeline's downscale/recompress output, the hand-fan edge-
bound fix, the Center HUD easing curve, the trick-result dwell hold,
the card-play arc animation, the Awakened reveal, the end-of-trick
collect animation, the Double-overlap fix, and now this whole asset
wave all still want a real-device/live-deploy glance - the
eligible/pressed nameplate distinction specifically, per the note
above. suits-mp still has no permanent `?debug=1`-gated `ForcedDeal`
hook (unlike the sibling `suits` prototype's `rules/debugScenarios.
ts`) - this is now the seventh task in this feature area to build and
tear down its own one-off version.

**New from this task**: the corrupted `card_backdrop_nyarlathotep.png`
in the R2-hosted `suits-mp_assets.zip` (see "Package verification"
above) - needs a real fix at the source before the next fetch (any
session, or CI) succeeds cleanly.

## Next proposed step

Re-upload a valid `card_backdrop_nyarlathotep.png` to R2 under the same
object name - this is the one concrete, actionable follow-up from this
task specifically. Beyond that, a real-device/live-deploy pass covering
everything listed under "Known issues" remains the standing next open
loop, with this wave's own eligible/pressed nameplate legibility as the
highest-value new addition to check.
