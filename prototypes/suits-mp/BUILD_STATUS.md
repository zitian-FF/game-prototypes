## Current milestone

Fixed a canvas mis-scale bug observed on the itch.io deploy: Phaser's
`Scale.FIT` mode measures its parent (`#app`) once at construction to
compute the canvas's CSS scale/position, but itch.io resizes the iframe
the game runs in asynchronously - if that measurement happens before the
iframe settles to its real size, everything canvas-drawn (card frames,
tabletop background, hand fan - all of it) renders invisible or badly
mis-scaled, while the DOM overlay chrome (name tags, centre inlay,
buttons) is laid out independently via its own CSS and looks fine. Only
observed on itch.io; the GitHub Pages hub deploy hasn't shown this
symptom, consistent with it being iframe-specific.

## What was implemented

- **`main.ts`**: added a `ResizeObserver` on the `#app` parent element,
  right after `Phaser.Game` construction, that calls `game.scale.refresh()`
  whenever `#app`'s observed size changes. This reacts to the real size
  actually becoming correct (whenever itch.io actually resizes the
  iframe) rather than guessing at a timeout, and triggers the exact same
  recalculation Phaser's own internal window-resize listener already
  performs on a normal resize - `game.scale.refresh()` is Phaser's own
  documented API for this ("Refreshes the internal scale values, bounds
  sizes and orientation checks... called automatically by the Scale
  Manager when the browser window size changes"). The observer is never
  disconnected - it stays active for the page's lifetime, same as
  Phaser's own listener.
- `WIDTH`, `HEIGHT`, `PIXEL_RATIO`, and every property already in the
  `scale` config object are untouched - this only adds one additional
  trigger for a recalculation Phaser already knows how to do.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Direct, precise verification that the new mechanism actually works**
  (via a temporary debug hook exposing the `Phaser.Game` instance,
  removed before finishing): wrapped `game.scale.refresh` to count calls,
  then changed `#app`'s own CSS `width`/`height` directly (60%/70% of its
  previous size) - an element-only resize that does **not** dispatch a
  `window` `resize` event, so Phaser's own built-in listener could not
  have caught it. Confirmed `#app`'s measured size actually changed
  (430×900 → 258×630) and `game.scale.refresh()` was called exactly
  once as a direct result - proving the `ResizeObserver` this task adds
  is the thing catching this case, not some other existing mechanism.
- **Best-effort simulation of the actual itch.io race**: loaded the game
  inside a wrapper page's `<iframe>` that starts at a stale tiny size
  (10×10) and gets resized to its real size (400×860) via a `setTimeout`,
  mimicking itch.io's async resize. The canvas ended up correctly filling
  the real size in this simulation - but changing an iframe element's
  `width`/`height` HTML attributes from the outer page turns out to
  already dispatch a `resize` event to the iframe's own inner `window`
  in Chromium, which Phaser's *existing* listener alone might already
  catch, regardless of this fix. **This means the simulation doesn't
  conclusively isolate this fix's contribution the way the direct
  `#app`-only test above does** - noted honestly rather than overclaimed.
- Playwright boot/console check (non-iframe, matching the GitHub Pages
  deploy shape): booted the lobby and a single-player-vs-bots game,
  confirmed identical, correct rendering to before this change, with a
  clean console aside from the known pre-existing Google Fonts
  sandbox-network failure and the same intermittent, previously-
  established-as-unrelated 404 seen in prior tasks' checks.
- **This specifically still needs re-verification on the live itch.io
  deploy after merge** - Playwright cannot reproduce itch.io's actual
  iframe-resize timing (its own async behavior is the whole premise of
  the bug), so the direct `#app`-resize test above is the strongest
  verification available pre-deploy, but confirming the game boots
  correctly on a fresh load of the real itch.io page (no DevTools open,
  no manual resize) is the real acceptance test for this fix.

## Key technical decisions

- **`ResizeObserver` on the specific element, not a timer or a second
  `window` resize listener** - a `setTimeout`/`requestAnimationFrame`
  guess would have to assume how long itch.io's resize takes, which is
  exactly the kind of race condition already causing the bug. A
  `ResizeObserver` reacts to `#app`'s real size actually changing,
  whenever that happens, with no assumption about timing. It also
  observes the element directly rather than relying on `window`'s own
  `resize` event, which - per this task's own verification - is not
  guaranteed to fire for every case that changes `#app`'s effective size.
- **No disconnect/cleanup** - per the brief, this observer is meant to
  behave like Phaser's own internal resize listener: a permanent,
  page-lifetime concern, not a per-scene resource needing teardown.

## Open questions

None on the implementation itself. Whether itch.io's specific resize
timing is fully covered by this fix (as opposed to some other iframe
lifecycle quirk) can only be confirmed by the live re-verification noted
above and below.

## Known issues

- **This fix needs re-verification on the live itch.io deploy** - see
  "How this was verified" above. This is the one environment where the
  original bug was observed, and Playwright cannot reproduce itch.io's
  actual iframe-resize timing.
- Carried over, untouched by this task: genuine gameplay verification of
  off-suit masking via real bot/human play is still pending; Rules-modal
  content gaps (no Setup section, off-suit hidden-identity nature
  unstated in the copy); the other three seat tags still don't use
  `ui_player_nameplate.png` (deliberate, from an earlier visual pass).

## Next proposed step

Re-verify on the live itch.io deploy after this merges: load the game
fresh (no DevTools open, no manual window resize) and confirm the board
renders correctly on first paint. If it still doesn't, the next place to
look is whether itch.io's iframe embed goes through an intermediate
wrapper that changes `#app`'s size in a way `ResizeObserver` also
doesn't catch (e.g. a CSS transform instead of a real layout-affecting
resize, which `ResizeObserver` does not observe).
