## Current milestone

Added a 2-second client-side dwell on a just-completed trick (all 4
played cards, trick winner apparent) before the UI advances to
redistribution/chooseDelegate - a pure presentation-layer delay, with
the host's own game-logic timing and network broadcast timing
completely untouched.

## Investigation: how `trickResult` actually flows from host to client

Read before implementing, per the task's own instruction. Confirmed:
`gameHost.ts`'s `settleAutoPhases()` auto-chains through the engine's
`'trickResult'` (and `'blocker'`) phases entirely inside one
synchronous host tick, every single time (`applyAction()` always calls
`settleAutoPhases(next)` before returning). **A client never receives
`'trickResult'` as its own distinct masked-state update** - by the time
any broadcast lands, the state has already jumped straight from
"3 plays, someone about to play the 4th" to "trick fully resolved,
next real decision phase" in one step. So there's no phase value to key
a delay off of.

The actual detectable signal is diffing consecutive masked states:
`previousTrick` (`host/mask.ts`, copied from `state.lastTrickResult`)
changes to a new, different value exactly when a trick resolves, and
then stays constant through the whole chooseDelegate/redistribution
phase that follows it. `trickNumber` does **not** work for this - it
only increments inside `redistribute()`, i.e. after redistribution
completes, not when the trick itself resolves - so it stays the same
across the exact transition this task needs to detect. Used
`previousTrick` diffing (approach (a) offered in the task).

## What changed

**Files changed**: `ui/renderGameView.ts` (new `presentGameView`
export, `PersistentUIState` extended), `scenes/HostGameScene.ts` /
`scenes/PlayerGameScene.ts` (call `presentGameView` instead of
`renderGameView` directly), `tune.json` (`trickResultDwellMs: 2000`).
**No host-logic file (`rules/engine.ts`, `host/gameHost.ts`,
`host/botAI.ts`) touched at all** - the critical architectural
constraint holds: the host resolves and broadcasts exactly as fast as
before, on every client, all the time.

- **`presentGameView(scene, container, masked, sendAction, ui)`** - the
  new entry point both scenes now call instead of `renderGameView`
  directly (which still exists, unchanged, and is what `presentGameView`
  itself calls under the hood - no duplicated rendering logic):
  - Fingerprints `previousTrick` (`JSON.stringify`, at most 4 small
    entries - cheap) and compares it to the last one this client
    presented. A change (and not the client's very first-ever
    presented state, so a reconnecting peer picking up mid-game never
    misreads its first paint as "a trick just completed") means a
    trick just resolved.
  - If so: renders a **frozen** view immediately - the real masked
    state with `currentTrick` replaced by `previousTrick` (so play
    areas show the real 4 finished plays via the exact same rendering
    path a live trick already uses, rather than the already-reset
    `currentTrick`/a redistribution stack that would otherwise appear
    instantly) and `currentTurn`/`redistribution`/`delegateChoices`
    forced to `null`. These are the same legitimate "nothing pending
    right now" values these fields already take between real
    decisions, not a fabricated state shape - and they cascade to
    disable every interactive element for free: `renderCardFan`'s
    `inRedistributePhase` check is `state.redistribution !== null`, the
    seat-tag delegate picker's `isDelegating` check is
    `state.delegateChoices !== null`, and `computeActionButtonState`'s
    very first check is `state.currentTurn === state.yourSlot`. No
    separate "interactions disabled" flag was needed anywhere.
  - Schedules one `scene.time.delayedCall(tune.trickResultDwellMs, ...)`
    to present the real state after the hold. Tracks the *latest*
    masked state received during the hold (not the one that triggered
    it), so if the host has already moved further by the time the hold
    elapses (a bot's redistribution, even the next trick starting -
    see verification below), the client jumps straight to what's
    actually current rather than a stale intermediate snapshot.
  - While a hold is already pending, any further updates just refresh
    "the latest state" and return - no re-triggering, no stacking of
    multiple holds.
  - `renderGameView`'s own internal `rerender()` closure (used for
    local UI actions like toggling sort or staging a card - see
    `ViewState`'s doc comment) is untouched and still calls
    `renderWithView` directly, never `presentGameView` - only a
    genuinely new masked state from the network should ever be
    eligible to trigger a hold.
