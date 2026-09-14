## Current milestone

Tutorial Scene 4: Powered Deity Cards. A new forced trick (black-out/in
cut, not a continuation of Scene 3's unfinished one) that keeps the
same narrative lineage - same local Cthulhu hand, same ally - but is
the tutorial's first deliberate exception to "the player always acts":
three scripted plays resolve entirely unattended, watched via the real
card-play travel animation, before the player's own guided turn.

## What was implemented

**Scene 4's script (`tutorial/tutorialScenes.ts`):** `TUTORIAL_SCENE_4`
reuses the same `leaderId: 1` shape Scene 1 established (local player
last to act, `turnOrder(1) = [1,2,3,0]`), with `trickNumber: 4`
continuing the narrative and sidestepping `isForcedTrick1Opener`, same
as every prior scene's own non-1 trick number. Three `auto` steps
(ShubNiggurath-4, Nyarlathotep-6, YogSothoth-**10**) play out
unattended at 900ms delays each - the one deliberate change from Scene
1's own deal is swapping YogSothoth-8 for YogSothoth-**10**, still a
real, suit-matching single (visible, not masked facedown) per the same
Suit Cycle math, but landing a genuine rank-10 card as the last
scripted play before the local player's own turn.

The local player's hand is only 4 cards this time (Cthulhu-2, 5, 9,
DeityCard - no Cthulhu-10): this scene's own real 10 belongs to
YogSothoth instead, so the local player's own Cthulhu-10 has no role
here and would only sit as a distraction. `rules/engine.ts`'s
`computeDeityCardState` checks for *any* rank-10 card among the
trick's prior plays regardless of which god it belongs to - a
YogSothoth-10 powers a Cthulhu Deity Card exactly the same as a
Cthulhu-10 would.

One `TutorialWaitStep` follows the three auto plays: `lesson` covers
both the transformation ("now Powered... beats it") and the correct
next action ("play it to win") in the same step, mirroring Scene 3's
precedent that a single wait step can carry both a "watch this happen"
beat and a "now act on it" beat - there's no separate non-interactive
pause step in the type system, and none was needed. The correct action
(playing the now-Powered Deity Card) is hard-locked via the existing
`{ kind: 'handCard' }` lock/pointer and `applyTutorialLock` - no new
`TutorialLock` variant needed, exactly as the task anticipated.

The scene ends once the trick is won - no redistribution scripted,
mirroring Scene 3's own precedent of ending once the specific concept
(here, a real Powered-rank win) is conveyed. `TutorialScene.finishScene()`
needed no changes to pick this up.

## Confirmed real, not assumed: the Awakened reveal and the travel animation

Per this task's own explicit ask (report, don't assume), both were
verified via real-gameplay Playwright runs against the actual game
state, not just reasoned through:

- **The three auto-plays genuinely animate.** Added a temporary debug
  counter inside `animateCardPlayIntoPlayArea`'s existing tween
  (incremented when a travel tween starts, decremented on its
  `onComplete`), removed before commit. Polling it every 120ms across
  the whole watch sequence caught it at `1` (a tween actively in
  flight) on real samples - the card is genuinely mid-arc between its
  remote-nameplate origin and its play-area destination over
  `tune.cardPlayTravelMs` (190ms), never placed instantly.
- **The Awakened reveal on the local player's own Dormant Deity Card
  fires off real game state, with no new hook.** `ui/renderGameView.ts`'s
  `renderCardFan` already runs a client-side "Awakened preview" check
  on every render (`tenAlreadyPlayed` - any rank-10 card anywhere in
  `state.currentTrick`, regardless of suit) that swaps a still-unplayed
  Deity Card's art to its Powered look and fires `cardArt.ts`'s real
  `playAwakenedEffect` the instant the condition first becomes true.
  Confirmed via a temporary debug hook exposing `ui.awakenedHandCardIds`:
  it contained `Cthulhu-DeityCard` at the wait step, and a screenshot
  taken right as the wait step appeared shows the Deity Card already
  wearing its distinct Powered artwork in the fan, clearly different
  from the three plain Cthulhu cards beside it. **No tutorial-specific
  timing adjustment was needed anywhere** - the existing 900ms
  auto-step delay already gives the travel animation (190ms) generous
  headroom, and since the wait step that follows has no time limit of
  its own (it simply waits for the player, however long that takes),
  the reveal has as long as the player wants to actually look at it.

Both debug hooks (the in-flight tween counter and the exposed
`awakenedHandCardIds` array) were temporary, added only for this
verification and fully removed before commit - no trace of them
remains in the shipped diff.

