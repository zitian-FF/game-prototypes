import Phaser from 'phaser';
import { getOrCreateClientId } from 'mp-core';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { fetchTurnIceServers } from '../turn/turnConfig';
import { initGame } from '../rules/engine';
import { applyAction, settleAutoPhases } from '../host/gameHost';
import { buildMaskedState } from '../host/mask';
import { createPersistentUIState, presentGameView } from '../ui/renderGameView';
import type { PersistentUIState } from '../ui/renderGameView';
import { preloadCardArt } from '../ui/cardArt';
import { showAssetLoadProgress } from '../ui/loadingProgress';
import type { AssetLoadProgress } from '../ui/loadingProgress';
import type { ClientAction } from '../net/actions';
import type { GameState, PlayerId } from '../rules/types';
import { TUTORIAL_SCENE_1 } from '../tutorial/tutorialScenes';
import type { TutorialScript, TutorialStep, TutorialWaitStep } from '../tutorial/tutorialTypes';
import { cutFromBlack } from '../tutorial/sceneTransition';
import { hideGameOverlay } from '../dom/overlay/gameOverlayStore';
import {
  closeTutorialIntro,
  closeTutorialLesson,
  openTutorialComplete,
  openTutorialIntro,
  resetTutorialUi,
} from '../dom/tutorial/tutorialUiStore';
import tune from '../../tune.json';

const LOCAL_SLOT: PlayerId = 0;
const SEAT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'] as const;

// Drives the scripted tutorial exactly the way HostGameScene drives a real
// (or Single Player) game: one canonical GameState, every action - local
// or scripted-remote - applied through the exact same host/gameHost.ts
// applyAction() a real peer's action would go through, and the exact same
// buildMaskedState()/presentGameView() rendering pipeline every other
// scene uses (see root CLAUDE.md's "reuse real rendering" principle and
// suits-mp-tutorial-design.md Section 1.1). What's different from
// HostGameScene is *why* actions get applied - a scripted step sequence
// (see tutorial/tutorialTypes.ts) instead of real peer input or bot AI -
// never a separate, simplified game-state representation.
//
// Part 1 only ever runs one scene (TUTORIAL_SCENE_1) and ends at
// finishScene() - Scenes 2-6 (suits-mp-tutorial-design.md Section 3) are
// explicitly out of scope for this task; see BUILD_STATUS.md for what
// would need to generalize here (loading the next scene's own ForcedDeal/
// steps instead of showing the completion modal) once they're built.
export class TutorialScene extends Phaser.Scene {
  private state!: GameState;
  private container!: Phaser.GameObjects.Container;
  private uiState: PersistentUIState = createPersistentUIState();
  private loading!: AssetLoadProgress;
  private readonly script: TutorialScript = TUTORIAL_SCENE_1;
  private stepIndex = 0;
  private pendingWait: TutorialWaitStep | null = null;

  constructor() {
    super('Tutorial');
  }

  preload(): void {
    this.loading = showAssetLoadProgress(this);
    preloadCardArt(this);
  }

  create(): void {
    if (this.loading.hadError) {
      this.loading.showRetry(() => this.scene.restart());
      return;
    }
    this.loading.hide();

    addVersionStamp(this);
    createPortraitGuard(this);
    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    this.container = this.add.container(0, 0);

    // Instantly black before anything else shows - Scene 0's intro
    // overlay is the very first thing the player sees, never a flash of
    // an empty/unscripted board first.
    this.cameras.main.fadeOut(0, 0, 0, 0);

    openTutorialIntro(() => {
      closeTutorialIntro();
      this.beginScene1();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => resetTutorialUi());
  }

  // Scene 0 -> Scene 1's black-out/in cut (suits-mp-tutorial-design.md
  // Section 1.4) - the one place Part 1 exercises the transition
  // mechanic every later scene will also use for its own scene-to-scene
  // jump. The board is built and rendered once *before* the cut-in so
  // there's real content to reveal, not an empty frame.
  private beginScene1(): void {
    this.state = settleAutoPhases(initGame([...SEAT_NAMES], this.script.deal));
    this.stepIndex = 0;
    this.render();
    cutFromBlack(this);
    this.runNextStep();
  }

  private render(): void {
    const masked = buildMaskedState(this.state, LOCAL_SLOT, {});
    const tutorialConfig = this.pendingWait
      ? { lock: this.pendingWait.lock, pointer: this.pendingWait.pointer, lesson: this.pendingWait.lesson }
      : null;
    presentGameView(this, this.container, masked, (action) => this.onPlayerAction(action), this.uiState, tutorialConfig);
  }

  // Consumes script steps one at a time: an 'auto' step dispatches its
  // scripted remote action after a real delay (standing in for a bot/peer
  // turn - see tutorialTypes.ts) and immediately continues; a 'wait' step
  // stops here and waits for onPlayerAction to supply the matching real
  // action. Reaching the end of the script (today, only ever right after
  // Scene 1's own 'wait' step) hands off to finishScene() once the real
  // trick-result dwell has had time to play out, rather than covering it
  // immediately.
  private runNextStep(): void {
    if (this.stepIndex >= this.script.steps.length) {
      this.time.delayedCall(tune.tutorialSceneCompleteDelayMs, () => this.finishScene());
      return;
    }
    const step: TutorialStep = this.script.steps[this.stepIndex];
    if (step.kind === 'auto') {
      this.time.delayedCall(step.delayMs, () => {
        const result = applyAction(this.state, step.forSlot, step.action);
        if (!result.ok) {
          console.warn(`suits-mp tutorial: scripted step rejected: ${result.error}`);
          return;
        }
        this.state = result.state;
        this.stepIndex += 1;
        this.render();
        this.runNextStep();
      });
      return;
    }
    this.pendingWait = step;
    this.render();
  }

  // The hard-lock gate (ui/renderGameView.ts's applyTutorialLock) already
  // keeps every other card non-tappable, so in practice `action` can only
  // ever be the one legal tap that reaches here - this equality check is
  // the authoritative guard regardless, never trusting the UI layer alone.
  private onPlayerAction(action: ClientAction): void {
    if (!this.pendingWait) return;
    if (JSON.stringify(action) !== JSON.stringify(this.pendingWait.allowedAction)) return;
    const result = applyAction(this.state, LOCAL_SLOT, action);
    if (!result.ok) {
      console.warn(`suits-mp tutorial: player action rejected: ${result.error}`);
      return;
    }
    this.state = result.state;
    this.pendingWait = null;
    this.stepIndex += 1;
    this.render();
    this.runNextStep();
  }

  private finishScene(): void {
    // Same "hide the bottom action HUD before covering the screen" step
    // the real Local Victory sequence already does (see
    // ui/renderGameView.ts's startVictorySequence) - without it, the last
    // real HUD state (the untaught redistribution phase's own action bar)
    // stays visible behind, and then after, the completion/Landing
    // overlays.
    hideGameOverlay();
    openTutorialComplete(() => this.navigateToLandingMenu());
  }

  private navigateToLandingMenu(): void {
    closeTutorialLesson();
    this.scene.start('Landing', {
      clientId: getOrCreateClientId('suits-mp:clientId'),
      getIceServers: () => fetchTurnIceServers(),
    });
  }
}
