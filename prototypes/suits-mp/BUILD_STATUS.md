## Current milestone

Redistribution log gets real scrolling, migrated to DOM/React in the
process. The task came in framed as "this is a DOM layer component,"
but the log panel's actual content was still canvas-drawn
(`ui/renderGameView.ts`'s `renderRedistributionLogOverlay`) - only its
trigger button had moved to DOM (`GameOverlay.tsx`). Flagged this
mismatch and asked; the user's call was to give it the same DOM
treatment as the Rules overlay before adding scrolling, which also
matches what BRIEF.md itself already said back in Stage 3a ("full
Redistribution-log content are still stubs; real design... comes from
Claude Design as DOM overlays in a later stage (3c)") - this task is
that stage 3c migration for this one panel, arriving a bit later and
via a different trigger (a scrolling bug) than BRIEF.md anticipated,
not a deviation from it. Version stamp counter unchanged (`8`) at time
of writing; no deploy has run for this fix yet.

## What was implemented

- **New `dom/RedistLogModal.tsx`**: a full DOM/React modal, structurally
  identical to `RulesModal.tsx`'s shell (scrim, seethe glow, noise
  overlay, clip-path frame, header/scroll-body/footer) - the scroll
  body is `flex: 1 1 auto; min-height: 0; overflow-y: auto` inside a
  fixed-bounds flex column, so the modal frame itself never grows past
  its allotted space no matter how many entries exist; only the body
  scrolls. Renders a small "mini card" badge per card shown (god symbol
  art + a rank tag, in the same hex/circle motif as the card frames)
  rather than porting `ui/cardArt.ts`'s full per-god Canvas2D frame
  compositing to DOM - that's real per-card frame art meant for a
  card's own play area, well more than a compact log entry needs to
  identify a card at a glance.
- **Newest-first ordering**: `computeRedistLogEntries()`
  (`ui/renderGameView.ts`) hands the modal entries in reverse
  chronological order. A 40-trick game can grow this log long, and the
  entry a player actually wants after a redistribution just happened is
  the one that just happened - putting it first means zero scrolling
  to reach it, and history is still one scroll away. No
  auto-scroll-on-open logic needed as a result.
- **`ui/renderGameView.ts`**: the `'redistLog'` overlay branch now
  calls `openRedistLog(computeRedistLogEntries(state), onClose)` (same
  DOM-handoff shape as the existing `'rules'` branch) instead of
  drawing anything itself. `computeRedistLogEntries` is the new
  compute-layer function that turns real `MaskedState`/
  `RedistributionLogEntry` data into plain, display-ready
  `RedistLogEntry[]` (labels already resolved via `playerLabelFor`,
  now exported) - the DOM layer never imports `MaskedState` or any
  game-state internals directly, matching every other piece of DOM
  chrome in this file (`GameOverlayHudState`, `SeatDelegateState`,
  etc.). The old `renderRedistributionLogOverlay` canvas function is
  deleted; `renderOverlay()` (still used by the unrelated previous-trick
  "Log" button) is simplified since only one `OverlayKind` reaches it
  now.
- **`domUiStore.ts`**: extended with `redistLogOpen`/`redistLogEntries`/
  `closeRedistLog()`/`openRedistLog()`, alongside the existing
  `rulesOpen`/`closeRules()` pair, using the same canvas-calls-in,
  DOM-calls-back handoff pattern. `RedistLogEntry`/`RedistLogGroup`
  types now live here (co-located with the state they back) rather
  than in `net/actions.ts`, since they're DOM display types, not
  networking/masking types.
- **Renamed `RulesModal.css` -> `modalChrome.css`**: it was never
  actually scoped to Rules - it's the one stylesheet carrying
  `@import 'tailwindcss'` for the whole DOM layer (imported once in
  `mountDom.tsx`) plus the shared `:hover`/`:active`/scrollbar
  pseudo-styles inline React can't express. Left under the old name it
  would have kept being the wrong place to look once a second modal
  needed the exact same rules; extended its scrollbar/`:hover` selectors
  to also cover `redist-log-*` elements rather than duplicating the
  file.
- **`DomRoot.tsx`**: wires `RedistLogModal` in alongside `RulesModal`,
  same `useSyncExternalStore` + double-close-callback pattern
  (`onCloseRedistLog()` then `closeRedistLog()`).

## Key technical decisions

- **Mini card badges, not full card-frame art, in the log.** The real
  card frames (`ui/cardArt.ts`) are composited at runtime via Canvas2D
  inside a Phaser scene - there's no static image URL a DOM `<img>`
  could point at, and porting that whole per-god gradient/plate/motif
  pipeline to CSS/SVG would be a large task in its own right, well
  beyond what this scrolling fix needs. A card only needs to be
  identifiable in this compact list, not rendered pixel-for-pixel, so
  the badge reuses the existing god-symbol-art + hex/circle-motif
  pattern already established by `GameOverlay.tsx`'s Bound/Kin god
  chips, plus a small rank tag.
- **Newest-first over auto-scroll-to-latest.** Both would satisfy "the
  newest entry is reachable without excessive scrolling," but
  newest-first needs no scroll-position bookkeeping at all (no ref, no
  effect, no re-measuring on new entries) and is the more conventional
  reading order for a log a player checks occasionally rather than
  watches continuously - closer to a chat/activity feed than a
  document. This does mean the visual order no longer matches
  `state.redistributionLog`'s own chronological storage order, which is
  why the reversal happens once in `computeRedistLogEntries` rather
  than being left for the DOM component to reason about.
- **Verified without real gameplay.** Getting an actual 22-trick game
  to a real device in this sandbox isn't possible (no real two-peer
  networking here - same limitation noted in every prior suits-mp
  session). Since `RedistLogModal` takes only plain, already-resolved
  data as props, it could be verified directly and thoroughly: a
  scratch harness rendered it with 22 synthetic entries (well past what
  fits on screen), confirmed via Playwright that `scrollHeight` (3582px)
  far exceeds `clientHeight` (636px), that scrolling the body all the
  way down actually reaches trick 1 while the header/footer stay fixed
  in place (screenshotted both states), and that entries render
  newest-first. Deleted before finishing, per this repo's usual
  scratch-harness practice.

## Open questions

None outstanding - the DOM-vs-canvas mismatch that came up mid-task was
resolved by asking, and the answer given lines up with what BRIEF.md
already said back in Stage 3a (DOM overlays "in a later stage (3c)"),
so no BRIEF.md update is needed; this task simply carried out something
BRIEF.md had already flagged as pending work.

## Known issues

- Carried over, still true, untouched by this task: facedown-card
  masking leak (`host/mask.ts`); no card-back art yet; the bottom HUD
  name tag can wrap for a long real name.
- The previous-trick "Log" overlay (a single trick, always short) is
  intentionally untouched and still canvas-drawn - it was never the
  one with a scrolling problem, and migrating it wasn't part of this
  task's scope.
- Real two-peer networking still can't be exercised in this sandbox
  (pinned Nostr relays/TURN worker unreachable here, as in every prior
  session) - the redistribution log's real data-computation path
  (`computeRedistLogEntries` reading actual `MaskedState`) is exercised
  every time a real game reaches it, same as before this task; only the
  presentation layer changed, and that's what was verified directly
  (see "Key technical decisions").

## Next proposed step

None outstanding for this fix.
