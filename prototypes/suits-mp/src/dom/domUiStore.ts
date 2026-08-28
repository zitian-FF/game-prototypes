// Tiny external store bridging the Phaser canvas (which owns `PersistentUIState`
// / `ui.overlay`, see ui/renderGameView.ts) and the React DOM overlay layer
// mounted above it. The canvas side calls openRules()/closeRules() from its
// own render pass; RulesModal's close button calls back into the closure
// the canvas handed it, which flips `ui.overlay` back to 'none' and
// re-renders the canvas. Neither side reads the other's internals directly.

interface DomUiState {
  rulesOpen: boolean;
  closeRules: () => void;
}

let state: DomUiState = { rulesOpen: false, closeRules: () => {} };
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): DomUiState {
  return state;
}

export function openRules(onClose: () => void): void {
  if (state.rulesOpen && state.closeRules === onClose) return;
  state = { rulesOpen: true, closeRules: onClose };
  emit();
}

export function closeRules(): void {
  if (!state.rulesOpen) return;
  state = { rulesOpen: false, closeRules: () => {} };
  emit();
}
