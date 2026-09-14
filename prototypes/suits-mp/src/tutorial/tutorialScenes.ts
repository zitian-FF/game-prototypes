import { cardId } from '../rules/cards';
import type { TutorialRedistributeAssignment, TutorialScript } from './tutorialTypes';

// Scene 1 - Winning a trick (suits-mp-tutorial-design.md, Section 3). The
// local player (slot 0) is dealt several Cthulhu cards including the
// highest rank in play, and is positioned last to act (leaderId: 1, so
// turnOrder(1) = [1, 2, 3, 0]) - the three seats ahead of them auto-play
// already-legal follows first, exactly as three real turns would look,
// before the player ever acts.
//
// The Suit Cycle (rules/cards.ts's suitAfterSteps, requiredSuitForPosition
// in rules/engine.ts) means each of the 4 *positions* in a trick requires
// a DIFFERENT god, rotating through SUIT_CYCLE from whatever the leader's
// card was - not every follower matching the same lead suit like a
// conventional trick-taking game. Leading with a ShubNiggurath card puts
// the local player (3 steps around the cycle from the leader) on
// Cthulhu, which is what this scene actually needs each remote seat's
// single scripted card to be a real, suit-matching follow (`kind:
// 'normal'`, scored by real rank) rather than an off-suit play (`kind:
// 'offsuit'`, always masked facedown and always scored 0 regardless of
// rank - see rules/engine.ts's scoreOf) - the latter was this scene's
// first, wrong attempt, caught via real-gameplay Playwright verification
// showing the remote plays rendering as masked card-backs instead of the
// real follows the lesson needs to be watching.
//
// The player's hand deliberately holds *several* legal Cthulhu cards
// (2, 5, 9, DeityCard, 10), not just the one winning card - under the
// real legality system every one of them is a genuinely legal follow (any
// suit-matching single is legal to a follower, real rank isn't
// considered). The hard-lock is what narrows that down to exactly the
// winning card (the 10), which is the actual lesson: several options are
// legal, but only the highest rank *wins* - rank is compared across all
// 4 plays regardless of each one's own (position-determined) suit, per
// scoreOf, so the ascending 4/6/8 remote plays make the local player's 10
// an unambiguous highest score.
//
// trickNumber is 2 (not 1) specifically to sidestep isForcedTrick1Opener
// (rules/engine.ts) - trick 1's leader must open with the 2 of
// Yog-Sothoth specifically, which would otherwise override this scene's
// own scripted ShubNiggurath-4 opener.
//
// Every card here is real, valid, and deck-consistent (no two seats
// share a card) even though the design doc permits remote seats to be
// fabricated/non-deck-constrained - this scene simply doesn't need that
// latitude (see tutorialTypes.ts's TutorialScript doc comment for why
// genuinely non-deck-constrained data isn't wired up yet regardless).
export const TUTORIAL_SCENE_1: TutorialScript = {
  deal: {
    hands: [
      [cardId('Cthulhu', 2), cardId('Cthulhu', 5), cardId('Cthulhu', 9), cardId('Cthulhu', 'DeityCard'), cardId('Cthulhu', 10)],
      [cardId('ShubNiggurath', 4)],
      [cardId('Nyarlathotep', 6)],
      [cardId('YogSothoth', 8)],
    ],
    gods: ['Nyarlathotep', 'Cthulhu', 'ShubNiggurath', 'YogSothoth'],
    leaderId: 1,
    trickNumber: 2,
  },
  steps: [
    { kind: 'auto', forSlot: 1, action: { action: 'playCard', playType: 'single', cards: [cardId('ShubNiggurath', 4)] }, delayMs: 900 },
    { kind: 'auto', forSlot: 2, action: { action: 'playCard', playType: 'single', cards: [cardId('Nyarlathotep', 6)] }, delayMs: 900 },
    { kind: 'auto', forSlot: 3, action: { action: 'playCard', playType: 'single', cards: [cardId('YogSothoth', 8)] }, delayMs: 900 },
    {
      kind: 'wait',
      allowedAction: { action: 'playCard', playType: 'single', cards: [cardId('Cthulhu', 10)] },
      lock: { kind: 'handCard', cardId: cardId('Cthulhu', 10) },
      pointer: { kind: 'handCard', cardId: cardId('Cthulhu', 10) },
      lesson: 'Highest rank wins the trick. Play the 10 to take it.',
    },
  ],
};

