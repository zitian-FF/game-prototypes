// Mirrors dom/domUiStore.ts's bridge pattern (see that file's header
// comment), but for LandingScene showing/hiding the DOM Lobby flow
// instead of the canvas Rules overlay.

interface LobbyUiState {
  visible: boolean;
  onSinglePlayer: () => void;
}

let state: LobbyUiState = { visible: false, onSinglePlayer: () => {} };
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): LobbyUiState {
  return state;
}

export function showLanding(onSinglePlayer: () => void): void {
  state = { visible: true, onSinglePlayer };
  emit();
}

export function hideLanding(): void {
  if (!state.visible) return;
  state = { visible: false, onSinglePlayer: () => {} };
  emit();
}
