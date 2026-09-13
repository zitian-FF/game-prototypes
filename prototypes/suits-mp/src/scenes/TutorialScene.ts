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
// Drives TUTORIAL_SCENES generically (tutorial/tutorialScenes.ts) - Scenes
// 1-2 have real scripts today, the rest are still `null` placeholders the
// scene selector (dom/tutorial/TutorialTopBar.tsx) locks out of jumping
// to. Reaching the end of a scene's steps advances to the next scene
// (see finishScene) when one is actually built, falling back to the
// completion modal - a TEMPORARY stand-in, not a permanent dead end - once
// there's no next scene yet (currently past Scene 2, since Scene 3
// onward are still `null`). See BUILD_STATUS.md.
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
  // The one outstanding scene.time.delayedCall from scheduleNextIfAuto (an
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
    this.syncPendingWaitForCurrentStep();
    this.render();
    cutFromBlack(this);
    this.scheduleNextIfAuto();
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

  // Keeps `this.pendingWait` in sync with whatever `this.stepIndex` now
  // points at - null unless that step is genuinely a 'wait' step. Must
  // always be called *before* the render() that will reflect a step
  // transition, never after: a render() that observes a just-completed
  // trick (see presentGameView's own dwell logic in ui/renderGameView.ts)
  // starts a multi-beat dwell sequence that closes over whatever
  // TutorialHudConfig *that one* render() call was given, and every later
  // beat of the same dwell replays with that exact same config, not
  // whatever a second, immediately-following render() call might carry -
  // that second call's own config is silently discarded instead (see
  // presentGameView's `ui.pendingHoldMasked` early-return). Scene 1 never
  // exposed this, since its own 'wait' step is reached *before* the local
  // player's trick-winning play, never right after one - Scene 2's
  // redistribution 'wait' step is the first to immediately follow a
  // trick-completing step (the scripted auto-play of the local player's
  // own winning card), which is exactly the case this ordering fixes:
  // without it, the redistribute lock/pointer/lesson would silently never
  // reach the screen at all, even though `this.pendingWait` itself was
  // set correctly - caught via real-gameplay Playwright verification
  // (the hard-lock had no visible effect, every hand card stayed fully
  // tappable) while authoring Scene 2, not just reasoned through.
  private syncPendingWaitForCurrentStep(): void {
    const step: TutorialStep | undefined = this.script.steps[this.stepIndex];
    this.pendingWait = step?.kind === 'wait' ? step : null;
  }

  // Schedules whatever comes next, given `this.stepIndex`/`this.pendingWait`
  // are already in sync (see syncPendingWaitForCurrentStep). A pending
  // wait step needs no scheduling at all - it already rendered, and just
  // sits there until onPlayerAction supplies the matching real action.
  // Otherwise either the script is exhausted (schedule the completion
  // delay, then finishScene()) or the current step is a genuine 'auto'
  // step (schedule its own scripted-remote delay, then apply it and
  // advance).
  private scheduleNextIfAuto(): void {
    if (this.pendingWait) return;
    if (this.stepIndex >= this.script.steps.length) {
      this.pendingTimer = this.time.delayedCall(tune.tutorialSceneCompleteDelayMs, () => {
        this.pendingTimer = null;
        this.finishScene();
      });
      return;
    }
    const step = this.script.steps[this.stepIndex] as Extract<TutorialStep, { kind: 'auto' }>;
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
      this.syncPendingWaitForCurrentStep();
      this.render();
      this.scheduleNextIfAuto();
    });
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
    this.stepIndex += 1;
    this.markCompletedIfFinished();
    this.syncPendingWaitForCurrentStep();
    this.render();
    this.scheduleNextIfAuto();
  }

  // Reaching the end of a scene's script advances to the next scene (same
  // cutToBlack -> loadScene cut jumpToScene already uses for a manual
  // selector jump) when one is actually built - Scene 2 is the first
  // scene this applies to, since Scene 1 previously was the last one
  // built. Falling off the end of TUTORIAL_SCENES, or landing on a still-
  // `null` entry (Scene 3 onward, as of this task), is a TEMPORARY stand-
  // in: fall back to the same completion modal this function always
  // showed, rather than crash on a scene that doesn't exist yet - a later
  // task building that next scene replaces this fallback the same way it
  // replaces the `null` entry itself, never by touching this method
  // again beyond that.
  private finishScene(): void {
    const nextIndex = this.currentSceneIndex + 1;
    if (TUTORIAL_SCENES[nextIndex]) {
      cutToBlack(this, () => this.loadScene(nextIndex));
      return;
    }
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
