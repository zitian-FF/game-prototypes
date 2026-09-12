## Current milestone

Investigated the reported "cards received via another player's
redistribution render facedown with wrong z-order" bug. **Could not
reproduce it in extensive, real-gameplay testing** across every distinct
code path this event can take. No code changes were needed or made -
this session's diff against `main` is empty. Documenting the negative
result here per this repo's own rule (every session that touches a
prototype updates `BUILD_STATUS.md`), and because the investigation
itself surfaced a genuinely useful confirmation of how this path
actually behaves.

## What was investigated

Confirmed the task's own premise first: `prepareCollectAnimation` (`ui/
renderGameView.ts`) - the only place `ui.pendingHandCollectFaces` ever
gets populated - only ever fires its `isLocalCollector` branch when
`state.currentTurn === state.yourSlot` during the `redistribute` phase.
A passive recipient (a mere contributor who didn't win the trick and
isn't the delegate) never satisfies that condition, so this event
genuinely has **zero special-cased handling** - exactly as reported.
`host/mask.ts` also confirms `yourHand: state.players[forSlot].hand` is
never masked from its own owner - there is nothing hidden at the data
layer to reveal.

Given that, the question was whether the DEFAULT rendering path (no
special handling at all) produces a real defect, or whether it just
renders normally. Built a temporary forced-deal debug hook (`host/
gameHost.ts`, gated behind query params, fully reverted before this
commit - `git diff` against `main` is empty) to reach a real,
deterministic instance of a passive recipient receiving a redistribution
gift, and tested every structurally distinct variant:

- **Single win** (winner self-redistributes immediately): recipient's
  hand at 0 pre-existing cards, plus 2 and 3 pre-existing cards; the new
  card sorting after existing ones (same suit) and before them (a
  different, earlier `SUIT_CYCLE` suit, i.e. a genuine "insert not
  append" case).
- **Double win / delegate path** (the trick resolves into
  `chooseDelegate`, the WINNER'S chosen delegate - not the winner -
  collects and redistributes): same-suit and cross-suit gifts, verified
  with a second temporary override (`host/botAI.ts`'s `pickRandom`,
  also fully reverted) forcing bot choices deterministic so the delegate
  is reliably a third bot, never the winner or the recipient under
  test.

In every one of these real, live-gameplay scenarios: the received card
rendered immediately with its real composited face-up art, and in the
correct sorted position relative to any pre-existing hand cards - no
facedown card, no z-order defect.

One screenshot from the double-win/cross-suit case briefly looked like
it confirmed the bug (a card that looked like a plain card-back) - a
closer, zoomed-in pixel comparison against that same card's own
untouched appearance moments earlier in the same run showed it was
simply YogSothoth's real Numbered-card art (a dark, ornate,
atom/orbital-motif design that reads as "generic card back" at a
glance, at small screenshot scale). Flagging this explicitly since it's
exactly the kind of false positive this investigation was trying to
guard against - confirmed with a direct pixel-level side-by-side, not
assumed away.

Also traced the full render pipeline directly (temporary logging in
`presentGameView`/`prepareCollectAnimation`/`renderCardFan`'s
`drawEntry`, all reverted) for the double-win case specifically, since
its `pendingHoldMasked`/dwell-timer hold mechanism is structurally
different from the single-win path (a raw `renderGameView` call can
fire from a delayed timer, bypassing `presentGameView` entirely). Even
there, `collectFaces` stayed `null` and every `drawEntry` call logged
`face.kind=faceup` for the recipient's own hand, confirming the data
layer was never in question - only my own initial visual read of one
screenshot was.

## Key technical decisions

- Did not touch `handLegality.ts`, the Double-completion mechanic, or
  any action-button state - none of this session's investigation
  implicated them, and the task itself asked to leave them alone.
- Did not add a "nice reveal" animation for this event. The task was
  framed as a bug investigation ("two concrete symptoms... a real bug
  to investigate"), not a request for a new flourish - and per this
  repo's scope discipline, inventing new polish beyond what was asked
  isn't this task's job. If a flourish for this moment is wanted, it's
  a distinct follow-up (the existing collector-reveal flip in
  `pendingHandCollectFaces`/`playCardRevealFlip` is the natural pattern
  to reuse, per the task's own suggestion) - not something this
  investigation's findings require.
- Did not multiply out every remaining permutation (e.g. a recipient
  receiving 2+ cards simultaneously, from a Double they themselves
  played). Attempted it once; the forced multi-card-double click
  sequence didn't land reliably in Playwright and, given every variant
  tested so far behaves identically (per-card, independent of count -
  `renderCardFan` computes `face` per hand-array entry with no
  aggregate/count-based branching), didn't re-attempt further. Noting
  this as the one variant not directly exercised, for the record.

## Verification

- `npm run typecheck` and `npm run build` both pass with no errors (no
  code changes were made, so this just confirms `main` itself is
  clean).
- Real, live Single Player gameplay via Playwright across all the
  scenarios listed above - console clean throughout (only the known
  sandboxed asset-fetch noise present in every prior task this
  session).
- `git status`/`git diff` against `main`: empty. Every temporary debug
  hook (`gameHost.ts`'s forced deals, `botAI.ts`'s deterministic-choice
  override, and all tracing `console.log`s added to
  `renderGameView.ts`) was fully reverted before this commit.

## Open questions

**This is the one to flag explicitly**: the task described two concrete
symptoms ("stuck-facedown art *and* wrong z-order") as if already
observed firsthand, but this investigation could not reproduce either
across every code path this event can take. Possibilities, none
confirmed:
- The report was based on a screenshot/observation similar to the one
  false positive found here (YogSothoth's own dark card art
  misread as a card back) - in which case there may be no bug at all.
- It's specific to a real-multiplayer scenario this session's
  Single-Player-only testing can't reach (e.g. a human distributor
  taking a long, real-world pause before redistributing, during which
  the recipient's client renders other things - Rules modal, log,
  idle re-renders - in between).
- It's the one untested variant (2+ simultaneous cards from the
  recipient's own Double contribution).

Would help to get either a screen recording of the actual bug, or the
exact multiplayer steps that triggered it, before spending further
budget on speculative fixes for something that may not exist as
described.

## Known issues

None found. Known sandboxed asset-fetch console noise (unrelated host,
present since before this task) still appears on every boot in this
environment.

## Next proposed step

Get a concrete repro from the user (recording or exact multiplayer
steps) before touching this again. If one surfaces, the existing
collector-reveal flip (`pendingHandCollectFaces`/`playCardRevealFlip`)
is the natural mechanic to extend, per the task's own suggestion -
confirmed here to be reusable, since the underlying real-face data was
never the problem in every case actually reproducible this session.
