## Current milestone

Added a loading progress bar shown during `HostGameScene`/`PlayerGameScene`'s
asset preload phase, hooked to Phaser's real Loader events - the card art
set (backdrops, frames, symbols, faces, nameplates per Deity, several
files over 1MB) had grown large enough that a slow connection left a
blank/frozen canvas for the whole fetch, with no feedback that anything
was happening.

## What was implemented

- **`ui/loadingProgress.ts`** (new): `showAssetLoadProgress(scene)` draws a
  simple bar + percentage (title text, a rounded-rect track/fill pair via
  `Graphics`, a `%` readout) and wires it directly to `scene.load`'s own
  `Phaser.Loader.Events.PROGRESS` and `FILE_LOAD_ERROR` events - never a
  timed/faked animation. `PROGRESS`'s value is Phaser's own
  `completed-or-failed / total-queued` ratio, the standard signal every
  Phaser loading bar uses; it reflects real files as they land, including
  the brief backwards jump right after `preloadCardArt`'s own two-phase
  load (manifest.json first, then the ~25 images it lists) enqueues the
  bulk of the queue - an honest artifact of showing the loader's real
  state at each moment, not smoothed away.
  - Returns a small handle: `hadError` (set once any file fails),
    `showRetry(onRetry)` (reveals a distinct, differently-colored message
    plus a "tap to retry" prompt wired to `onRetry`), and `hide()` (tears
    the whole overlay down).
  - Re-applies the same `PIXEL_RATIO` camera zoom/center every other
    scene's `create()` sets up, since `preload()` (where this overlay
    must exist) runs *before* that - otherwise the overlay's logical
    coordinates wouldn't line up with the unzoomed default camera preload()
    starts with.
- **`scenes/HostGameScene.ts`** / **`scenes/PlayerGameScene.ts`**: both
  call `showAssetLoadProgress(this)` at the top of `preload()`, right
  alongside the existing `preloadCardArt(this)` call. In `create()`:
  - If `hadError`, call `showRetry(() => this.scene.restart(data))` and
    return before doing anything else - no attempt to render a game view
    missing card art. Restarting the scene re-runs `preload()`, and
    `preloadCardArt`'s manifest-driven loader only re-requests textures
    that don't already exist in the Texture Manager, so a retry after a
    partial failure doesn't re-fetch what already succeeded.
  - Otherwise, hide the overlay at the exact moment the real game view is
    about to render, not simply "as soon as preload finishes" - the two
    scenes differ here because their real first render happens at
    different times:
    - `HostGameScene`: renders synchronously in the same `create()` call
      (via `broadcastAll()`), so `hide()` is called immediately at the
      top of `create()`.
    - `PlayerGameScene`: has nothing to render until its first masked
      state arrives over the network (`actions.state.onMessage`), so
      `hide()` is deferred to inside that handler, guarded to fire only
      once - keeping the overlay up through the (usually brief) gap
      between "assets are ready" and "the first real state actually
      arrived" instead of dropping to a blank canvas in between.

## Key technical decisions

