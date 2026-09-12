## Current milestone

Fixed a regression from the "Remove Twin Awakening terminology and add
Double mid-selection guidance" task (#107): when off-suit with one card
selected that happens to share its rank with another card in hand, the
action button showed only "Double / Select two cards of the same rank."
and gave no way to confirm the already-legal facedown single. The
facedown-single confirm now stays the primary action in that case; the
Double option is surfaced as secondary hint text instead.

## What was implemented

- `computeActionButtonState` in `ui/renderGameView.ts` (`turnPhase ===
  'play'` branch): the same-rank-partner check that previously
  short-circuited to a disabled `{ label: 'Double', ... enabled: false,
  onClick: NO_OP }` no longer replaces the primary action. It now only
  changes the `hint` text on the normal, enabled facedown-single result -
  the `label` ("Facedown Card"), `enabled: true`, and `onClick` (commits
  `playCard`/`facedownSingle`) are computed exactly as they already were
  for every other `playType`, unconditionally.
- Hint text: `'Commit the chosen card'` normally; `'Commit now, or select
  a matching card for a Double'` specifically when `type ===
  'facedownSingle' && cards.length === 1` and a same-rank partner exists
  elsewhere in `state.yourHand` - the exact same detection condition the
  prior (buggy) code already used, just no longer gating the primary
  action itself.
- Nothing else changed: `handLegality.ts`'s state machine (already
  correct, per its own doc comment - it was always computing
  `playType: 'facedownSingle'` correctly), `nextSelectionAfterTap` (how
  tapping a second, same-rank card extends the selection into a Double),
  and every other action-button state (`single`/`double`/delegate/
  redistribution) are all untouched.

## Key technical decisions

- Kept the fix entirely inside the existing branch shape rather than
  adding a second early-return: computing `label` once up front (moved
  above the partner check, since it's now needed regardless of the
  partner check's outcome) and mutating a local `hint` variable keeps
  the diff small and avoids duplicating the
  `single`/`double`/`facedownSingle` label ternary that already existed
  below.
- Deliberately did not try to present the Double as a second, separately
  reachable action alongside the confirm button (the task's second
  "reasonable approach") - the existing action button is a single
  label/hint/onClick tuple with no support for two simultaneous actions,
  and the Double is already fully reachable through the existing
  tap-a-partner-card interaction (`nextSelectionAfterTap`), so secondary
  hint text was the right fit without restructuring the button.

## Verification

- `npm run typecheck` and `npm run build` both pass with no errors.
- All three required scenarios verified through real, live Single Player
  gameplay (temporary forced-deal debug hook added to
  `host/gameHost.ts` for a deterministic off-suit hand, fully reverted
  before commit - `git diff`/`git status` show only `ui/renderGameView.ts`
  changed):

  **(a) Off-suit, one card selected, matching partner exists.** Forced
  the human host's hand to `[Cthulhu-7, ShubNiggurath-7, ShubNiggurath-5]`
  against a required suit neither card matched. Selecting `Cthulhu-7`
  alone showed `"Facedown Card"` / `"Commit now, or select a matching
  card for a Double"`, `enabled: true`. Clicking it confirmed the
  facedown single and the trick advanced (Trick 2 -> Trick 3,
  `"Waiting for Player 2..."`) - the previously-unreachable confirm now
  works.

  **(b) Same scenario, tap the partner instead.** Selected `Cthulhu-7`,
  then tapped `ShubNiggurath-7` (same rank, the partner) instead of
  confirming: both cards showed selected/popped-out and the button
  correctly switched to `"Play Double"` / `"Commit the chosen card"`.
  Confirming advanced to `"Select Delegate"` (a Double win's mandatory
  delegation) - the Double-completion mechanic itself is completely
  unaffected by this fix.

  **(c) Off-suit, one card selected, no partner.** Selected
  `ShubNiggurath-5` (the only rank-5 card in the forced hand) - button
  showed the plain, unchanged `"Facedown Card"` / `"Commit the chosen
  card"`, no Double mention. Confirming advanced the trick normally,
  exactly as before this fix.

- Browser console clean on boot and through all three scenarios plus a
  final untouched-random game on the fully reverted build (only the
  known sandboxed `fonts.googleapis.com`/asset-fetch 404 noise present
  in every prior task this session).
- Confirmed no debug-hook residue: `git diff` on `host/gameHost.ts`
  shows zero changes.

## Open questions

None - the required fix, the two reasonable approaches to choose
between, and all three verification scenarios were fully specified by
the task; no ambiguity required asking the user mid-session.

## Known issues

None found from this fix. Known sandboxed asset-fetch console noise
(unrelated host, present since before this task) still appears on every
boot in this environment - not a regression, not investigated further
here (out of this task's scope).

## Next proposed step

None specifically prompted by this task - it was a scoped regression
fix. Per `suits-mp-bot-ai-design.md`'s recommended order (from the
immediately preceding bot-AI task), underlying capability 3.1 (card
counting) remains the next planned step whenever bot AI work resumes.
