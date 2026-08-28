## Current milestone

BRIEF.md is implemented in full: a working idle-clicker mining loop
with energy, currency, ship upgrades, depth descent, a fixed-size
scale-to-fit board (5x6, no scrolling), and localStorage persistence
(including offline energy regen), with placeholder-to-real art already
swapped in for tiles, ship, ammo, laser hit-effect, and debris.
**This session** added a top-right Reset button with same-button
two-step confirmation: first tap arms a "Confirm reset?" state, a
second tap within the confirmation window clears the save and reloads,
and an unconfirmed arm auto-cancels back to "Reset" on its own.

CHANGELOG.md was checked before starting: no entries newer than
digger's last touch (both existing entries are dated 2026-08-27, the
same as the prior session, and both already noted as not applicable to
digger). No files were touched as a result of that check.

## What was implemented

- `tune.json`: added `resetConfirmWindowMs: 3000` — how long the
  "Confirm reset?" state stays armed before auto-cancelling.
- `src/state/persistence.ts`: added `clearState()`, which
  `localStorage.removeItem`s the `digger:save:v1` key. `loadState`/
  `saveState`/`freshState` unchanged.
- `src/debug/debugPanel.ts`: `RANGE` map gained a
  `resetConfirmWindowMs: { min: 500, max: 10000, step: 100 }` entry,
  consistent with the map's existing per-key ms-duration ranges (kept
  in sync since the map is directly typed against `tune.json`'s keys).
- `src/main.ts` (`DiggerScene`):
  - New transient instance field `resetConfirmUntil: number | null`
    (not part of `GameState` — deliberately not persisted, since a
    confirmation-in-progress has no business surviving a reload, and
    reload is literally what confirming does).
  - New `onResetButtonTap()`: if `resetConfirmUntil` is set and still
    in the future, calls `clearState()` then `window.location.reload()`
    and returns immediately (no `renderHud()` call needed — the reload
    replaces the whole page). Otherwise arms confirmation
    (`resetConfirmUntil = Date.now() + tune.resetConfirmWindowMs`) and
    calls `renderHud()` for immediate visual feedback rather than
    waiting for the next 1s timer tick.
  - `renderHud()` now renders the reset button itself, at the very top
    (before the `hudBottom`-anchored stack below it), via the existing
    `hudButton()` helper — same hit-region/rendering pattern the
    upgrade/descend buttons already use, just at a fixed top-right
    position (`WIDTH - 16 - 140`, `y=12`, 140x32) rather than chained
    into the vertical `y` stacking flow, since its return value is
    intentionally discarded. Label/color: `'Reset'`/`0x333333` by
    default, `'Confirm reset?'`/`0xaa2222` (red) while armed.
  - **Auto-cancel, no new timer**: at the top of every `renderHud()`
    call, `resetConfirming = resetConfirmUntil !== null && Date.now() <
    resetConfirmUntil` is computed, and if a non-null
    `resetConfirmUntil` has already passed, it's reset to `null` right
    there — same pattern the existing "Next in Ns" countdown already
    uses. Since `renderHud()` is already called every second by the
    scene's existing regen-tick timer (as well as after every tap),
    this makes the button revert to "Reset" on its own with no
    dedicated timer, exactly as specified. **Real-world latency note**
    (see "Key technical decisions"): because that 1s timer isn't synced
    to the tap, the visible revert can lag up to just under 1s past
    `resetConfirmWindowMs` itself — expected, not a bug, verified via
    Playwright.

## Key technical decisions

- **Auto-cancel latency is bounded by the tick interval, not exact to
  the window** — initially looked like a bug during verification (a
  screenshot taken ~3.35s after the tap, against a 3000ms window,
  still showed "Confirm reset?"), until a pixel-level timing sweep
  confirmed the revert did happen, just at ~3.5-4s, i.e. up to ~1s
  after the window strictly closed. This is the correct, specified
  behavior — the task explicitly said "just have `renderHud` check
  `resetConfirmUntil` against `Date.now()` each time it runs," reusing
  the existing 1s timer rather than adding a dedicated one — so the
  worst-case extra latency is bounded by that timer's own 1s period.
  Verification scripts account for this with a wait margin comfortably
  past `resetConfirmWindowMs + 1000ms`.
