import { cardId } from '../rules/cards';
import type { TutorialScript } from './tutorialTypes';

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

// The full 6-scene structure from suits-mp-tutorial-design.md's Section 3
// - `null` for a scene not built yet. This task (tutorial prep, ahead of
// the Scene 2 task) is what first anticipates this whole array: the
// scene selector (dom/tutorial/TutorialTopBar.tsx, TutorialScene.ts's own
// jumpToScene) already renders a marker per array index and locks out
// tapping any `null` entry, so a later task only ever needs to replace an
// entry here (and give TutorialScene a real script to run past
// finishScene() with) - never touch the selector or the jump mechanism
// itself.
export const TUTORIAL_SCENES: readonly (TutorialScript | null)[] = [TUTORIAL_SCENE_1, null, null, null, null, null];