// Scene 2 - Redistribution (suits-mp-tutorial-design.md, Section 3).
// Continues directly from Scene 1's own established scenario - identical
// `deal` (same local player Deity/hand lineage, same ally at slot 1/
// Player 2/'p1'), so `initGame` produces the exact same starting state
// Scene 1 did. Unlike Scene 1, though, all 4 trick plays - including the
// local player's own Cthulhu-10 win - are scripted `auto` steps here:
// Scene 2 isn't re-teaching "highest rank wins the trick" (that's Scene
// 1's own lesson), it's fast-forwarding through the already-taught win
// to reach the actual redistribution moment this scene teaches. Once all
// 4 auto steps have resolved, the real engine has already collected the
// trick and moved to the `redistribute` phase on its own (a single win's
// winner is immediately also its own distributor - no chooseDelegate step
// intervenes, see rules/engine.ts's proceedFromTrickResult) - exactly the
// same real transition Scene 1 itself would have reached had it kept
// going past its own wait step.
//
// Real contribution order out of the engine's redistribute() for this
// exact deal (leaderId: 1, turnOrder [1,2,3,0], local slot 0 as
// collector/distributor) is `[p1, p2, p3]` - confirmed during Scene 1's
// own authoring/testing. The scripted assignment below returns each
// contributor exactly the single off-suit filler card they themselves
// played this trick (ShubNiggurath-4 -> p1, Nyarlathotep-6 -> p2,
// YogSothoth-8 -> p3): none of these are the local player's own Cthulhu
// cards, so the lesson holds - every one of the 3 cards being given away
// is a weak, non-own-suit card the player never needed to keep, and one
// goes to each of the other three seats. `allowedAction`'s `assignments`
// array order must match this same `[p1, p2, p3]` contribution order
// exactly - TutorialScene.onPlayerAction compares the dispatched action
// against it with a plain JSON.stringify equality check, not a
// order-independent one.
//
// Real intermediate hand size, confirmed via Playwright (not just worked
// out on paper): rules/engine.ts's advanceBlocker() collects *every* card
// played this trick into the distributor's hand, including the
// distributor's own winning play (`state.lastTrickResult.plays.flatMap`
// makes no exception for it) - so right after the local player's own
// Cthulhu-10 auto-play, their hand briefly holds all 8 cards (their
// original 5, plus the 3 off-suit cards just collected) before
// redistribute() removes the 3 gifted ones. Cthulhu-10 itself is never
// gifted away (`contribution` explicitly excludes the distributor's own
// play - see redistribute()'s own doc comment), so the local player's
// hand after this scene's redistribution is exactly their original 5
// Cthulhu cards again, unchanged - not "5 minus the played 10" as a naive
// read of "you played your 10 to win" might suggest.
// The scripted redistribution plan itself - shared verbatim between
// `lock` and `pointer` below (they're the same plan read two different
// ways: what's allowed vs. what's pointed at), so there's only one place
// to get this mapping right, not two copies that could quietly drift.
const SCENE_2_ASSIGNMENTS: TutorialRedistributeAssignment[] = [
  { cardId: cardId('ShubNiggurath', 4), toPlayer: 'p1' },
  { cardId: cardId('Nyarlathotep', 6), toPlayer: 'p2' },
  { cardId: cardId('YogSothoth', 8), toPlayer: 'p3' },
];

