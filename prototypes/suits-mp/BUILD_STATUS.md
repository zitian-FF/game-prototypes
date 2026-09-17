## Current milestone

Bot AI: trust modeling (`suits-mp-bot-ai-design.md` v5, Section 4).
Built the actual first step the doc's own Section 10 build order
skipped over - it assumes trust is "existing infrastructure" a later
step (Section 5.1-5.2) can just reuse, but a direct source search
confirmed no trust computation exists anywhere in `botAI.ts` yet. This
task builds it: trust formation, friendly/hostile labeling, and the
"a confirmed ally's specific Deity is known for free" mechanism -
exposed as a clean, pure, unconsumed utility for the next task to build
Section 5 on top of. Zero bot behavior changed (confirmed both
structurally, via the diff, and empirically, via a real simulation run
- see Verification).

## Investigation (task's step 1)

Confirmed exactly where the needed history already lives before
designing anything new: `GameState.receivedLog` (`rules/types.ts`) is
`Partial<Record<PlayerId, ReceivedRecord[]>>` - a cumulative,
per-recipient log of every redistribution a player has ever received,
each `ReceivedRecord` carrying `cardIds`, `fromPlayerId` (the
distributor), `trickNumber`, and `wonByDouble`. This is populated by
`rules/engine.ts`'s `redistribute()` on every single redistribution
event in the game, for every recipient, unconditionally - not something
that needs to be added or extended.

Crucially, this is the EXACT SAME field the real Redistribution Log UI
already reads for a human player: `host/mask.ts`'s
`buildDistributedEntries`/its `receivedByMe` block (around line 165)
reads `state.receivedLog[forSlot]` directly to build what a human
player legitimately sees about cards they've received. A bot reading
`state.receivedLog[slot]` for its own slot is using literally the same
data source, at the same trust boundary, as the already-shipped human
UI - not a new masking-sensitive channel.

This confirms the task's own instinct: trust is a DERIVED value,
computed fresh from this existing history on every call. No new
persistent state was added to `GameState`, and `chooseBotAction`'s
existing pure `(state, slot)` shape is completely untouched.

## What was implemented

