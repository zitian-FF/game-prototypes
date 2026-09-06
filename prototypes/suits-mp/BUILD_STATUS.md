## Current milestone

Fixed the off-suit card masking gap at the payload level, closing a
pre-existing hole every prior session's BUILD_STATUS.md had carried
forward as a known issue: `host/mask.ts` was sending the real card ID for
another player's face-down off-suit Single to every peer, relying
entirely on `ui/renderGameView.ts`'s client-side check to hide it. Per the
architecture doc's own canon ("masked peer payloads, the active trick
display and public Trick records must not reveal the card's suit, rank,
Deity Symbol, color or identity") and CLAUDE.md's host-authoritative
masking principle, this had to be fixed at the host, not the renderer.

## What was implemented

- **`host/mask.ts`**: new `maskedCardIds(play, forSlot)` helper - returns
  `[]` when `play.kind === 'offsuit'` and the play isn't `forSlot`'s own,
  otherwise returns `play.cardIds` unchanged. Applied at both places
  `MaskedTrickPlay[]` gets built (`currentTrick` and `previousTrick`),
  replacing the direct `cards: play.cardIds` in each. Every other play
  (`normal`, `double`, and the viewer's own `offsuit` plays) is completely
  unaffected - `maskedCardIds` returns the real array unchanged for all of
  those.
- **`ui/renderGameView.ts`**: `maskedPlayFaces`'s doc comment updated to
  reflect that the payload is now genuinely masked - the existing
  `kind === 'offsuit' && play.player !== yourSlot` check is now
  defense-in-depth (the client no longer has the real id to leak even if
  this check were removed), not the only thing preventing exposure. The
  function's actual logic is byte-for-byte unchanged - it still checks
  `kind`/`yourSlot` and still returns a facedown `CardFace`; the only
  difference is `play.cards` now arrives already empty for a masked play,
  so `play.cards.map(...)` for an unmasked play still works exactly as
  before.
- `net/actions.ts`, `PlayKind`, `handLegality.ts`, bot AI, and the
  Redistribution Log's own masking (already correct - it only ever shows
  cards the viewer personally gave or received) - untouched, per scope.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Payload-level verification (not just the renderer)**: wrote a scratch
  script (deleted before finishing) driving the real engine and the real
  `buildMaskedState()` - `initGame`/`playCard`/`settleAutoPhases` from
  `rules/engine.ts`/`host/gameHost.ts`, then `host/mask.ts`'s own
  `buildMaskedState()` directly, not a reimplementation - through a
  constructed scenario: a leader plays a normal Single, the next player
  is dealt no cards of the required suit (and no rank-matching pair),
  forcing a genuine `kind: 'offsuit'` play. Called `buildMaskedState()`
  for a *different* player's slot and asserted the offsuit play's
  `cards` array is `[]` while its `kind: 'offsuit'` stays visible (public,
  per the GDD); called it again for the offsuit player's *own* slot and
  confirmed they see their real card. Repeated both checks against
  `previousTrick` after completing the trick (the second masking call
  site), and confirmed the leader's ordinary play keeps its real card ID
  for every viewer. All 8 assertions passed on the first run after the
  implementation was written:
  ```
  PASS - offsuit play kind resolved correctly
  PASS - other viewer sees empty cards for offsuit play
  PASS - other viewer still sees kind=offsuit (public)
  PASS - the player themself sees their own real card
  PASS - trick actually resolved
  PASS - previousTrick: other viewer sees empty cards for offsuit play
  PASS - previousTrick: the player themself sees their own real card
  PASS - normal play cards unaffected for other viewer
  ```
- Playwright against `npm run preview`: booted the lobby, started a
  single-player-vs-bots game, confirmed the board renders identically to
  before this change (this fix touches no rendering code) and the browser
  console is clean aside from the known pre-existing Google Fonts
  sandbox-network failure and the same intermittent, previously-
  established-as-unrelated 404 seen in prior tasks' checks.

## Key technical decisions

- **Masked at the exact point the payload is constructed, not by
  filtering later** - `maskedCardIds()` sits inline in the same `.map()`
  that already builds each `MaskedTrickPlay`, so there's exactly one
  place either masking function's field values could drift from what
  actually gets sent, matching how `deityCardState` and every other field
  on that type are already built the same way.
- **`kind` stays visible on a masked play, only `cards` is emptied** -
  this matches the GDD's own wording exactly ("public state reveals only
  that an off-suit Single was played") and is what the client-side
  `maskedPlayFaces` check already depended on (`play.kind === 'offsuit'`)
  - no renderer change was needed beyond the comment, confirming the
  fix's payload-level and renderer-level halves were already designed to
  compose correctly.

## Open questions

None - the architecture doc's masking requirement was unambiguous and
directly verified against the real payload, not assumed from the
renderer's behavior alone.

## Known issues

- **Off-suit masking still hasn't been verified via genuine gameplay**
  (real bot-driven or human play triggering an off-suit Single naturally,
  then inspecting the live network payload in that session) - this task
  verified the masking function directly against the real engine and
  `buildMaskedState()`, which is a stronger guarantee of correctness than
  a screenshot could give, but a live end-to-end pass (matching the
  architecture doc's own note that "genuine gameplay verification remains
  pending" for this area) hasn't happened yet. This is a *distinct*,
  narrower item from the leak itself, which this task closes.
- Carried over, untouched by this task: `advanceBlocker()`'s premature
  `checkSuitCompletion()` call; Rules-modal content gaps (no Setup
  section, off-suit hidden-identity nature unstated in the copy itself,
  as opposed to the wire-level fix this task makes); the other three seat
  tags still don't use `ui_player_nameplate.png` (deliberate, from the
  prior visual pass).

## Next proposed step

Genuine gameplay verification of off-suit masking (per the "Known issues"
item above) - ideally as part of whatever task next does real multi-
device or multi-bot playtesting, rather than a dedicated task on its own.