- **`tune.json`**: added `trickResultDwellMs: 2000` - the only new
  tunable value, live-editable via the existing generic Tweakpane panel
  under `?debug=1` with zero additional code (same mechanism as every
  other tune value).

## How this was verified

Per the lesson from the recent Center HUD rotation task, this was
checked with **real gameplay**, not fabricated/injected state:

- `npm run typecheck` / `npm run build` (repo root) - clean.
- Confirmed `trickResultDwellMs` appears as a live-editable field in the
  `?debug=1` Tweakpane panel.
- Two temporary, read-only debug hooks (`HostGameScene.ts` exposing its
  own last-built real `MaskedState` and its `PersistentUIState`
  instance directly; `main.ts` exposing both plus real-card-click and
  real-redistribution-plan helpers built from the actual, unmodified
  `computeHandLegality`/`computeFanScale`/`computeFanLayouts` functions
  - same pattern as prior tasks this session) - added, used, then fully
  reverted; `git diff` against `main` is empty except the four files
  listed above.
- A Playwright script played a real Single Player game (real card
  clicks, real "Play Card" button presses, bots via the untouched
  `driveBotsIfNeeded`/`chooseBotAction`) until a real trick resolved,
  then, in real time:
  - Confirmed the **real host-side state** had already fully advanced
    the instant `previousTrick` changed (`turnPhase: "redistribute"`,
    `previousTrick` holding all 4 real plays) - proving the host was
    never blocked or delayed by anything client-side.
  - Confirmed `pendingHoldMasked !== null` (a hold was active) at that
    exact moment, and that **no action button was even enabled** to tap
    during the hold (`tapDuringHoldEnabledCount: 0`); attempting a tap
    anyway had zero effect on real state (`tapDuringHoldHadNoEffect:
    true`).
  - Polled until the hold cleared: **~1.8-1.9 seconds** elapsed both
    runs (two independent playthroughs), matching `trickResultDwellMs`
    (2000ms) within polling granularity (50ms) and per-step overhead.
  - Screenshotted mid-hold: all 4 played cards fully visible in their
    real play-area positions, "Lead Player" tag correctly on the actual
    trick leader's seat, bottom prompt showing "Waiting..." (not
    "Select a card") - exactly the required frozen frame.
  - Screenshotted after the hold cleared: in both runs, the real host
    had *already* processed an entire bot redistribution (and, in one
    run, started the next trick) during the ~2s the client was holding
    - and the client correctly presented that fully-current state
    rather than a stale one, demonstrating both "host not blocked" and
    "always show what's actually current" at once.
- Browser console clean throughout - only the pre-existing, unrelated
  sandboxed Google Fonts network noise present on every boot in this
  environment.

## Open questions

None new - the task's own investigation section anticipated exactly
the mechanism needed (diffing consecutive states) and named the
critical constraint (client-only delay) clearly enough that no
mid-session clarification was needed.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); `ui_player_nameplate.png` still applies to the local seat
tag only (deliberate); the `'partner'` hand-fan state still has no
working visual differentiation from `'legal'`; the itch.io iframe
canvas-scale fix, the asset pipeline's downscale/recompress output, the
hand-fan edge-bound fix, and the Center HUD easing curve still want a
real-device/live-deploy glance; this task's own real-gameplay
verification was likewise a local dev-server Playwright pass
(single-player vs. bots), not an actual itch.io build or a real
multi-human-peer game - the latter would be the strongest possible
confirmation that per-client holds truly never entangle with each
other, though nothing in the implementation is peer-count-dependent
(each `PersistentUIState`/hold lives entirely on its own client).

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the next open loop - a real multi-peer game (not just
single-player vs. bots) would be the highest-value addition to this
task's own verification specifically, given the per-client independence
claim.