## Key technical decisions

- Deliberately dropped Cthulhu-10 from the local player's hand for
  this scene (unlike Scenes 1-2's 5-card hand). Keeping it would have
  either sat as an unplayed distraction or, worse, been mistakable for
  *this* scene's own "the 10" - the rank-10 card doing the real work
  here is YogSothoth's, played by someone else, which is also what
  makes the "any suit's 10 powers any Deity Card" rule legible rather
  than accidentally suggesting the trigger is suit-specific.
- Landed the scripted 10 as the *third* (last) auto-play, immediately
  before the local player's own turn, rather than earlier in the
  sequence - the reveal then has zero time pressure once it fires,
  since the very next thing that happens is the wait step, not another
  auto-play's own countdown.
- Kept the "watch it transform" and "now act on it" beats as one wait
  step rather than inventing a new non-interactive pause step kind -
  same reasoning as Scene 3's own precedent, and it worked identically
  well here: the lesson banner explains the transformation, the guide
  pointer/hard-lock highlight the one correct card, and the Awakened
  visual burst itself is what actually draws the eye to "look here" -
  nothing about that needs to be a separate, blocking beat.

## Bugs found and fixed during verification

None. Every real behavior (hard-lock, travel animation, Awakened
reveal, rank comparison at trick resolution) worked correctly on the
first real-gameplay pass - this scene needed no infrastructure changes
at all, only new authored content.

## What's general vs. Scene-4-specific (for a later scene)

**General, reusable as-is (confirmed, not just assumed):**
- The real card-play travel animation and the Awakened reveal effect
  both already fire correctly for any number of consecutive `auto`
  steps ahead of a `wait` step - Scenes 1-2 already exercised 3-4 auto
  steps in a row, and this task's own verification confirms the
  visuals riding along with them (travel animation, Awakened preview)
  need no tutorial-specific plumbing regardless of how many `auto`
  steps precede a `wait`.
- `finishScene()`'s advance-or-fallback logic, the `syncPendingWaitForCurrentStep`/
  `scheduleNextIfAuto` sequencing, and the `{ kind: 'handCard' }`
  lock/pointer/`applyTutorialLock` path all needed zero changes again -
  the fourth scene in a row to confirm this same core machinery is
  fully general.

**Scene-4-specific, won't transfer as-is:**
- `TUTORIAL_SCENE_4`'s own deal (the specific YogSothoth-10 substitution,
  the 4-card local hand) is this scene's exact authored content.
- The still-reserved `delegateTo` lock / plain `seat` pointer variants
  remain untouched - Scene 6 (Double, delegate, and winning the game)
  is the design doc's own next place those would actually get used.

## Open questions

None arose that needed asking - the task's own hard constraints (local
player last to act, their own Dormant Deity Card in hand, a real 10
landing before their turn via three `auto` steps) fully specified the
deal's shape; only the exact card/rank choices needed authoring.

## Known issues

None. Verified via `npm run typecheck`, `npm run build`, and
real-gameplay Playwright runs on the final build: the three auto-plays
genuinely animate (confirmed via the temporary in-flight tween
counter, not just visual impression), the real Awakened effect fires
on the local player's own card at the correct moment (confirmed via
the temporary `awakenedHandCardIds` exposure plus a screenshot showing
the swapped art), only the Powered Deity Card is tappable at the
guided step (a wrong-card tap is fully inert), and the trick resolves
as a real win via rule evaluation (the real redistribution phase opens
for the local player as winner/distributor, never faked). Console
clean on boot aside from the same pre-existing, unrelated ICE-server
fetch failure present in this sandboxed test environment on plain
boot too.

## Next proposed step

Scene 5 is next (per suits-mp-tutorial-design.md's Section 3) - Off-suit
(facedown). A new forced scenario where the player's hand is engineered
so a Double is genuinely unavailable (no matching-rank pair), making
facedown their only legal off-suit option - teaching the concept
without needing to restrict/hide a Double alternative. This is the
first scene to exercise the `facedownSingle` play type
(`handLegality.ts`'s own off-suit selection state machine) - worth
checking during that task whether the existing `{ kind: 'handCard' }`
lock/`applyTutorialLock` still cover it cleanly (locking a facedown
commit is still "one specific card, hard-locked", so it likely does),
or whether the `actionButton` `TutorialLock`/`GuidePointerTarget`
variant (still reserved, never implemented) turns out to be the
better fit for a facedown confirm that isn't really "pick a card" so
much as "commit the one already-selected off-suit option."
