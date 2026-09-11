## Current milestone

Full plain-language terminology pass across the lobby/menu DOM flow
(Landing, Lobby, Join, Joining, Reconnecting, Waiting, Host
Disconnected, and all 5 error states), reconciling copy against the
GDD's new "UI Copy Rules" section, which discards 8 previously-used
thematic terms (Circle, Sigil, Thread, Passage, Rite, Thrall, Deal,
Wanderer) as alternate names for canonical concepts. This is a full
reversal of the archaic/thematic flavor language on these screens, not
a refinement - every listed string was changed verbatim to the new
canon, plus a codebase-wide sweep for any other player-facing instance
of the 8 discarded terms.

## What was implemented

### Landing

| Before | After |
|---|---|
| "Four seats · one deal" subtitle shown under the logo | Subtitle removed entirely - the logo art (`logo_suits_of_madness`) already has "SUITS OF MADNESS" baked into its own art, so the separate subtitle was pure duplication once the GDD called for only the logo's own text |
| "Thy name (optional)" | "Player Name (optional)" |
| placeholder "Nameless wanderer" | placeholder "Player" |
| "Open a Circle" | "Create Room" |
| "Enter a Circle" hint "Join · with a five-mark sigil" | "Join Room" hint "Join · with a five-character code" |
| "Four must sit before the deal." | "Four players are needed to begin." |
| "Single Player (play with bots)" | "Single Player" |

### Lobby (host view)

