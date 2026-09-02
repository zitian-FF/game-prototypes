## Current milestone

Every in-game player-facing identity label now shows a real name (or the
absolute, seat-numbered `Player N` fallback) instead of the viewer-relative
`P1`-`P4` screen-position labels: the trick-in-progress/previous-trick log,
the delegate-selection targets, the "Waiting for..." status text, the
game-over god-reveal listing, and the DOM overlay's HUD name tags. Version
stamp counter unchanged (`8`), no deploy has run yet.

## What was implemented

- **`MaskedState` gained `seatNames`** (`net/actions.ts`): a
  `Partial<Record<NetPlayerId, string>>` of raw `displayName` values keyed
  by absolute seat, exactly as stored in the roster - may be `''`; the
  `Player N` fallback is computed at render time (mirroring Brief B's
  `lobbySeats.ts` pattern), never baked into the payload itself.
- **`buildMaskedState` takes a third `seatNames` parameter**
  (`host/mask.ts`), included verbatim in the returned object. Stays
  decoupled from the `Roster` type, same as every other field - the caller
  builds the lookup.
- **`HostGameScene` builds the lookup from its own roster**: a new private
  `seatNames()` method maps every roster entry's `slot` to its
  `displayName`, called once per `sendMaskedStateTo` (covers both the
  regular broadcast path and the reconnect-resend path, since both funnel
  through that one method).
- **New `playerLabelFor(state, id)` helper** (`ui/renderGameView.ts`,
  not `ui/seating.ts` - see "Key technical decisions"): returns the real
  name if non-empty (`.trim()`ed), else `Player ${absolute index}` (`p0`->1
  .. `p3`->4, from `fromNetPlayerId`, deliberately NOT `seatFor`/
  `seatLabelFor`'s viewer-relative geometry), with a `(You)` suffix when
  `id === state.yourSlot`.
- **Every `P1`-`P4` display site replaced**: the previous-trick log's row
  label, the game-over god-reveal listing, the "Waiting for..." status
  text, the delegate-selection target label (all `ui/renderGameView.ts`),
  and `computeGameOverlayHudState`'s `seatLabels` (which now looks up each
  geometric seat's occupying `NetPlayerId` via `buildSeatMap` and calls
  `playerLabelFor`, rather than a bare `seatLabelFor(seat)`). Geometry
  code itself (`seatFor`, `SeatPosition`, `computeSuitRing`, the Suit Cycle
  HUD rotation math, `buildSeatMap`) is untouched.
- **`ui/seating.ts`'s `SeatLabel` type, `seatLabelFor()`, and
  `LABEL_BY_SEAT` removed** - once every call site above was migrated,
  nothing referenced them any more (confirmed via a repo-wide grep before
  deleting); `P1`-`P4` no longer exists as visible text anywhere, matching
  the acceptance criteria, and the file's own doc comment now says so
  explicitly so it isn't reintroduced by accident.

## Key technical decisions

- **`playerLabelFor` lives in `ui/renderGameView.ts`, not `ui/seating.ts`**,
  even though the brief offered either. `seating.ts`'s own header comment
  describes it as "pure seat-geometry logic... deliberately kept free of
  any Phaser/DOM dependency" - identity/name display isn't geometry, and
  every call site that needs the helper is already in `renderGameView.ts`
  (the one exception, `computeGameOverlayHudState`'s `seatLabels`, is also
  in that file). Keeps `seating.ts` scoped to exactly what its own doc
  comment claims.
- **Absolute numbering (`fromNetPlayerId(id) + 1`), never `seatFor`'s
  viewer-relative offset** - this was the brief's own explicit, already-
  made decision (restated to avoid re-litigating it), and matters because
  the two systems return different numbers for the same seat depending on
  who's asking: `seatFor`'s P1-P4 depends on `yourSlot`, while `Player N`
  must be the same number for every viewer looking at the same blank-named
  seat (matching the Lobby's own `lobbySeats.ts` convention from Brief B).
- **`(You)` suffix is now uniform across every `playerLabelFor` call site**,
  including two (the previous-trick log row and the game-over reveal
  listing) that never showed it before this brief - the old
  `seatLabelForNet` had no `(You)` concept at all, only the separate HUD
  `seatLabels` loop special-cased `bottom`. The brief's own helper spec
  ("Append ' (You)' when `id === state.yourSlot`") makes this the helper's
  own uniform behavior rather than a per-site special case, so these two
  sites now also mark your own row - a small, intentional improvement
  (you can now tell which log/reveal row was yours), not a side effect to
  undo. The "Waiting for.../Delegate to..." sites are structurally
  unaffected (the active/delegate-target player is never `yourSlot` there
  already), so no visible change at those two.

## Open questions

None from this session - the brief's own numbering-system decision was
already made and just needed following precisely (see "Key technical
decisions" for the one place its wording could have been misread and
wasn't), and every display site named in scope had exactly one call site
to update, confirmed via grep before and after.

## Known issues

- **The bottom HUD name tag can wrap to two lines for a long real name**
  (e.g. a 20-character name plus " (You)") - verified visually in this
  session's real-game screenshot. The tag's fixed width (`208`, set by an
  earlier overlay-layout task) was sized for short fallback text like
  "Player 3 (You)"; this brief didn't touch that layout constant, since
  retuning DOM chrome dimensions is outside "wire real names into every
  display site." Flagging as a follow-up rather than fixing here - a
  smaller font at longer lengths, an ellipsis, or a wider tag are all
  reasonable fixes but weren't this brief's call to make silently.
- Carried over, still true, untouched: facedown-card masking leak at the
  payload level (`host/mask.ts`); no card-back art yet; Redistribution-log
  content still stubbed (Brief D's scope, which will consume this same
  `seatNames`/`playerLabelFor`); Google Fonts fail to load in this dev
  sandbox's network environment (cosmetic fallback only); a live 2-device
  test is still needed to confirm a real second peer's name (not just the
  host's own, already verified for real this session) reaches every other
  player's in-game screen identically.

## Next proposed step

Brief D's Redistribution-log content, now that `seatNames`/`playerLabelFor`
exist for it to consume. Optionally address the long-name HUD tag wrap
noted above. Beyond that: a live 2-device pass, and card-back art.
