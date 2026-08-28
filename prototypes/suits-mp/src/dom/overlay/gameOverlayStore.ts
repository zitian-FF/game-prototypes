import type { SeatPosition } from '../../ui/seating';

// Mirrors dom/domUiStore.ts's and dom/lobby/lobbyUiStore.ts's bridge
// pattern: the Phaser canvas (renderGameView.ts) still owns and computes
// real game state every render, and pushes just what this DOM chrome
// needs through here as plain display-ready values - GameOverlay.tsx
// itself has no game-domain logic, only rendering + rotation bookkeeping.
//
// seatDelegate carries the one interactive exception noted in
// GameOverlay.tsx's header comment: during the selectDelegate phase,
// tapping another seat's name tag is the real (and only) way to choose
// who performs a redistribution.
export interface SeatDelegateState {
  tappable: boolean;
  staged: boolean;
  onPick: () => void;
}

export interface GodChipState {
  code: string;
  label: string;
}

const NOOP_SEAT_DELEGATE: SeatDelegateState = { tappable: false, staged: false, onPick: () => {} };
const BLANK_CHIP: GodChipState = { code: '', label: '' };

export interface GameOverlayUiState {
  visible: boolean;
  sortLabel: string;
  onToggleSort: () => void;
  actionLabel: string;
  actionHint: string;
  actionEnabled: boolean;
  onAction: () => void;
  seatDelegate: Record<SeatPosition, SeatDelegateState>;
  // Real per-seat "P1"/"P2 (You)"/etc labels (seatLabelFor + the local
  // seat's "(You)" suffix) - the only "name" this codebase actually has;
  // there is no real player-nickname data anywhere in MaskedState/Roster.
  seatLabels: Record<SeatPosition, string>;
  // Null when indeterminate (e.g. between tricks, or an opponent is about
  // to lead but hasn't committed yet) - GameOverlay freezes the turn
  // wheel/Suit Cycle HUD/Trick Starter tag at their last real value
  // rather than snapping to a default in that case.
  currentTurnSeat: SeatPosition | null;
  starterSeat: SeatPosition | null;
  leadGodIndex: number | null;
  teamName: string;
  yourGodChip: GodChipState;
  teammateGodChip: GodChipState;
}

const HIDDEN_STATE: GameOverlayUiState = {
  visible: false,
  sortLabel: '',
  onToggleSort: () => {},
  actionLabel: '',
  actionHint: '',
  actionEnabled: false,
  onAction: () => {},
  seatDelegate: { top: NOOP_SEAT_DELEGATE, right: NOOP_SEAT_DELEGATE, bottom: NOOP_SEAT_DELEGATE, left: NOOP_SEAT_DELEGATE },
  seatLabels: { top: '', right: '', bottom: '', left: '' },
  currentTurnSeat: null,
  starterSeat: null,
  leadGodIndex: null,
  teamName: '',
  yourGodChip: BLANK_CHIP,
  teammateGodChip: BLANK_CHIP,
};

let state: GameOverlayUiState = HIDDEN_STATE;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): GameOverlayUiState {
  return state;
}

export function showGameOverlay(data: Omit<GameOverlayUiState, 'visible'>): void {
  state = { ...data, visible: true };
  emit();
}

export function hideGameOverlay(): void {
  if (!state.visible) return;
  state = HIDDEN_STATE;
  emit();
}