| Before | After |
|---|---|
| Subtitle "The circle gathers" | "Waiting for Players" |
| "Sigil of the circle" (room-code panel label) | "Room Code" |
| "◫ Copy sigil" | "◫ Copy Code" |
| "✦ Bind a thrall" | "Add Bot" (glyph dropped per GDD's plain canonical copy) |
| "Release" (bot removal) | "Remove Bot" |
| "Begin the Rite" | "Start Game" |

### Join

| Before | After |
|---|---|
| Subtitle "Enter the sigil" | "Join a Room" |
| "Speak the five marks given thee." | "Enter the five-character Room Code provided by the Host." |
| No field label above the code input | Added "Room Code" label |
| Code hint "The sigil is whole" / "N marks remain" | "Room Code complete" / "N characters remain" |
| Submit button "Enter" | "Join Room" |

### Joining (busy state)

| Before | After |
|---|---|
| Title/subtitle "Crossing over" | "Joining Room" |
| "Announcing thyself to the circle and opening the passage." | "Connecting to the Room…" |
| "Sever the thread" | "Cancel" |

### Reconnecting (busy state)

| Before | After |
|---|---|
| Title/subtitle "Holding the thread" | "Reconnecting" |
| "The link faltered. Waiting a moment before we call the circle again." | "The connection was interrupted. Trying to reconnect…" |
| "Sever the thread" | "Leave Room" |

**Behavior check (not just a label change):** confirmed and left as-is -
the busy screen's cancel button (`data-ui="cancel-busy-button"`) already
calls the same `onBack` handler for both `joining` and `reconnecting`,
and for the one reachable path (`joining`, via `ConnectingScene.ts`)
that handler already does `room.leave()` then
`this.scene.start('Landing', ...)`, i.e. it already permanently exits
to Landing exactly as the GDD specifies for "Leave Room." See "Known
issues" below for why `reconnecting` itself couldn't be live-tested.

### Waiting (post-join, pre-start)

| Before | After |
|---|---|
| Title "Thou art seated" | "Waiting for Players" (intentionally identical to the Lobby subtitle above - both mean "waiting for the game to start," from the host's vs. a joined peer's own perspective) |
| "Waiting for the host to gather the rest and begin the rite." | "Waiting for the Host to start the Game." |

### Host Disconnected (Waiting screen sub-state)

| Before | After |
|---|---|
| Title "The host has vanished" | "Host Disconnected" |
| "The circle has been severed. This session has ended." | "The Room has closed because the Host left." |
| No action button at all | Added "Return to Main Menu" button |

**Behavior fix (not just a label/addition):** this state previously had
*no* button whatsoever. Added one wired to a real, working `onBack`
handler: `showWaiting()` (`lobbyUiStore.ts`) now takes an `onBack`
parameter instead of always defaulting to a permanent no-op, and
`PlayerLobbyScene.ts` now passes a real handler that leaves the room
and transitions to `Landing` (mirroring `ConnectingScene.ts`'s own
`toLanding` pattern). Since `PlayerSessionData` doesn't carry the
memoized `getIceServers` closure `main.ts` built for the original boot,
this handler builds a fresh one via `fetchTurnIceServers()` directly -
a harmless one-time redundant TURN fetch on this rare, cold "leave"
path.

### Error states (all 5)

The shared subtitle (previously "Turned away" on every error screen)
is now omitted entirely - removed from rendering, not just relabeled
(see `LobbyFlow.tsx`'s masthead, which now skips the subtitle
line for any error screen).

| Kind | Before (title / primary / detail) | After |
|---|---|---|
| notFound | "No such circle" / "Speak the sigil anew" / "Those five marks answer to nothing. The sigil may be mistyped, or the circle has since closed." | "Room Not Found" / "Enter Code Again" / "Check the Room Code and try again. The Room may also have closed." |
| connFailed | "The thread will not hold" / "Attempt the passage again" / "Direct and relayed passages were both refused. A firewall or strict network may stand between you." | "Connection Failed" / "Try Again" / "We couldn't connect to the Room. Check your internet connection or network settings, then try again." |
| timeout | "Silence answered" / "Call once more" / "The circle did not reply in time. It may have gone quiet, or the host must re-announce the sigil." | "Room Did Not Respond" / "Try Again" / "The Room did not respond in time. Ask the Host to refresh the code, then try again." |
| roomFull | "All four seats are taken" / "Watch for a vacancy" / "This circle is complete. Ask the host to release a thrall, or wait for a seat to empty." | "Room Full" / "Try Again" / "All four seats are occupied. Wait for a Player or Bot to leave before trying again." |
| inProgress | "The rite is under way" / "Try the sigil again" / "Cards are already dealt in this circle. Only a player rejoining their own seat may enter now." | "Game Already Started" / "Enter Another Code" / "This Room's Game has already started. Only Players reconnecting to their existing seat can join." |

Per-error visual styling (glyph, accent, border, bg, inner colors) and
the internal `tag` field (e.g. "ERR · ROOM_NOT_FOUND") are unchanged -
only the three canonical text fields per error were touched, per spec.

### Full-codebase sweep: additional instances found and fixed

Beyond the screens explicitly listed above, searching the entire
codebase (case-insensitive) for the 8 discarded terms as player-facing
text turned up:

- `lobbySeats.ts`: bot seat display name `'Thrall of the Deep'` → `'Bot'`.
- `MenuModal.tsx`: menu button `"The Rites"` → `"Rules"`.
- `RulesModal.tsx`: modal heading `"The Rites"` → `"Rules"`; close-button
  `aria-label="Close the rites"` → `"Close rules"`; closing flourish
  `"✦ Here the rites end ✦"` → `"✦ End of rules ✦"`.
- `loadingProgress.ts`: asset-load failure text `'Something in the
  ritual circle failed to load...'` → `'Something failed to load...'`.

One additional sweep-found instance - two uses of "rite" in
`rulesContent.ts`'s own rules-popup body text (the "No trick limit"
section) - was investigated and a fix was drafted, but is **not**
included in this PR: a separate, later task in this same session
(`proto/suits-mp/rules-popup-accuracy`) explicitly reconciles that same
rules-popup content against the current GDD and intentionally restores
that exact archaic "rite" wording as part of the popup's deliberately-
preserved narrative voice (distinct from this plain-language lobby-chrome
pass). Shipping the fix here would have just been immediately undone by
that PR, so `rulesContent.ts` is untouched in this PR and the "rite"
wording there is addressed by that other PR instead.

Not changed (thematically similar, but contain none of the 8 literal
banned words, so out of strict scope per this task):