- **Reset button is rendered every `renderHud()` call, not built once
  in `buildHud()` like the static build-sha text** — required, not
  optional, since its label/color must reflect `resetConfirmUntil`,
  which changes on every tap and needs to be re-evaluated (for
  auto-cancel) on every timer tick. It lives in the `dynamicHud`
  container alongside the upgrade/descend buttons, not the one-time
  `hudLayer` additions in `buildHud()`.
  - **`hudButton()`'s return value (`y + h`) is deliberately discarded**
    at the reset button's call site — the helper was designed to chain
    into the existing vertical-stack layout (upgrade → descend), but
    the reset button is independently positioned in the top-right
    corner, so reusing the helper for its rect/label/hit-region
    plumbing was correct while its stacking behavior wasn't needed.
  - **Reset-button width (140px) chosen to fit "Confirm reset?" on one
    line** at the existing 14px monospace `hudButton` font without
    wrapping — verified visually via Playwright screenshot, not just
    computed, since `hudButton`'s `wordWrap` would otherwise silently
    wrap a too-narrow label across two lines.
- **`clearState()` + full reload, not manual field-by-field reset** —
  per the task's own reasoning: after `localStorage.removeItem`, a
  fresh `Phaser.Game` boot re-runs `create()` from scratch, which is
  far less error-prone than hunting down every transient scene field
  (camera zoom/center, `hudBottom`, `resetConfirmUntil` itself, tile
  sprite arrays, etc.) and resetting each by hand — verified by reading
  back `localStorage` after the reload (`null`, confirming the key
  actually stayed cleared through and past the reload) and confirming
  the reloaded board renders as a fresh, fully-unrevealed depth-0 board
  at full energy.
- **This is UI-only, additive work — no changes to energy, board,
  debris, laser, or upgrade logic**, per the task's explicit scope.
  The only touch outside `main.ts`/`tune.json`/`debugPanel.ts` is the
  one-line `clearState()` addition to `persistence.ts`.
- **Why the reset button stays in the existing Phaser `hudLayer`
  system rather than the newer React/Tailwind UI-chrome path**
  (CLAUDE.md's "UI implementation split," added to the house rules
  since digger's HUD was originally built): that rule applies "the
  next time a prototype does UI work" and existing UI code isn't
  force-migrated. The task itself specified the implementation in
  terms of digger's existing Phaser HUD primitives directly (`hudLayer`,
  `dynamicHud`/`renderHud`, the "Next in Ns" auto-refresh pattern), so
  it was implemented that way rather than introducing a second UI
  framework for one button while the rest of the HUD (ammo, loot,
  upgrade, descend) stays Phaser-rendered. Flagged in "Open questions"
  as worth confirming is the intended reading.

## Open questions

- **Confirming the Phaser-HUD (not React/Tailwind) implementation
  choice above was the intended reading** of "the next time a
  prototype does UI work" from CLAUDE.md's UI implementation split
  rule — this task's own wording pointed directly at the existing
  Phaser HUD primitives, so that's what was built, but flagging since
  it's the first UI-shaped digger task since that rule was added.
- **The 7x9 max-bound height-path check still fails** (carried over
  from the prior session, untouched by this one): at the real measured
  `boardViewportHeight` (~367px), a future 9-row board's tile height
  would fall under `minTileTapPx`. Still needs a human design decision
  before any future task grows a board toward 9 rows — see the prior
  session's notes; unaffected by this session's changes.
- The brief doesn't specify exact HUD layout/spacing — still designed
  freely within "functional clarity."
- **Ammo frame-order semantics** (energy 0 = full-looking, energy 31 =
  empty-looking) — still a deliberate departure from convention worth a
  second look during a human playtest.

## Known issues

- No automated tests are checked into the repo — verification relies on
  manual Playwright interaction scripts run locally each session.
- The reset button has no distinct "just reset" toast/confirmation
  after the reload completes — the reload itself, landing on a fresh
  depth-0 board, is the only feedback. Not specified by the task, so
  not added.
- 7x9 max-bound height-path check still fails at current real geometry
  (carried over, see "Open questions").
- Most of the 14 `debris*` tunables are still seeded placeholders, not
  yet human-tuned.
- **Verification note**: the full-repo `npm run build` and
  `npm run typecheck` still fail for reasons entirely unrelated to
  digger (`prototypes/mp-net`/`mp-console`/`suits-mp` can't resolve the
  `mp-core` workspace package) — same pre-existing, out-of-scope issue
  noted in the prior session, still unresolved, still confirmed
  unrelated to any digger change. Digger itself was verified clean via
  a scoped, temporary Vite config (not committed) that builds only
  `prototypes/digger/index.html`.

## Next proposed step

Resolve the two carried-over open items above (the Phaser-vs-React UI
placement reading, and the 7x9 height-path bound) when convenient.
Separately: playtest to tune the remaining un-tuned `debris*` values
and other seeded placeholders in `tune.json`.
