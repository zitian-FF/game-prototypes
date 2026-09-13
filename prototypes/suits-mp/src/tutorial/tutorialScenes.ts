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

// The full 6-scene structure from suits-mp-tutorial-design.md's Section 3
// - `null` for a scene not built yet. Tutorial prep (the task ahead of
// Scene 2) is what first anticipated this whole array: the scene
// selector (dom/tutorial/TutorialTopBar.tsx, TutorialScene.ts's own
// jumpToScene) already renders a marker per array index and locks out
// tapping any `null` entry, so a later task only ever needs to replace an
// entry here (and give TutorialScene a real script to run past
// finishScene() with) - never touch the selector or the jump mechanism
// itself.
export const TUTORIAL_SCENES: readonly (TutorialScript | null)[] = [TUTORIAL_SCENE_1, TUTORIAL_SCENE_2, null, null, null, null];