- "Copy summons" button (paired with the fixed "Copy Code" button,
  which now reads slightly inconsistently next to it)
- "Re-announce" (lobby room-code refresh button)
- "← Turn back" (Join screen back-link)
- "Return to the threshold" (error screen secondary button)
- Seat role labels: "Host · thee", "Bot · bound by the host", "Awaiting
  a soul" (lobbySeats.ts)

None of these contain a literal instance of Circle/Sigil/Thread/
Passage/Rite/Thrall/Deal/Wanderer, so left as-is rather than over-
reaching into a broader "modernize all archaic phrasing" rewrite the
task didn't ask for.

Also fixed, not in the task's own explicit list but caught by the
sweep (contained "circle"): the Waiting screen's shared subtitle
("Bound to the circle" → "Waiting for Players", matching the parallel
already established with the Lobby masthead). Minor resulting tension:
this same subtitle is unchanged by `hostLeft`, so it still reads
"Waiting for Players" directly above the "Host Disconnected" title/body
in that sub-state - a small oddity, not fixed further since the task
didn't ask for a `hostLeft`-conditional subtitle.

Confirmed genuinely out of scope (real game terms, or a different
concept entirely, not this discarded lobby-flavor language):

- "deal"/"dealt" in `rules/types.ts` and `net/actions.ts` - the actual
  card-dealing mechanic, unrelated to the discarded flavor term.
- "circle"/"Sigil" in `renderGameView.ts`, `godArt.ts`,
  `RedistLogModal.tsx`, `GameOverlay.tsx`/`.css` - all either code
  identifiers (`GOD_MOTIF: 'hex'|'circle'`), CSS values
  (`radial-gradient(circle, ...)`), or comments about the tabletop
  background art's own baked-in circular design motif - a real visual
  design element, not the lobby-flow UI-copy term.

## Key technical decisions

- `SUBTITLES: Record<Screen, string>` kept as a total map with empty-
  string entries for `landing` and the 5 error kinds (rather than made
  partial), so no optionality needs threading through every reader;
  each empty entry carries a comment explaining why.
- The masthead subtitle's render is now gated on
  `screen !== 'landing' && !isErrorKind(screen)`, reusing the existing
  `isErrorKind` type guard rather than adding a new one.
- `showWaiting()` gained a required `onBack: () => void` parameter
  (previously took none, always leaving `onBack` as a permanent no-op)
  so the new Host Disconnected "Return to Main Menu" button has a real
  handler. `PlayerLobbyScene.ts` builds this handler with a fresh
  (non-memoized) `fetchTurnIceServers()` import rather than trying to
  thread `main.ts`'s memoized closure through `PlayerSessionData`
  (which doesn't carry `getIceServers` at all - only `BootData` does) -
  acceptable since this is a rare, cold path.

## Open questions

None - this task's scope (which strings to change) was fully specified
by the GDD's new UI Copy Rules section and the task's own itemized
list; no ambiguity required asking the user mid-session.

## Known issues

- `screen: 'reconnecting'` is confirmed **unreachable/dead code** in
  the current build - no scene or store function anywhere ever sets
  this screen value (verified via exhaustive grep for
  `screen:\s*'reconnecting'` and `showReconnect`-style call sites
  across `src/`). Its copy was updated per the task's spec, and its
  button correctly shares the same `onClick={onBack}` handler/JSX as
  the reachable `joining` busy state - but since no live path exists to
  reach `screen: 'reconnecting'` today, the "Leave Room" label and its
  behavior could only be verified end-to-end for `joining`'s "Cancel"
  path (confirmed via Playwright: clicking it fires the same `onBack`
  handler, which does `room.leave()` + `scene.start('Landing', ...)`).
  Flagging this as worth a BRIEF.md note: is `reconnecting` intended to
  become reachable in a future networking task, or should it be
  removed as dead code?

## Next proposed step

Land `proto/suits-mp/rules-popup-accuracy` (already implemented in this
same session, separate PR) which reconciles the Rules popup's own
content against the GDD, including the "rite" wording noted above.
