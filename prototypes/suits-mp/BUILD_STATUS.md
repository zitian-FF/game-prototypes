## Current milestone

Closed a verification gap flagged against the prior Suit Cycle rotation
task: its own Playwright check used a fabricated-state debug hook and
only ever showed the bezel at rest with Yog-Sothoth lit - trick 1's own
opener is *always* the 2 of Yog-Sothoth (a real, hardcoded game rule, see
`rules/engine.ts`'s `forcedTrick1Opener`), which also happens to be the
bezel's default/home orientation. That meant the only screenshot anyone
had ever seen of this feature in real gameplay could not distinguish a
correctly-working rotation from a completely frozen one. This task
re-verified using genuine multi-trick gameplay (real `applyAction`
calls, real bots, real card plays) rather than injected overlay state.

**Result: no bug found.** The rotation mechanism from the prior task
works correctly. Full findings below.

## What was verified, and how

No code was changed this task - this was verification-only, and it
found nothing to fix. Two temporary, read-only debug hooks were added,
used, then fully reverted (confirmed via `git status`/`git diff` showing
zero diff against `main` afterward):

- `HostGameScene.ts`: stored the host's own last-built `MaskedState` on
  the scene instance (`lastMaskedStateForDebug`) right where it was
  already being computed for rendering - a read, not a mutation; no new
  state, no bypassed logic.
- `main.ts`: exposed that state read-only via `window.__gs()`, plus
  `window.__legalCardClickTarget()`, which calls the real, unmodified
  `computeHandLegality`/`sortCardIds`/`computeFanScale`/
  `computeFanLayouts` functions to find a real legal card in the real
  hand and compute its real on-canvas coordinates - so a driver script
  could locate what to click without guessing pixel positions or
  fabricating any card/hand data.

Everything that actually *changed game state* went through the real
UI: a Playwright script played real Single Player games by (1) reading
the live masked state via `__gs()`, (2) when it was genuinely the local
player's turn, using `__legalCardClickTarget()` to find a real legal
card and clicking its real canvas coordinates (a genuine synthesized
mouse event hitting the card's real Phaser hit-area, the same event
path a human tap or `bindTapIntent` produces), then clicking the real
DOM `[data-ui="action-button"]` to commit - the exact same
`sendAction({action:'playCard', ...})` -> `applyAction` path a real
player or bot uses. The three bot seats played automatically via the
game's own existing `driveBotsIfNeeded`/`chooseBotAction`, completely
untouched. **No `gameOverlayStore` state was ever injected** - the
distinction the task asked for.

The script played through 4 consecutive real tricks in one continuous
game and, at the moment each trick's real `leadSuit` became known
(after the real leader's card was actually committed, waiting past
`tune.suitCycleRotationMs`'s 950ms transition), recorded the DOM bezel
group's real `getComputedStyle().transform` and the real lit recess's
`data-suit`, then compared both against the value predicted by the
`suitDeg = -leadGodIndex * 90` formula:

| Trick | Real lead suit (from live `state.leadSuit`) | Expected rotation | Actual bezel transform | Lit recess |
|---|---|---|---|---|
| 1 | Yog-Sothoth (forced opener) | 0deg | `matrix(1,0,0,1,0,0)` (0deg) | YS |
| 2 | Yog-Sothoth (real winner happened to lead the same suit again) | 0deg | `matrix(1,0,0,1,0,0)` (0deg) | YS |
| 3 | Shub-Niggurath | 180deg | `matrix(-1,0,0,-1,0,0)` (180deg) | SN |
| 4 | Nyarlathotep | 90deg | `matrix(0,1,-1,0,0,0)` (90deg) | NY |

Tricks 3 and 4 are exactly the cases trick 1 alone could never rule
out: a real, non-default lead suit, reached through genuine gameplay,
with the bezel correctly rotated to a **non-zero** angle (180deg and
90deg respectively) and the correct recess lit in both. All four
tricks matched their predicted rotation exactly, and a screenshot taken
at trick 4 visually confirms the purple Nyarlathotep recess sitting at
the fixed top marker with its glow/label, Cthulhu at bottom, Yog-Sothoth
at right, Shub-Niggurath at left - upright and correctly positioned,
matching the same visual pattern confirmed with fabricated state in the
prior task, now reproduced with real state.

## Root cause of the original gap (not a code bug - a verification gap)

The prior task's own Playwright pass never played real gameplay far
enough (or at all) to reach a trick with a non-Yog-Sothoth lead suit,
because it used `gameOverlayStore.showGameOverlay()` directly with
hand-fabricated `leadGodIndex` values (1, then 3) rather than driving
real tricks. That approach happened to also prove the mechanism works
(it fabricated two *different* indices and confirmed both rotated
correctly relative to each other), so the underlying rotation logic was
never actually in doubt from a code-correctness standpoint - what was
missing was a demonstration that the real per-trick `leadGodIndex`
computed from live `MaskedState` (via `computeSuitRing` in
`ui/seating.ts` -> `leaderNode.suit` -> `GOD_TO_SUIT_INDEX` in
`ui/renderGameView.ts`) actually reaches the component correctly as
real tricks progress, as opposed to e.g. staying stuck at trick 1's
value due to a memoization bug, a missed re-render, or a stale prop.
This task closes that gap: the full real pipeline, end to end, is now
confirmed working, not just the presentation-layer rotation math in
isolation.

**Confidence-in-prior-verification note, stated plainly per this task's
own request**: prior tasks in this feature's history (Center HUD
redesign, rotation-restore, glow/label-keep) were each verified with
Playwright, but exclusively via fabricated `gameOverlayStore` state -
none of them had run a real multi-trick game before this task. That
verification gap is now closed for the rotation mechanism specifically;
it should be treated as a general pattern to watch for on any future
Center HUD/turn-order-driven feature in this codebase, since fabricated-
state Playwright checks (useful for isolating presentation logic
quickly) can mask a wiring bug between real game state and the
component exactly the way it did here, if the fabricated values happen
to coincide with what real play would produce - they didn't here in a
way that hid a bug, but the risk was real and is worth remembering.

## How this was verified (repeating the standard checklist)

- `npm run typecheck` (repo root) - clean, both with the temporary debug
  hooks in place and after reverting them.
- `npm run build` (repo root) - clean, same.
- **Genuinely live, multi-trick, gameplay-driven Playwright
  verification** - see above; this is the actual deliverable of this
  task, not a formality. Real `applyAction` calls advanced 4 real
  tricks; no `gameOverlayStore` state was fabricated at any point.
- Browser console clean throughout the entire 4-trick playthrough, not
  just at boot - only the pre-existing, unrelated sandboxed Google Fonts
  network noise present on every boot in this environment.

## Open questions

None new.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); `ui_player_nameplate.png` still applies to the local seat
tag only (deliberate); the `'partner'` hand-fan state still has no
working visual differentiation from `'legal'`; the itch.io iframe
canvas-scale fix, the asset pipeline's downscale/recompress output, and
the hand-fan edge-bound fix still want a real-device/live-deploy glance;
this task's own real-gameplay verification was still a local dev-server
Playwright pass (single-player vs. bots), not an actual itch.io build or
a real multi-human-peer game.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the next open loop. Given this task's own finding, worth
considering (not requested, just flagging) whether any *other* existing
Playwright verification in this codebase's history that relied solely on
fabricated `gameOverlayStore`/similar injected state deserves the same
real-gameplay re-check this task gave the Suit Cycle rotation.
