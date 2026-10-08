## Current milestone

Tutorial mode is now complete: all 6 scenes from
`suits-mp-tutorial-design.md` are built and wired end-to-end, including
the final scene's real suit-completion win and the universal Victory
Screen it leads to.

## What was implemented

- `tutorial/tutorialScenes.ts`: added `TUTORIAL_SCENE_6` ("Double,
  delegate, and winning the game" - the design doc's Section 3 finale),
  replacing the last `null` placeholder in `TUTORIAL_SCENES`. Unlike
  every prior scene, this one ties into the real win condition
  (`checkSuitCompletion`) rather than ending once a single concept is
  conveyed: the local player's hand is scripted to hold 8 of their own
  10-card Deity Suit plus a same-rank Double pair, wins the trick with
  the Double, mandatorily delegates to their ally, and the ally's own
  scripted redistribute step gifts back the 2 missing suit cards -
  completing the suit for real and triggering the actual Team win.
- `tutorial/tutorialTypes.ts`: new `TutorialLock`/`GuidePointerTarget`
  variant `'doubleCards'` (a scripted same-rank pair, live-resolved the
  same way `'redistributeAssignments'` already resolves its own
  multi-step plan). Removed the long-reserved, never-actually-needed
  `'actionButton'` variant from both unions now that all 6 scenes are
  built and neither ever needed it (Scene 5's own investigation already
  found `'handCard'` sufficient for a bare confirm; Scene 6's Double step
  needed a new *card-pair* variant, not a button-targeting one).
- `ui/renderGameView.ts`:
  - `nextTutorialDoubleCardId`/`applyTutorialDoubleLock`: the Double
    step's hard-lock resolver, mirroring `nextTutorialRedistributeTarget`'s
    live-resolution-from-real-state pattern.
  - Wired `'doubleCards'` into the play-phase legality/pointer dispatch,
    and `'seat'` into the pointer dispatch (previously only consumed
    internally by the redistribute-assignment pointer's own seat-mode).
  - `computeSeatDelegateState` now takes the tutorial config and gates
    seat tappability to the one scripted ally when a `'delegateTo'` lock
    is active - the same hard-lock-everywhere rule every other guided
    moment already follows, just not yet needed until this scene.
  - The tutorial scene-selector/quit top bar now closes once
    `state.winner` is set (`if (tutorial && !state.winner)`) - Scene 6 is
    the first tutorial scene that can ever reach a real win, and the
    universal Victory Screen should own the whole screen at that point,
    not share it with a bar that has nothing left to select or quit out
    of.
  - `startVictorySequence`/`showVictoryScreen` take a new `isTutorial`
    flag, threaded through to `openVictory` so the Victory Screen can
    append "Tutorial Complete" in this context.
- `uiState/domUiStore.ts`: `openVictory` takes a new `isTutorial`
  parameter, stored as `victoryIsTutorial` and reset on `closeVictory`.
- `ui/CanvasUiScene.ts`: `drawVictory()` renders "Tutorial Complete" under
  the trick count when `victoryIsTutorial` is set.
- `scenes/TutorialScene.ts`: `scheduleNextIfAuto()` now returns
  immediately once `this.state.winner` is set, so Scene 6's own
  completion-modal fallback timer (meant for a scene with no next scene
  *and* no real win) never fires on top of the real Victory Screen that
  takes over instead. Updated the file's own header comment, stale since
  only Scenes 1-2 existed when it was written.

## Key technical decisions

- Local player's own god is `Cthulhu` in Scene 6's deal, unlike every
  prior scene's `Nyarlathotep` - `checkSuitCompletion` only ever checks
  "does this player's hand hold every card of THEIR OWN god", and no
  prior scene ever exercised that check, so the god label never mattered
  before. Cthulhu matches the Dormant Deity Card flavor every prior scene
  already used for this player (Scenes 1/2/4's own
  `cardId('Cthulhu', 'DeityCard')`), finally paid off for real. The
  ally's god stays Cthulhu's real teammate (`TEAMMATE_GOD`) -
  Nyarlathotep - so the familiar "your ally" framing holds; each scene
  is its own hard-cut `ForcedDeal` (design doc Section 1.4), never a
  continuous shared state, so the flipped label isn't a continuity break.
- The Double pair is rank 9 specifically (not any of the 8 ranks the
  local player's own suit already holds) - any overlapping rank would
  leave 3 same-rank cards in hand, making the real `'partner'` highlight
  ambiguously match more than the intended 2 cards.
- The ally's redistribution step gifts the local player 2 *different*
  cards than the ones they just played in the Double - this is correct,
  not a shortcut: `redistribute()` only checks the gift *count* matches
  each contributor's own play count (BRIEF.md's "Double-win card
  ownership" fix), and gifting back the 2 suit-completing cards the
  ally was holding all along is exactly the design doc's intended payoff.
- Verified mechanically via a headless script driving `initGame` +
  `applyAction`/`settleAutoPhases` directly against Scene 6's exact
  deal/script (no browser) - every step applied (`ok: true`), phases
  transitioned `turn -> chooseDelegate -> redistribution -> gameOver`
  exactly as scripted, and the final state showed `winner: {team:
  "Chaos", reason: "suit", ...}` with the local player's hand holding
  all 10 Cthulhu cards. This caught the exact card-math design (rank
  choice, required-suit avoidance, delegate/redistribute targets) with
  far tighter iteration than browser-driven trial and error would have.
- Real-gameplay Playwright verification (temporarily swapping
  `TUTORIAL_SCENES` to `[TUTORIAL_SCENE_6]` alone for this one
  verification pass, reverted before commit - confirmed via `git diff`):
  hard-lock on the Double step (tapping a locked Cthulhu card no-ops;
  tapping the correct first card selects it and shows "Play Face-Down
  Single / Or select a same-rank card to play a Double"; the guide
  pointer live-moves to the second card once the first is selected;
  tapping it shows "Play Double"), hard-lock on delegate selection
  (tapping Player 3 or Player 4's seat no-ops; only Player 2, the
  scripted ally, stages and confirms), the ally's auto-redistribute
  firing and completing the suit, and the real universal Victory Screen
  ("Team Chaos Won" / "After 6 tricks" / "Tutorial Complete" / full
  identity reveal / working Back to Menu). Also replayed Scene 1 with the
  real 6-scene array restored to confirm no regression in the shared
  rendering code this task touched (lock/pointer dispatch,
  `computeSeatDelegateState`'s new parameter, the top-bar condition).

## Verification

`npm run typecheck`: pass (after `npm install` - a fresh container
session needed workspace packages linked first; unrelated to this
change).
`npm run build`: pass.

**Headless engine simulation** (no browser): Scene 6's full deal/script
driven directly through `applyAction`/`settleAutoPhases` - every step
accepted, correct phase transitions, correct final winner and completed
hand. See "Key technical decisions" above for the full trace.

**Real-gameplay Playwright verification** (Chromium, dev server, fresh
`fetch-assets`/`pack-assets` run since this container started with no
art cached): full Scene 6 playthrough from the Landing screen's Tutorial
button through intro dismissal, the 3 scripted auto-plays, the Double
hard-lock/pointer, the delegate hard-lock/pointer, the ally's
auto-redistribute, the real Victory Screen with "Tutorial Complete", and
Back to Menu - all screenshot-confirmed at each step. Scene 1 replayed
afterward with the real 6-scene array to confirm no regression.
Console errors: only the pre-existing sandbox-only
`ERR_CERT_AUTHORITY_INVALID` (Google Fonts) and a 404 (confirmed to be
the dev server's own missing favicon, not an asset this feature touches)
throughout every run - no new errors introduced.

## Open questions

None required asking the user mid-session - the task ("complete the
tutorial mode") was unambiguous once the design doc
(`suits-mp-tutorial-design.md`, Google Drive) and the existing
Scenes 1-5 code made the one remaining gap (Scene 6, still `null`)
clear.

## Known issues

None outstanding for tutorial mode itself. Unrelated to this task: this
container started with no suits-mp art cached at all (a fresh-session
artifact, not a repo issue) - `fetch-assets`/`pack-assets` were re-run
as part of verification.

## Next proposed step

None - tutorial mode is feature-complete per
`suits-mp-tutorial-design.md`. Any further polish (real guide-pointer
art replacing the placeholder triangle, per the design doc's own
explicit "art: placeholder for now" note) is a separate, future task.
