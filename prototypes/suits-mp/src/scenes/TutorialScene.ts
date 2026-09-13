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
import { TUTORIAL_SCENES } from '../tutorial/tutorialScenes';
import type { TutorialScript, TutorialSceneMarker, TutorialStep, TutorialWaitStep } from '../tutorial/tutorialTypes';
import { cutFromBlack, cutToBlack } from '../tutorial/sceneTransition';
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
// Drives TUTORIAL_SCENES generically (tutorial/tutorialScenes.ts) - only
// index 0 (Scene 1) has a real script today, the rest are `null`
// placeholders the scene selector (dom/tutorial/TutorialTopBar.tsx) locks
// out of jumping to. Reaching the end of the *last built* scene's steps
// still only ever calls finishScene() (a dead end back to Landing, not
// "load the next scene") - see BUILD_STATUS.md for what a later task
// needs to change here once Scene 2 exists.
export class TutorialScene extends Phaser.Scene {
  private state!: GameState;
  private container!: Phaser.GameObjects.Container;
  private uiState: PersistentUIState = createPersistentUIState();
  private loading!: AssetLoadProgress;
  private script!: TutorialScript;
  private stepIndex = 0;
  private pendingWait: TutorialWaitStep | null = null;
  // 0-based. TUTORIAL_SCENES[currentSceneIndex] is always the running
  // script; jumpToScene()/loadScene() are the only things that change it.
  private currentSceneIndex = 0;
  // 0-based scene indices the player has actually finished at least once -
  // this task's "completed, or the current one" jump rule (see
  // canJumpToScene) reads this directly. Never cleared mid-session (a
  // completed scene stays jumpable even after jumping elsewhere).
  private readonly completedScenes = new Set<number>();
  // The one outstanding scene.time.delayedCall from runNextStep (an
  // 'auto' step's own delay, or the post-completion delay before
  // finishScene) - loadScene() cancels whatever's still pending here
  // before starting a new scene/replay. Without this, jumping back into
  // Scene 1 mid-replay left the *previous* run's own "show the completion
  // modal" timer alive, which then fired partway through the new replay -
  // caught via real-gameplay Playwright verification (jump to a completed
  // scene, then watch the completion modal wrongly interrupt it), not
  // just reasoned through.
  private pendingTimer: Phaser.Time.TimerEvent | null = null;

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
    this.currentSceneIndex = 0;
    this.completedScenes.clear();
    this.pendingTimer?.remove();
    this.pendingTimer = null;

    // Instantly black before anything else shows - Scene 0's intro
    // overlay is the very first thing the player sees, never a flash of
    // an empty/unscripted board first.
    this.cameras.main.fadeOut(0, 0, 0, 0);

    openTutorialIntro(() => {
      closeTutorialIntro();
      this.loadScene(0);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => resetTutorialUi());
  }

  // Only 'completed' or 'current' scenes are ever tappable in the scene
  // selector (this task's own requirement) - a scene with no built script
  // yet (TUTORIAL_SCENES[index] === null) is never jumpable regardless,
  // since there's nothing to load.
  private canJumpToScene(index: number): boolean {
    if (!TUTORIAL_SCENES[index]) return false;
    return index === this.currentSceneIndex || this.completedScenes.has(index);
  }

  private buildSceneMarkers(): TutorialSceneMarker[] {
    return TUTORIAL_SCENES.map((_script, index) => ({
      sceneNumber: index + 1,
      status: this.completedScenes.has(index) ? 'completed' : index === this.currentSceneIndex ? 'current' : 'locked',
    }));
  }

  // The scene selector's own tap handler (1-based sceneNumber, matching
  // what's actually shown - see TutorialTopBar.tsx). Re-running the
  // current scene (even one already completed) is exactly the jump this
  // task calls for, not just moving forward.
  private jumpToScene(sceneNumber: number): void {
    const index = sceneNumber - 1;
    if (!this.canJumpToScene(index)) return;
    cutToBlack(this, () => this.loadScene(index));
  }

