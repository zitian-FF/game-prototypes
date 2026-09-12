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

// Display-ready shape for one Victory Screen identity row (see
// ui/renderGameView.ts's showVictoryScreen) - resolved player label plus
// revealed god display name, same "resolve game-state internals on the
// canvas side, hand this DOM layer only plain strings" convention every
// other piece of chrome in this file already follows.
export interface VictoryIdentity {
  label: string;
  godDisplayName: string;
}

interface DomUiState {
  rulesOpen: boolean;
  closeRules: () => void;
  redistLogOpen: boolean;
  redistLogEntries: RedistLogEntry[];
  closeRedistLog: () => void;
  menuOpen: boolean;
  onMenuRules: () => void;
  onMenuPreviousTrick: () => void;
  closeMenu: () => void;
  victoryOpen: boolean;
  victoryTeamHeadline: string;
  victoryTrickNumber: number;
  victoryIdentities: VictoryIdentity[];
  onVictoryBackToMenu: () => void;
}

function idleState(): DomUiState {
  return {
    rulesOpen: false,
    closeRules: () => {},
    redistLogOpen: false,
    redistLogEntries: [],
    closeRedistLog: () => {},
    menuOpen: false,
    onMenuRules: () => {},
    onMenuPreviousTrick: () => {},
    closeMenu: () => {},
    victoryOpen: false,
    victoryTeamHeadline: '',
    victoryTrickNumber: 0,
    victoryIdentities: [],
    onVictoryBackToMenu: () => {},
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

export function openMenu(onRules: () => void, onPreviousTrick: () => void, onClose: () => void): void {
  state = { ...state, menuOpen: true, onMenuRules: onRules, onMenuPreviousTrick: onPreviousTrick, closeMenu: onClose };
  emit();
}

export function closeMenu(): void {
  if (!state.menuOpen) return;
  state = { ...state, menuOpen: false, onMenuRules: () => {}, onMenuPreviousTrick: () => {}, closeMenu: () => {} };
  emit();
}

// Opened exactly once per game, right as the canvas side's own white-in
// (camera.fadeIn) begins - see showVictoryScreen. No corresponding
// canvas-driven close: the only way off this screen is its own Back to
// Menu button, which navigates away (scene.start('Landing', ...)) rather
// than closing this overlay in place.
export function openVictory(teamHeadline: string, trickNumber: number, identities: VictoryIdentity[], onBackToMenu: () => void): void {
  state = { ...state, victoryOpen: true, victoryTeamHeadline: teamHeadline, victoryTrickNumber: trickNumber, victoryIdentities: identities, onVictoryBackToMenu: onBackToMenu };
  emit();
}

export function closeVictory(): void {
  if (!state.victoryOpen) return;
  state = { ...state, victoryOpen: false, victoryTeamHeadline: '', victoryTrickNumber: 0, victoryIdentities: [], onVictoryBackToMenu: () => {} };
  emit();
}