- **Canvas-drawn, not a DOM overlay.** `preload()` runs before `create()`,
  well before the DOM lobby/overlay layer's own screens are relevant to
  this scene, and the canvas already exists at that point with no extra
  mount-timing to coordinate. A two-primitive bar + percentage doesn't
  need the Claude-Design-mockup pipeline real HUD chrome goes through -
  this reuses the same plain-canvas-primitive pattern this codebase
  already has for other full-screen status overlays in these same files
  (`orientation.ts`'s portrait guard, `PlayerGameScene`'s own "Host
  disconnected" overlay): a dark rectangle plus centered `monospace` text,
  matching the existing *canvas*-layer visual language rather than the DOM
  lobby's fancier serif/gold styling (which lives in a different layer
  this scene doesn't otherwise touch).
- **Retry reuses `scene.scene.restart(data)`**, not a new retry mechanism -
  the closest existing pattern for surfacing a load/connection failure
  (`ConnectingScene`'s `fail()` cases) reuses whatever recovery path was
  already natural for that scene; here, restarting the scene is that path,
  and it composes correctly with `preloadCardArt`'s already-idempotent,
  manifest-driven, per-texture-existence-checked loading.
- **No new `tune.json` entry.** The bar has no animated/eased transition
  (direct redraw on each `progress` event, immediate show/hide) - nothing
  about its *feel* needed a tunable value, so nothing was added.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Mid-load screenshot, real Loader events, throttled network**
  (Playwright + a CDP `Network.emulateNetworkConditions` session limiting
  the asset-preload phase only, not the app shell's own JS bundle):
  captured the bar visibly showing real, non-zero, non-100% progress
  (e.g. "4%") while the ~26MB asset set was still in flight, confirmed it
  correctly reaches 100% and disappears cleanly into the real rendered
  board with no interstitial blank frame once the load actually finishes.
- **Real load-failure screenshot** (Playwright `page.route()` aborting one
  specific card-art request with `connectionfailed` - a genuine
  connection-level failure, not a mocked event): confirmed
  `Loader.Events.FILE_LOAD_ERROR` fired, the bar's percentage reached 100%
  (Phaser counts a permanently-failed file as settled), and a distinctly
  colored failure message + "Tap here to try again" appeared instead of
  the bar silently sitting there. Tapping retry (with the abort then
  lifted, simulating the connection recovering) correctly restarted the
  scene and completed into the real, fully-rendered game view - including
  the specific card whose art had failed the first time.
- **Normal (unthrottled, local dev server) boot**: the bar is present but
  typically gone within ~150ms since local assets load near-instantly -
  confirms no regression/flash on the common fast path Playwright itself
  runs against.
- `page.on('pageerror')` empty across every run (throttled success,
  forced failure, and retry-recovery); console errors limited to the same
  pre-existing baseline noise from prior tasks (a sandboxed Google Fonts
  request, one intermittent unrelated 404).
- **Not verified**: a live two-peer `PlayerGameScene` join over real
  Trystero/WebRTC signaling. Attempted via Playwright (two browser
  contexts, host + join-by-code), but the join consistently timed out
  against the public Nostr relays from this sandboxed environment before
  a peer connection ever formed (`ROOM_NOT_FOUND`) - consistent with this
  session's existing caveats about real P2P networking not being reliably
  reproducible outside a real device/network (see prior tasks' own notes
  on itch.io iframe timing and off-suit-masking live-play checks).
  `PlayerGameScene`'s wiring was instead verified by code review against
  the identical, live-verified `HostGameScene` wiring - the only real
  difference (deferring `hide()` to the first `actions.state.onMessage`
  instead of calling it immediately) is a small, self-contained change
  with no new asset-loading logic of its own.

## Open questions

None from `BRIEF.md` - this task's own brief already anticipated and
answered the canvas-vs-DOM question ("use your judgment, noting the
choice in your report" - see "Key technical decisions" above).

## Known issues

- Carried over, untouched by this task: genuine gameplay verification of
  off-suit masking via real bot/human play is still pending; Rules-modal
  content gaps (no Setup section, off-suit hidden-identity nature unstated
  in the copy); the other three seat tags still don't use
  `ui_player_nameplate.png` (deliberate, from an earlier visual pass); the
  itch.io iframe canvas-scale fix still needs a live-deploy re-check.
- As above: this task's `PlayerGameScene` path has not been verified
  against a real two-peer WebRTC join in this environment - worth a
  real-device smoke test (two phones, or a phone + this repo's own dev
  server) the next time someone is testing live multiplayer anyway.

## Next proposed step

None specific to this task - it's a small, self-contained addition. The
next open item for this prototype remains the carried-over real-device/
real-network verification noted above and in "Known issues".