export const TUTORIAL_SCENE_2: TutorialScript = {
  deal: TUTORIAL_SCENE_1.deal,
  steps: [
    { kind: 'auto', forSlot: 1, action: { action: 'playCard', playType: 'single', cards: [cardId('ShubNiggurath', 4)] }, delayMs: 900 },
    { kind: 'auto', forSlot: 2, action: { action: 'playCard', playType: 'single', cards: [cardId('Nyarlathotep', 6)] }, delayMs: 900 },
    { kind: 'auto', forSlot: 3, action: { action: 'playCard', playType: 'single', cards: [cardId('YogSothoth', 8)] }, delayMs: 900 },
    { kind: 'auto', forSlot: 0, action: { action: 'playCard', playType: 'single', cards: [cardId('Cthulhu', 10)] }, delayMs: 900 },
    {
      kind: 'wait',
      allowedAction: {
        action: 'redistribute',
        assignments: SCENE_2_ASSIGNMENTS.map((a) => ({ toPlayer: a.toPlayer, cards: [a.cardId] })),
      },
      lock: { kind: 'redistributeAssignments', assignments: SCENE_2_ASSIGNMENTS },
      pointer: { kind: 'redistributeAssignments', assignments: SCENE_2_ASSIGNMENTS },
      lesson: "Give one card back to each of the other players. It's required - and it also shows them what you didn't need to keep.",
    },
  ],
};

// Scene 3 - The Suit Cycle (suits-mp-tutorial-design.md, Section 3).
// Continues directly from Scene 2's established scenario: same local
// player Deity/hand lineage (Nyarlathotep, holding the familiar 5-card
// Cthulhu hand) and same ally (Player 2/'p1', god Cthulhu) - Scene 2
// confirmed real redistribution leaves that hand exactly as it started.
// Because the local player redistributed in Scene 2, they lead the next
// trick here - `leaderId: 0` (turnOrder(0) = [0,1,2,3]), unlike Scenes
// 1-2's `leaderId: 1`. `trickNumber: 3` continues the narrative (trick 2
// was redistributed in Scene 2) and, same as Scenes 1-2's own `2`,
// sidesteps isForcedTrick1Opener - trick 1's leader must open with
// exactly the 2 of Yog-Sothoth, which would override this scene's own
// scripted Cthulhu-2 lead.
//
// Leading has no suit constraint - real legality already marks every
// hand card 'legal' while `state.currentTrick` is empty (see
// handLegality.ts's `leading` branch, `pool = leading ? hand : ...`) -
// so per this project's established hard-lock rule, the single scripted
// lead card is still locked via the same `applyTutorialLock`/`handCard`
// mechanism Scene 1 uses, with the other 4 legal-but-not-the-lesson
// Cthulhu cards hard-locked out. Deliberately scripted as Cthulhu-2 -
// the WEAKEST card in hand, not the highest-rank one Scene 1 taught
// winning with - since this scene's lesson is "any card leads", not
// "play your best card".
//
// The other three seats' hands are scripted to genuinely need the
// resulting Suit Cycle sequence once Cthulhu leads (suitAfterSteps from
// rules/cards.ts, requiredSuitForPosition from rules/engine.ts - same
// worked-through math Scene 1 established, not reintroducing that
// scene's own first-attempt mismatch bug): position 1 (slot 1, the
// ally) needs suitAfterSteps('Cthulhu', 1) = ShubNiggurath; position 2
// (slot 2) needs suitAfterSteps('Cthulhu', 2) = Nyarlathotep; position 3
// (slot 3) needs suitAfterSteps('Cthulhu', 3) = YogSothoth - so each of
// their single-card hands holds exactly that suit, the same pattern
// Scenes 1-2's own deal already used (just shifted one seat over, since
// the leader moved from slot 1 to slot 0).
//
// This scene deliberately does NOT script the other three seats' own
// follow-up plays at all - the lesson ("the lead suit sets the Required
// Suit sequence for the other three seats") is fully conveyed by the
// Suit Cycle wheel itself, which already updates from real game state
// the instant a lead suit is known: `ui/renderGameView.ts`'s
// `computeSuitRing` resolves every seat's required suit off
// `state.leadSuit`/`state.currentTrick[0]` once a lead is committed, and
// even LIVE-PREVIEWS it off the leader's own in-progress fan selection
// beforehand (`previewCardId` - see computeSuitRing's own doc comment).
// Confirmed via real-gameplay Playwright verification: no tutorial-
// specific hook was needed to make the rotation real or legible - the
// wheel already turns as soon as Cthulhu-2 is selected (the live
// preview), and again once it's actually played (the real, committed
// rotation) - both entirely existing, non-tutorial-specific behavior.
// The script simply ends once this one wait step resolves - per the
// design brief, this scene doesn't need to end in a trick win or
// redistribution, and TutorialScene.finishScene() advances/falls back
// exactly as it already does after any other scene's last step, with no
// changes needed to pick this up.
export const TUTORIAL_SCENE_3: TutorialScript = {
  deal: {
    ...TUTORIAL_SCENE_1.deal,
    leaderId: 0,
    trickNumber: 3,
  },
  steps: [
    {
      kind: 'wait',
      allowedAction: { action: 'playCard', playType: 'single', cards: [cardId('Cthulhu', 2)] },
      lock: { kind: 'handCard', cardId: cardId('Cthulhu', 2) },
      pointer: { kind: 'handCard', cardId: cardId('Cthulhu', 2) },
      lesson: "Leading has no suit rule - any card will do. Watch the wheel: your lead sets the Required Suit for the other three seats.",
    },
  ],
};