  // Scene 0 -> Scene 1's black-out/in cut (suits-mp-tutorial-design.md
  // Section 1.4) reuses this same loader for its own first call (no
  // cutToBlack needed - the camera's already instantly black from
  // create()); every later scene selector jump calls cutToBlack() first,
  // then this. The board is built and rendered once *before* the cut-in
  // so there's real content to reveal, not an empty frame.
  private loadScene(index: number): void {
    const script = TUTORIAL_SCENES[index];
    if (!script) return; // defensive only - canJumpToScene already guards this
    this.pendingTimer?.remove();
    this.pendingTimer = null;
    this.currentSceneIndex = index;
    this.script = script;
    this.state = settleAutoPhases(initGame([...SEAT_NAMES], script.deal));
    this.stepIndex = 0;
    this.pendingWait = null;
    this.render();
    cutFromBlack(this);
    this.runNextStep();
  }

  private render(): void {
    const masked = buildMaskedState(this.state, LOCAL_SLOT, {});
    presentGameView(this, this.container, masked, (action) => this.onPlayerAction(action), this.uiState, {
      lock: this.pendingWait?.lock ?? null,
      pointer: this.pendingWait?.pointer ?? null,
      lesson: this.pendingWait?.lesson ?? null,
      scenes: this.buildSceneMarkers(),
      onSelectScene: (sceneNumber) => this.jumpToScene(sceneNumber),
      onQuit: () => this.quit(),
    });
  }

  // Consumes script steps one at a time: an 'auto' step dispatches its
  // scripted remote action after a real delay (standing in for a bot/peer
  // turn - see tutorialTypes.ts) and immediately continues; a 'wait' step
  // stops here and waits for onPlayerAction to supply the matching real
  // action. Reaching the end of the script hands off to finishScene()
  // once the real trick-result dwell has had time to play out, rather
  // than covering it immediately - completion itself is marked earlier,
  // by markCompletedIfFinished() right before the *triggering* render
  // (see that function's own doc comment for why the ordering matters).
  private runNextStep(): void {
    if (this.stepIndex >= this.script.steps.length) {
      this.pendingTimer = this.time.delayedCall(tune.tutorialSceneCompleteDelayMs, () => {
        this.pendingTimer = null;
        this.finishScene();
      });
      return;
    }
    const step: TutorialStep = this.script.steps[this.stepIndex];
    if (step.kind === 'auto') {
      this.pendingTimer = this.time.delayedCall(step.delayMs, () => {
        this.pendingTimer = null;
        const result = applyAction(this.state, step.forSlot, step.action);
        if (!result.ok) {
          console.warn(`suits-mp tutorial: scripted step rejected: ${result.error}`);
          return;
        }
        this.state = result.state;
        this.stepIndex += 1;
        this.markCompletedIfFinished();
        this.render();
        this.runNextStep();
      });
      return;
    }
    this.pendingWait = step;
    this.render();
  }

  // Marks the current scene completed the instant the script is
  // exhausted - called *before* the render() that will actually reflect
  // it, never after. A trick-completing render kicks off
  // presentGameView's multi-beat dwell (frozen display, then a delayed
  // collect-flight/settle render - see that function's own doc comment),
  // and every one of those later beats replays with the exact
  // TutorialHudConfig object closed over by *this* render call, not
  // whatever a later render() might produce - marking completion in a
  // second, follow-up render() (this function's own earlier, wrong
  // version) lands on presentGameView's `ui.pendingHoldMasked` early-
  // return path instead of a real render, so the checkmark would never
  // actually reach the screen until the *next* unrelated render. Caught
  // via real-gameplay Playwright verification, not just reasoned through.
  private markCompletedIfFinished(): void {
    if (this.stepIndex >= this.script.steps.length) this.completedScenes.add(this.currentSceneIndex);
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
    this.markCompletedIfFinished();
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

  // The persistent Quit control (TutorialTopBar.tsx) - reachable at every
  // point within a scene, per this task's own requirement, and always an
  // immediate exit straight to Landing: no confirmation step, no
  // completion modal, matching every other "Back to Menu" action already
  // in this codebase (Victory Screen, Host Disconnected).
  private quit(): void {
    hideGameOverlay();
    this.navigateToLandingMenu();
  }

  private navigateToLandingMenu(): void {
    closeTutorialLesson();
    this.scene.start('Landing', {
      clientId: getOrCreateClientId('suits-mp:clientId'),
      getIceServers: () => fetchTurnIceServers(),
    });
  }
}
