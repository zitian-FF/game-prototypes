## Current milestone

Stage 3c (continued): the pre-game Landing screen is now real DOM
content too, alongside the Rules overlay from the previous session -
both are Claude Design handoffs implemented as React components over
the Phaser canvas, per root CLAUDE.md's "UI implementation split."
Redistribution-log content is Stage 3c's remaining piece, still stubbed.
This session's Lobby work is placeholder-data only by explicit brief:
real networking wiring (actual room codes, roster, join validation) is
deferred to a future task - see "Key technical decisions" and "Next
proposed step." Version stamp counter is at 8 (`version.json`) -
unchanged, no deploy has run yet.

## What was implemented

- Ported the Claude Design handoff `Suit of Madness Lobby.dc.html` (one
  component covering the whole pre-game flow as internal states:
  Landing with Host/Join buttons, Host Lobby with a room-code panel and
  4-seat list, Join with a 5-character code entry, a Busy/spinner screen
  for joining/reconnecting, and 5 error variants) as `src/dom/lobby/
  LobbyFlow.tsx`, matching the source pixel-for-pixel (same approach as
  the Rules modal: bespoke gradients/oklch/clip-path values as inline
  styles, `:hover`/`:active` states and keyframes in a companion
  `LobbyFlow.css`). Data/copy split into `lobbyContent.ts` (error
  copy/palette, subtitles, the code alphabet) and `lobbySeats.ts` (the
  seat-row view-model builder). The design's own "dev state rail" (an
  explicit design-tool-only affordance for previewing every screen) was
  dropped, not reproduced.
- `LandingScene.ts` no longer draws any Phaser text/buttons - it now
  just shows/hides `LobbyFlow` via a new `dom/lobby/lobbyUiStore.ts`
  (mirrors `dom/domUiStore.ts`'s bridge pattern from the Rules session)
  and keeps its version-stamp/portrait-guard/camera setup. Found and
  fixed along the way: Phaser doesn't auto-invoke a `shutdown()` method
  on `Scene` subclasses (only `Systems#shutdown`, which fires a
  `SHUTDOWN` event) - `LandingScene` now listens for that event
  explicitly to call `hideLanding()`, otherwise the DOM Landing view
  would stay mounted (and pointer-events-capturing) over every later
  scene.
- `DomRoot.tsx` now renders both the Rules modal and the Lobby flow as
  independent siblings, each driven by its own visibility store; at most
  one is ever visible in practice since only one Phaser scene runs at a
  time.

## Key technical decisions

- **Host/Join stay inside `LobbyFlow`'s own placeholder state, not
  wired to the real `HostLobbyScene`/`JoinEntryScene`/`ConnectingScene`.**
  This was a genuine tension worth recording: the user's own preview
  text when scoping this task described Host/Join calling "the same
  `scene.start(...)` transitions HostLobbyScene/JoinEntryScene currently
  trigger," but the brief's explicit text elsewhere was equally clear -
  "use placeholder data," "actual networking wiring is a separate future
  task, not part of this one." Wiring Host/Join to the real scenes would
  have made the new Host-Lobby/Join/Busy/Error screens this task asked
  for immediately unreachable (those old scenes still render their own
  Stage-1 monospace UI, unchanged) - i.e. most of the design file would
  ship as dead code. Reconciled by keeping the *whole* `LobbyFlow`
  self-contained (a faithful port of the design's own demo state
  machine: fill/release placeholder bot seats, generate a placeholder
  room code, validate a placeholder join code, etc.), so every screen in
  the handoff is genuinely reachable and screenshot-verified. The real,
  already-working `HostLobbyScene`/`JoinEntryScene`/`ConnectingScene`/
  `PlayerLobbyScene` are untouched and intact, just currently
  unreachable from the new Landing flow until a future task rewires
  `LobbyFlow`'s callbacks (or replaces those scenes' own rendering with
  it, the way this session did for Landing) - flagged here rather than
  guessed silently; see Open questions.
- **Single Player is the one real (non-placeholder) hook**, per explicit
  user direction: it's the only pre-game action that never touches
  networking (`LandingScene.startSinglePlayer`, unchanged), so faking it
  would have added risk for no reason. `LobbyFlow` takes it as a required
  `onSinglePlayer` prop rather than an internal placeholder action.
- **"Begin the Rite" is a verbatim port of the design's own stub**
  (`() => { if (canStart) this.set("landing"); }` in the source) - it
  just returns to Landing once all 4 placeholder seats are filled. Not
  invented; the design itself never wires this to anything real either.
- Dropped the `lobbyFull` screen key the source used only for its dev
  rail (to preview a pre-filled 4/4 seat list) - naturally filling all 4
  placeholder seats via "Bind a thrall" already renders the identical
  visual result through the ordinary `lobby` screen, so the extra key
  was redundant once the dev rail itself was dropped.
- The error/reconnecting screens have no real click path in the shipped
  app - the design itself only reached them via its dev rail, not real
  end-user navigation. Implemented in full anyway (the brief asked for
  the whole file) and verified visually via `LobbyFlow`'s `initialScreen`
  prop (added for exactly this: future real-state binding, or testing)
  through a throwaway local harness, not shipped in the app.

## Open questions

- The Host/Join real-vs-placeholder tension above was resolved in favor
  of keeping the whole design file's screens reachable, per the brief's
  explicit "placeholder data"/"networking wiring is separate" language -
  but this reads differently from what was approved when scoping the
  task (Host/Join calling the real scene transitions). Flagging this
  explicitly rather than silently picking one reading: if real
  navigation to `HostLobbyScene`/`JoinEntryScene` was actually wanted
  *now*, that's a small follow-up (swap `LobbyFlow`'s internal `goHost`/
  `go('join')` calls for `onHost`/`onJoin` props calling
  `scene.start(...)`, same shape as `onSinglePlayer`).
- No other outstanding questions from this session.

## Known issues

- Google Fonts fail to load in this dev sandbox's network environment
  (carried over from the Rules session, same fonts) - cosmetic fallback
  to `serif`/`Georgia`, not a code defect.
- Carried over from Stage 3a/the Rules session, still true, untouched:
  facedown-card masking leak at the payload level (`host/mask.ts`); not
  live-verified against real human peers (masking, turn rotation,
  redistribution/delegate flow, reconnect, room-code refresh); the
  off-suit double-selection fan and `selectDelegate` phase are logic-
  verified but not pixel-verified live; the TURN worker fetch's
  swallowed console error in the dev sandbox.

## Next proposed step

The real networking-wiring follow-up flagged above: decide whether
Host/Join should navigate to the real `HostLobbyScene`/`JoinEntryScene`
now (small prop-swap change) or whether those scenes themselves should
eventually be re-skinned with `LobbyFlow`'s Host-Lobby/Join/Busy/Error
screens fed real data (larger change, same pattern as this session's
Landing replacement) - either resolves the placeholder/real split
recorded above. Otherwise, Redistribution-log content remains Stage 3c's
last stubbed piece, and the carried-over Known issues (real fix for the
facedown-card masking leak, a user phone/live pass for real-peer
masking/reconnect and double-win/off-suit-selection rendering) still
stand.