// Scene 4 - Powered Deity Cards (suits-mp-tutorial-design.md, Section 3).
// A NEW forced trick (a black-out/in cut, not a continuation of Scene 3's
// unfinished one) - but keeps the same narrative lineage as every prior
// scene: the local player again holds the familiar Cthulhu hand (their
// own Dormant Cthulhu Deity Card among them) with the same ally at slot
// 1. `leaderId: 1` (turnOrder(1) = [1,2,3,0]) puts the local player back
// last to act, same shape as Scene 1; `trickNumber: 4` continues the
// narrative (tricks 2-3 already happened in Scenes 2-3) and, same as
// every prior scene's own non-1 trickNumber, sidesteps
// isForcedTrick1Opener.
//
// This is the one deliberate exception to "the player always acts" the
// design doc calls out: three scripted `auto` plays happen entirely
// unattended before the player's own turn, specifically so the player
// watches them resolve via the real card-play travel animation (the
// same mechanism Scenes 1-2 already use for their own pre-turn auto
// plays - nothing new needed here, just three in a row this time
// instead of stopping to let the player act after them, since watching
// IS the point this scene is making).
//
// The Suit Cycle math (same worked-through approach as every prior
// scene) is identical to Scene 1's own: leading with a ShubNiggurath
// card puts position 1 (slot 2) on Nyarlathotep, position 2 (slot 3) on
// YogSothoth, and position 3 (slot 0, local) on Cthulhu. The one
// deliberate change from Scene 1's own deal: slot 3's scripted card is
// YogSothoth-**10**, not YogSothoth-8 - still a real, suit-matching
// single (`kind: 'normal'`, visible, not masked facedown), but this
// scene's own required "a real 10, played before the local player's
// turn" (rules/engine.ts's `computeDeityCardState` checks for ANY
// rank-10 card among the trick's prior plays, regardless of which god
// it belongs to - it doesn't have to be a Cthulhu-10 to power a Cthulhu
// Deity Card, see that function's own doc comment). Landing it as the
// third (last) scripted play, immediately before the local player's own
// turn, means the Awakened reveal has as long as the player wants to
// read before they're ever asked to act - no auto-step delay follows it.
//
// The local player's hand is deliberately only 4 cards this time
// (Cthulhu-2, 5, 9, DeityCard - no Cthulhu-10), unlike Scenes 1-2's
// 5-card hand that included it: this scene's own real 10 belongs to
// YogSothoth (slot 3's scripted play) instead, so the local player's
// own Cthulhu-10 has no role to play here and would only be a
// distraction sitting unplayed in hand.
//
// Confirmed via real-gameplay Playwright verification (see
// BUILD_STATUS.md): the Awakened reveal on the local player's own
// Dormant Deity Card fires entirely off real game state, the exact
// same client-side preview `ui/renderGameView.ts`'s `renderCardFan`
// already runs for every hand (the `tenAlreadyPlayed` check triggers
// the instant YogSothoth-10 lands, regardless of suit) - no new
// tutorial-specific hook or timing adjustment was needed anywhere.
// `lesson` covers both the transformation and the correct next action
// in the same wait step (mirroring Scene 3's precedent that a single
// step can carry a "watch this happen" beat and "now act on it"
// together, rather than needing a separate non-interactive pause step
// the type system doesn't have a shape for regardless).
//
// The scripted DeityCard win needs no redistribution to make its point
// (mirrors Scene 3's own precedent of ending once the specific concept
// - here, a real Powered-rank win - is conveyed) - `finishScene()`
// needs no changes to pick this up.
export const TUTORIAL_SCENE_4: TutorialScript = {
  deal: {
    hands: [
      [cardId('Cthulhu', 2), cardId('Cthulhu', 5), cardId('Cthulhu', 9), cardId('Cthulhu', 'DeityCard')],
      [cardId('ShubNiggurath', 4)],
      [cardId('Nyarlathotep', 6)],
      [cardId('YogSothoth', 10)],
    ],
    gods: ['Nyarlathotep', 'Cthulhu', 'ShubNiggurath', 'YogSothoth'],
    leaderId: 1,
    trickNumber: 4,
  },
  steps: [
    { kind: 'auto', forSlot: 1, action: { action: 'playCard', playType: 'single', cards: [cardId('ShubNiggurath', 4)] }, delayMs: 900 },
    { kind: 'auto', forSlot: 2, action: { action: 'playCard', playType: 'single', cards: [cardId('Nyarlathotep', 6)] }, delayMs: 900 },
    { kind: 'auto', forSlot: 3, action: { action: 'playCard', playType: 'single', cards: [cardId('YogSothoth', 10)] }, delayMs: 900 },
    {
      kind: 'wait',
      allowedAction: { action: 'playCard', playType: 'single', cards: [cardId('Cthulhu', 'DeityCard')] },
      lock: { kind: 'handCard', cardId: cardId('Cthulhu', 'DeityCard') },
      pointer: { kind: 'handCard', cardId: cardId('Cthulhu', 'DeityCard') },
      lesson: 'A 10 has been played - your Dormant Deity Card is now Powered (rank 11) and beats it. Play it to win the trick.',
    },
  ],
};

