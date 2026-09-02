## Current milestone

The Redistribution Log is real content now, both the data (host-computed,
per-viewer, per-trick) and the canvas panel that renders it - replacing
the literal placeholder string that sat there since Stage 3a. Version
stamp counter unchanged (`8`), no deploy has run yet.

## What was implemented

- **`RedistributionLogEntry` restructured** (`net/actions.ts`): `count:
  number` replaced with real `cards: CardId[]`, and a new `groups:
  RedistributionLogGroup[]` (`{ toPlayer, cards }[]`) so one entry can
  hold multiple recipients - needed for the distributor's own view, where
  a single redistribute action can gift several different players within
  one trick. A `perspective: 'received' | 'distributed'` tag says which
  shape the viewer is looking at; `fromPlayer` is always the trick's
  actual redistributor (winner or delegate) regardless of perspective.
- **`host/mask.ts` builds both perspectives from `state.receivedLog`**:
  received-perspective entries are the same one-per-record mapping as
  before, just carrying real `cards` now instead of a count. A new
  `buildDistributedEntries()` scans every recipient's `receivedLog`
  entries for records where `fromPlayerId === forSlot`, skips the
  viewer's own key entirely (self-gifts are never in this list, per the
  GDD), and groups what's left first by `trickNumber` then by recipient -
  one distributed entry per trick, one group per recipient actually
  gifted that trick. Both sets are concatenated and sorted by
  `trickNumber` ascending; a given trick can only ever produce one or the
  other for a given viewer (a player is either that trick's redistributor
  or a recipient of it, never both), so no dedupe/merge step was needed.
- **`ui/renderGameView.ts`'s Redistribution Log panel is real**: replaces
  the placeholder text with one block per `redistributionLog` entry -
  "Trick N", then either "Received from {name}" + that trick's cards, or
  "You redistributed" + one "{recipient name} + their cards" row per
  group. Every name goes through `playerLabelFor` (Brief C) - real name
  or the absolute `Player N` fallback, never raw `P1`-`P4`. Cards render
  via the same `drawCardRow`/`CARD_DIMS_MINI`/`logCardStyle` the
  previous-trick log already uses - no new card-rendering path. Cards are
  always shown face-up here (no `maskedPlayFaces` masking needed): a
  viewer only ever sees cards they personally received or personally
  distributed, never another player's redistribution, so there's nothing
  to mask. Empty state ("No tricks resolved yet.") unchanged in spirit
  from the old placeholder's tone, just real now (checks
  `redistributionLog.length === 0` instead of always showing text).

## Key technical decisions

- **The whole panel is one centered column, not previous-trick-log's
  side-by-side label+cards layout** - discovered as a real layout bug
  during Playwright verification, not a stylistic preference. This
  panel's `text()` helper always centers on `(x, y)` regardless of the
  `align` hint passed to it (true for every text call in this file,
  including the previous-trick log's own name-label calls); that's
  invisible for previous-trick-log's short single-name labels at a fixed
  left-ish x, but this log's lines are full sentences ("Received from
  {name}", where `{name}` can run up to 20 characters per Brief B's cap)
  that clipped off the left edge of the canvas at the x I originally
  picked. Verified the fix by screenshotting a synthetic long-name case
  before and after - re-centering every line on `CENTER_X` fixed it for
  arbitrary name lengths without touching the shared `text()` helper
  (which every other panel in this file also depends on).
- **"You redistributed" is uniform for every `'distributed'` entry,
  including a delegate's** - the brief's own wording floated "You
  redistributed as delegate" as a possible alternate phrasing, but also
  said "no extra data needed to distinguish this." Read literally:
  `fromPlayer === yourSlot` is true whether the viewer won the trick
  directly (Single) or was chosen as a delegate after a Double, and
  nothing else in `MaskedState`/`RedistributionLogEntry` records which of
  those happened for a given historical trick - `state.redistribution`
  only ever describes the *current*, in-progress redistribution, not
  past ones. So there is genuinely no data to render "as delegate" from
  for a log entry, and the brief's own acceptance criteria only requires
  correct `fromPlayer` attribution and perspective-splitting, not that
  exact text - confirmed this reading rather than inventing a new field
  to track it, since scope said read-only against existing engine state.

## Open questions

None from this session - every ambiguity in the brief either had an
explicit, restated decision to follow (the `SeatLabel`/absolute-numbering
question doesn't apply here) or resolved cleanly by reading the brief's
own parenthetical closely (the delegate-wording note above).

## Known issues

- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`, pre-existing and unrelated to this
  brief's own cards, which are never masked by design here); no
  card-back art yet; Google Fonts fail to load in this dev sandbox's
  network environment (cosmetic fallback only); a live 2-device test is
  still needed to confirm a real second peer's name (verified for the
  host's own entries only, via a real Single Player smoke test in this
  session) appears correctly in another real player's log; the bottom
  HUD name tag can still wrap for a long real name (flagged in the
  previous brief, not addressed here - out of this brief's scope too).
- **Not verified through genuine multi-trick bot play** - reaching a
  real completed trick with a real redistribution (let alone a
  multi-recipient one, or specifically a delegated-Double case) via
  Playwright driving actual card taps proved unreliable in earlier
  sessions' attempts, so this session verified the rendering logic via a
  synthetic-`MaskedState` harness (deleted before finishing, per this
  engagement's established pattern) covering a `'received'` entry, a
  `'distributed'` entry with two different recipients grouped under one
  trick, and a blank-named fallback recipient - plus one real, live
  Single Player game confirming the real empty-state path end to end. No
  real distributed/received entries were confirmed via genuine gameplay
  in this session.
- **No scrolling/overflow handling for a long log**, per the brief's own
  "not addressed here unless it breaks layout outright" - a game running
  many tricks will eventually push entries below the visible canvas with
  no way to scroll to them. Not fixed, flagging per that same brief note
  rather than solving it.

## Next proposed step

A live multi-device pass (or a longer bot-driven playtest) to exercise
several real tricks - ideally including a Double win that gets
delegated - and confirm the log matches what genuine gameplay produces,
not just the synthetic cases checked this session. Beyond that: the
wireframe's "Show N recipients" collapse affordance (explicitly deferred
by this brief), log scrolling if entry count becomes a real problem, and
the same card-back-art/live-peer items carried over from earlier briefs.
