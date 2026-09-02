import type { CardId } from '../rules/types';

// Tiny external store bridging the Phaser canvas (which owns `PersistentUIState`
// / `ui.overlay`, see ui/renderGameView.ts) and the React DOM overlay layer
// mounted above it. The canvas side calls openRules()/closeRules() and
// openRedistLog()/closeRedistLog() from its own render pass; each modal's
// close button calls back into the closure the canvas handed it, which
// flips `ui.overlay` back to 'none' and re-renders the canvas. Neither side
// reads the other's internals directly.

// Display-ready shape for one redistribution-log entry - computed from the
// real MaskedState/RedistributionLogEntry (see ui/renderGameView.ts's
// computeRedistLogEntries) so this DOM layer never needs to import
// game-state internals like playerLabelFor/MaskedState itself, matching
// every other piece of DOM chrome in this file (GameOverlayHudState, etc.).
export interface RedistLogGroup {
  toPlayerLabel: string;
  cards: CardId[];
}

export interface RedistLogEntry {
  trickNumber: number;
  perspective: 'received' | 'distributed';
  wonByDouble: boolean;
  fromPlayerLabel: string;
  groups: RedistLogGroup[];
}

interface DomUiState {
  rulesOpen: boolean;
  closeRules: () => void;
  redistLogOpen: boolean;
  redistLogEntries: RedistLogEntry[];
  closeRedistLog: () => void;
}

function idleState(): DomUiState {
  return {
    rulesOpen: false,
    closeRules: () => {},
    redistLogOpen: false,
    redistLogEntries: [],
    closeRedistLog: () => {},
  };
}

let state: DomUiState = idleState();
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
  state = { ...state, rulesOpen: true, closeRules: onClose };
  emit();
}

export function closeRules(): void {
  if (!state.rulesOpen) return;
  state = { ...state, rulesOpen: false, closeRules: () => {} };
  emit();
}

export function openRedistLog(entries: RedistLogEntry[], onClose: () => void): void {
  state = { ...state, redistLogOpen: true, redistLogEntries: entries, closeRedistLog: onClose };
  emit();
}

export function closeRedistLog(): void {
  if (!state.redistLogOpen) return;
  state = { ...state, redistLogOpen: false, redistLogEntries: [], closeRedistLog: () => {} };
  emit();
}