// Scene 5 - Off-suit (facedown) (suits-mp-tutorial-design.md, Section 3).
// A new forced scenario (black-out/in cut), same narrative lineage as
// every prior scene (local player's own god Nyarlathotep, same ally at
// slot 1). `leaderId: 1` keeps the local player last to act, same shape
// as Scenes 1 and 4; `trickNumber: 5` continues the narrative and, same
// as every prior scene's own non-1 trick number, sidesteps
// isForcedTrick1Opener.
//
// Unlike every prior scene, the local player's hand deliberately holds
// NO Cthulhu cards at all (position 3's required suit, same Suit Cycle
// math as Scenes 1/2/4's identical leaderId:1/ShubNiggurath-lead shape) -
// genuinely off-suit, not just scripted around it - and its 3 cards
// (Nyarlathotep-2, ShubNiggurath-5, YogSothoth-9) are 3 DIFFERENT ranks,
// so no two of them can ever form a Double. Confirmed via the real
// `ui/handLegality.ts`'s `computeHandLegality` (not just eyeballed):
// with `state.requiredSuit === 'Cthulhu'` and zero suit-matching cards,
// `rules/engine.ts`'s `legalOptions` returns `mustPlaySuit: null` and
// `doubleRanks: []` (no rank appears twice), which routes
// `computeHandLegality` straight into its off-suit branch with no
// possible 'partner' state ever appearing for any card - `facedownSingle`
// is mechanically the only playType this hand can ever produce, exactly
// what this scene needs to demonstrate without hiding or restricting a
// Double alternative that simply doesn't exist here.
//
// Investigation (this task's own open question from Scene 4's
// BUILD_STATUS.md): does the existing `{ kind: 'handCard' }` lock/
// `applyTutorialLock` cleanly cover a facedown confirm, or does the
// still-reserved `actionButton` variant turn out to be the better fit?
// Traced the real flow rather than assuming: `computeHandLegality`'s
// off-suit branch marks EVERY hand card 'legal' before anything is
// selected (any card could, in principle, start a Double) - unlike the
// play-phase branch's already-narrowed pool, so `applyTutorialLock`
// forcing every card but the one scripted `lockedCardId` to 'illegal'
// is what narrows an otherwise-multi-card-legal moment down to exactly
// one, same mechanism, same effect as Scene 1's own single-select lock.
// Once that one card is tapped and becomes `state.selectedCards[0]`,
// the NEXT render re-runs `computeHandLegality` fresh (now
// `selected.length === 1`) and reapplies the exact same lock - the
// locked card's own real state ('selected', since it matches
// `selected[0]`) passes through untouched, and this hand's total lack
// of a matching-rank 'partner' anywhere means every other card is
// already 'illegal'-bound regardless, so the lock has nothing extra to
// even suppress at that point. `computeActionButtonState`'s action
// button already reads `legality.playType`/`onClick` completely
// generically (the same "Facedown Card" label / real
// `{ action: 'playCard', playType: 'facedownSingle', cards }` dispatch
// every other scene's own action button already produces for its own
// playType) - nothing tutorial-specific gates it, and nothing needs to.
// **Conclusion: `{ kind: 'handCard' }` covers this scene completely -
// no new `actionButton` TutorialLock/GuidePointerTarget variant was
// needed.** Confirmed via real-gameplay Playwright verification, not
// just this trace: only the one scripted card is ever tappable, and the
// action button becomes real/enabled only once it's selected, same
// two-tap shape (select the hard-locked card, then confirm) as every
// prior scene.
//
// ShubNiggurath-5 is the scripted card - deliberately neither the local
// player's own god (Nyarlathotep) nor their ally's (Cthulhu), so
// nothing about the choice reads as thematically special; any of the
// 3 hand cards would have been an equally legal facedown play, per the
// design doc's own framing that this lesson is about the mechanic, not
// which specific card.
//
// Ends once the facedown card is committed - no need to play the trick
// out to resolution, mirroring Scenes 3-4's own precedent of ending
// once the specific concept is conveyed. `TutorialScene.finishScene()`
// needed no changes to pick this up.
export const TUTORIAL_SCENE_5: TutorialScript = {
  deal: {
    hands: [
      [cardId('Nyarlathotep', 2), cardId('ShubNiggurath', 5), cardId('YogSothoth', 9)],
      [cardId('ShubNiggurath', 4)],
      [cardId('Nyarlathotep', 6)],
      [cardId('YogSothoth', 8)],
    ],
    gods: ['Nyarlathotep', 'Cthulhu', 'ShubNiggurath', 'YogSothoth'],
    leaderId: 1,
    trickNumber: 5,
  },
  steps: [
    { kind: 'auto', forSlot: 1, action: { action: 'playCard', playType: 'single', cards: [cardId('ShubNiggurath', 4)] }, delayMs: 900 },
    { kind: 'auto', forSlot: 2, action: { action: 'playCard', playType: 'single', cards: [cardId('Nyarlathotep', 6)] }, delayMs: 900 },
    { kind: 'auto', forSlot: 3, action: { action: 'playCard', playType: 'single', cards: [cardId('YogSothoth', 8)] }, delayMs: 900 },
    {
      kind: 'wait',
      allowedAction: { action: 'playCard', playType: 'facedownSingle', cards: [cardId('ShubNiggurath', 5)] },
      lock: { kind: 'handCard', cardId: cardId('ShubNiggurath', 5) },
      pointer: { kind: 'handCard', cardId: cardId('ShubNiggurath', 5) },
      lesson: "No follow, no matching pair - your only legal play is a facedown Single. It concedes the trick, but stays hidden from everyone else.",
    },
  ],
};

// The full 6-scene structure from suits-mp-tutorial-design.md's Section 3
// - `null` for a scene not built yet. Tutorial prep (the task ahead of
// Scene 2) is what first anticipated this whole array: the scene
// selector (dom/tutorial/TutorialTopBar.tsx, TutorialScene.ts's own
// jumpToScene) already renders a marker per array index and locks out
// tapping any `null` entry, so a later task only ever needs to replace an
// entry here (and give TutorialScene a real script to run past
// finishScene() with) - never touch the selector or the jump mechanism
// itself.
export const TUTORIAL_SCENES: readonly (TutorialScript | null)[] = [
  TUTORIAL_SCENE_1,
  TUTORIAL_SCENE_2,
  TUTORIAL_SCENE_3,
  TUTORIAL_SCENE_4,
  TUTORIAL_SCENE_5,
  null,
];
