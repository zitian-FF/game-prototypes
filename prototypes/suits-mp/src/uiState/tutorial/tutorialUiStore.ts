import type { TutorialSceneMarker } from '../../tutorial/tutorialTypes';

// Tutorial's own small external store, mirroring dom/domUiStore.ts's
// bridge pattern (canvas calls open*/close*, React renders the snapshot) -
// kept separate from domUiStore.ts the same way dom/overlay/
// gameOverlayStore.ts and dom/lobby/lobbyUiStore.ts are already separate
// concerns from it, rather than growing that file's own state shape for a
// feature with no real overlap with Rules/Menu/Victory.

export interface TutorialUiState {
  // Scene 0 - the dismissible full-screen intro overlay.
  introOpen: boolean;
  onIntroDismiss: () => void;
  // The lesson text/callout shown alongside a guided moment - opened/
  // closed every render from ui/renderGameView.ts based on whether a
  // TutorialHudConfig.lesson is present this pass.
  lessonOpen: boolean;
  lessonText: string;
  // Shown once Part 1's single scripted scene finishes (see
  // TutorialScene) - Scenes 2-6 aren't built yet, so this stands in for
  // an eventual real end-of-tutorial screen.
  completeOpen: boolean;
  onCompleteBackToMenu: () => void;
  // The top-of-screen scene selector + quit control - open for the
  // entire duration of a tutorial session (every render while
  // TutorialScene is active passes a fresh `scenes` snapshot, per
  // TutorialHudConfig's own doc comment in tutorial/tutorialTypes.ts),
  // not just during a guided wait step.
  topBarOpen: boolean;
  scenes: TutorialSceneMarker[];
  onSelectScene: (sceneNumber: number) => void;
  onQuit: () => void;
}

function idleState(): TutorialUiState {
  return {
    introOpen: false,
    onIntroDismiss: () => {},
    lessonOpen: false,
    lessonText: '',
    completeOpen: false,
    onCompleteBackToMenu: () => {},
    topBarOpen: false,
    scenes: [],
    onSelectScene: () => {},
    onQuit: () => {},
  };
}

let state: TutorialUiState = idleState();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): TutorialUiState {
  return state;
}

export function openTutorialIntro(onDismiss: () => void): void {
  state = { ...state, introOpen: true, onIntroDismiss: onDismiss };
  emit();
}

export function closeTutorialIntro(): void {
  if (!state.introOpen) return;
  state = { ...state, introOpen: false, onIntroDismiss: () => {} };
  emit();
}

export function openTutorialLesson(text: string): void {
  if (state.lessonOpen && state.lessonText === text) return;
  state = { ...state, lessonOpen: true, lessonText: text };
  emit();
}

export function closeTutorialLesson(): void {
  if (!state.lessonOpen) return;
  state = { ...state, lessonOpen: false, lessonText: '' };
  emit();
}

export function openTutorialComplete(onBackToMenu: () => void): void {
  state = { ...state, completeOpen: true, onCompleteBackToMenu: onBackToMenu };
  emit();
}

export function closeTutorialComplete(): void {
  if (!state.completeOpen) return;
  state = { ...state, completeOpen: false, onCompleteBackToMenu: () => {} };
  emit();
}

export function openTutorialTopBar(scenes: TutorialSceneMarker[], onSelectScene: (sceneNumber: number) => void, onQuit: () => void): void {
  state = { ...state, topBarOpen: true, scenes, onSelectScene, onQuit };
  emit();
}

export function closeTutorialTopBar(): void {
  if (!state.topBarOpen) return;
  state = { ...state, topBarOpen: false, scenes: [], onSelectScene: () => {}, onQuit: () => {} };
  emit();
}

// Resets every field to idle - called on TutorialScene shutdown so a
// second tutorial run (or navigating away mid-tutorial) never leaves a
// stale open flag behind for the next scene to trip over.
export function resetTutorialUi(): void {
  state = idleState();
  emit();
}