**New file: `host/botTrust.ts`** (not yet imported by `botAI.ts` -
deliberately unconsumed, per this task's explicit scope):

- **`computeTrustScores(state, slot): ReadonlyMap<PlayerId, number>`**
  (design doc 4.2) - reads `state.receivedLog[slot]` and, for every
  individual card in every record (a record can hold more than one card
  if the bot's own contribution to that trick was a Double), adds +1 to
  that record's `fromPlayerId` if the card's god matches the bot's own
  god ("helped"), -1 otherwise. Missing entries (a seat that's never
  redistributed to this bot) simply aren't in the map - documented as
  "treat as 0," not "excluded," so callers don't accidentally skip an
  all-zero seat when picking a maximum.
- **`identifyFriendlyAlly(state, slot): FriendlyAlly | null`** (design
  doc 4.2 + 4.3) - the exact `{ friendlyPlayer, friendlyPlayerDeity } |
  null` shape the task asked for. Finds the other seat with the
  strictly-highest trust score; if that score reaches
  `FRIENDLY_TRUST_THRESHOLD` (currently `2`, an explicit placeholder -
  not yet empirically tuned, matching how the design doc treats other
  not-yet-tuned constants) and no other seat ties it, that seat is
  friendly. Otherwise returns `null`. The other two seats being hostile
  "by elimination" needs no separate field or computation - any
  `PlayerId` that isn't `slot` or the returned `friendlyPlayer` is
  hostile, for free.
- Re-evaluated fresh from current `state` on every call, never cached -
  matches Section 5.4's "live, ongoing" principle a task early, since a
  derived value costs nothing extra to keep uncached.

**Masking honesty, explicitly checked**: every function in
`botTrust.ts` reads only `state.players[slot]` (the bot's own seat) and
`state.receivedLog[slot]` (redistributions the bot's own seat was the
RECIPIENT of). Confirmed by reading the diff line by line - no other
player's hand, `receivedLog` entry, or hidden identity is read
anywhere. Trust is one-sided per design doc 4.1: nothing here compares
one bot's computed scores against another's, or reads any
cross-bot/shared state - each call is entirely self-contained to the
one `slot` passed in.

## A deliberate deviation from the task's literal 4.3 phrasing (flagged, not silently resolved)

The task's own restatement of 4.3 says a friendly player's Deity "is
the same suit that raised trust in them." Read completely literally,
this can't be correct for this game: the suit that raises trust in
seat Y (via `computeTrustScores`) is, by definition, always the
OBSERVING bot's OWN needed suit (that's what "helped" means) - and
every seat's god is necessarily distinct from every other seat's, so
the suit that raised MY trust can never equal Y's actual needed suit
(worked through with a concrete example: if my god is Cthulhu, my
trust rises when someone gives me Cthulhu cards - but my real ally's
god is fixed at Nyarlathotep per `rules/cards.ts`'s `TEAMMATE_GOD`
pairing, never Cthulhu; claiming otherwise would hand the next task
exactly the wrong Deity to route cards toward).

What actually satisfies the design doc's stated INTENT ("already known
for free," "no separate inference step," "no masking violation," "no
new card-counting infrastructure") is `TEAMMATE_GOD[state.players[slot]
.god]` - the game's own fixed team-pairing lookup. This isn't a new
inference at all: it's the EXACT SAME fact the real UI already shows
every human player about their own teammate's needed suit/colour (see
`ui/renderGameView.ts`'s existing `TEAMMATE_GOD[state.yourGod]` HUD
use) - never their identity, which is exactly what trust (4.2) newly
supplies. `identifyFriendlyAlly` implements this reading; the doc
comment above it in `botTrust.ts` spells out the same reasoning inline.
Flagged here explicitly rather than silently picked, since this
directly shapes an API contract "the next task will consume."

## Verification

`npm run typecheck` and `npm run build` both pass cleanly.

**Structural proof that no bot behavior changed**: `git diff --stat`
shows exactly one new, currently-unimported file (`host/botTrust.ts`)
and a purely additive change to `scripts/simulate.ts` (59 insertions, 0
deletions - new logging only). `host/botAI.ts` - the only file that
could route trust into an actual decision - has a **zero-line diff**,
confirmed directly (`git diff prototypes/suits-mp/src/host/botAI.ts` is
empty). Nothing new is called from any decision path.

**Real simulation run** (`npm run simulate -- --games=500`, extended for
this task with a verification-only `allyGuesses` field per game -
computed from each game's FINAL state, one guess per seat, entirely
after-the-fact and read-only; never influences the actual game):

```json
{
  "trickCount": { "min": 7, "max": 40, "average": 20.744, "median": 20 },
  "winRateByTeam": { "Chaos": 0.444, "Cosmos": 0.426 },
  "stalemateRate": 0.13,
  "doubleWinTrickShare": 0.1584,
  "allyGuessAccuracy": {
    "totalPlayerGames": 2000,
    "confidentGuesses": 403,
    "correctGuesses": 135,
    "confidentGuessRate": 0.2015,
    "accuracyAmongConfidentGuesses": 0.335
  }
}
```

Trick-count/win-rate/stalemate numbers land in the same range as the
previous task's own 500-game "after" run (median 20, mean 20.342, max
40, stalemate 9.4%) - the two runs use identical, unmodified decision
code with fresh randomness each time, so this level of run-to-run
variance is expected and itself corroborates that nothing behavior-
affecting changed, on top of the structural diff proof above.

**Mechanism correctness, spot-checked by hand**: picked a real game
with a confident guess (game 1, player 0/Nyarlathotep guessed player 2
friendly with deity Cthulhu) and independently recomputed
`computeTrustScores` from that game's raw logged `redistributions`
array (summing +1/-1 per received card by hand, in a separate script) -
got distributor scores `{1: -3, 2: +2, 3: -7}`, exactly matching the
logged guess (`friendlyPlayer: 2`, crossing the threshold of 2;
`friendlyPlayerDeity: Cthulhu`, matching `TEAMMATE_GOD.Nyarlathotep`).
The guess happened to be WRONG in this instance (the real teammate was
player 1, not player 2) - and that's expected, not a bug: see below.

**Honest result, exactly as anticipated by the investigation above**:
overall accuracy among confident guesses is 33.5% - statistically
indistinguishable from picking one of the 3 other seats at random
(1/3 ≈ 33.3%). This is not a defect in this task's implementation.
Nothing in the current game currently makes redistribution correlate
with real team membership at all - Tier A's redistribution logic
(`chooseRedistributeAction`) decides self/other holdback based only on
the DISTRIBUTOR's own suit, with zero regard for which specific other
player receives which giveaway card. So "who happens to give me my
needed suit" is, today, pure noise relative to who's actually my ally -
exactly the gap Section 5 (deliberately NOT built in this task) exists
to close, by making an Assist bot's redistribution choices actually
route needed cards toward a confirmed ally. The trust MECHANISM itself
is verified correct (per the hand-recomputation above); its accuracy is
expected to improve materially only once Section 5 gives it real signal
to work with, and that improvement needs to be measured then, not
assumed now.

## Key technical decisions

- Kept trust computation in its own new file (`host/botTrust.ts`)
  rather than adding it into `botAI.ts` directly - `botAI.ts` is the
  action-choice module; trust is a separate, reusable analysis this
  task's own scope (and the next task, and personality parameterization
  after that) all need independently.
- `FRIENDLY_TRUST_THRESHOLD = 2` is an explicit, documented placeholder,
  not a derived-from-anything value - there's no principled way to pick
  this without real simulation data once Section 5 exists to give the
  signal actual meaning, so it's deliberately left simple and flagged
  for future tuning rather than over-engineered now.
- `identifyFriendlyAlly` returns `null` on a tie at the maximum score,
  rather than picking arbitrarily - the game's fixed 2v2 elimination
  logic assumes exactly one relationship becomes confident before the
  other two follow "by elimination"; a tie means the evidence isn't
  there yet, and returning null (not a coin-flip) keeps the "always
  known for free once identified" promise from ever assigning a value
  it isn't actually confident in yet.
- `scripts/simulate.ts`'s new `allyGuesses`/`allyGuessAccuracy` logging
  deliberately grades the bot's guess against ground truth the SIMULATION
  SCRIPT already has full access to (as a dev analysis tool), while the
  bot's own call into `identifyFriendlyAlly(state, slot)` remains exactly
  as masking-honest as it would be for a real decision - the grading is
  external analysis, not something the bot itself sees.

## What's general vs. specific

**General, reusable as-is:** `botTrust.ts`'s whole module - the next
task (Section 5.1-5.2) is expected to import `identifyFriendlyAlly`
directly, exactly as designed. `scripts/simulate.ts`'s
`allyGuesses`/`allyGuessAccuracy` fields will keep working unmodified
once Section 5 starts actually acting on trust - the accuracy number
computed here is exactly the metric that should rise once that lands,
with no changes needed to this verification logging itself.

**Specific to this task:** the `FRIENDLY_TRUST_THRESHOLD` placeholder
value and the specific `TEAMMATE_GOD`-based reasoning for 4.3 (see the
deviation section above) are both flagged as likely candidates for
revisiting once Section 5 provides real data to tune against.

## Open questions

The 4.3 "same suit" phrasing discrepancy (see above) is exactly the
kind of thing worth flagging per CLAUDE.md's guidance: **the design
doc itself may be worth a follow-up correction pass** - not just this
task's own code comment - since the literal text, if implemented as
written, would hand Section 5 a systematically wrong Deity for every
identified ally. This wasn't asked mid-session because a technically
sound, well-precedented alternative (`TEAMMATE_GOD`) was available and
implemented directly rather than blocking on it, but the doc's next
reader should know the "same suit" wording doesn't hold up.

## Known issues

None in the shipped code. The near-chance ally-guess accuracy is a
real, expected, and now-measured fact about the CURRENT game (see
Verification) - not a defect, and explicitly the problem Section 5 is
designed to fix next.

## Next proposed step

Per the design doc's own Section 10 (now correctly ordered, with this
task providing the trust infrastructure it assumed already existed):
Section 5.1-5.2 - redistribution priority and repurposed trick control
once a bot's own hand composition puts it in the Assist role, built
directly on `identifyFriendlyAlly`. Re-run the simulation tool
afterward and watch two things specifically: whether
`allyGuessAccuracy` actually rises now that redistribution has real
ally-favoring signal to learn from, and whether the stalemate rate
(currently ~9-13% across recent runs) actually falls, which is the
whole reason this system exists per the design doc's own Section 0
motivation.
