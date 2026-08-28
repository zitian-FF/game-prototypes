import type { SeatPosition } from '../../ui/seating';

// Mirrors dom/domUiStore.ts's and dom/lobby/lobbyUiStore.ts's bridge
// pattern: the Phaser canvas (renderGameView.ts) still owns and computes
// real game state every render, and pushes just what this DOM chrome
// needs through here. Two different kinds of data travel through this
// bridge, deliberately: sortLabel/onToggleSort and actionLabel/
// actionEnabled/onAction are REAL (this task keeps the Order/Action
// controls functional - see GameOverlay.tsx's header comment), while the
// name tags/Suit Cycle HUD/turn wheel/Trick Starter tag stay internal
// placeholder state inside GameOverlay itself and read nothing from this
// store except seatDelegate (see below).
//
// seatDelegate is a narrow exception carrying real per-seat data: during
// the selectDelegate phase, tapping another seat's name tag is the real
// (and only) way to choose who performs a redistribution - dropping that
// interaction entirely (by making name tags purely decorative) would
// leave a real bot game stuck with no legal way to proceed past a double
// win. The tag's *displayed* name/starter-tag stays placeholder; only the
// tap target and its enabled/staged state are real.
export interface SeatDelegateState {
  tappable: boolean;
  staged: boolean;
  onPick: () => void;
}

const NOOP_SEAT_DELEGATE: SeatDelegateState = { tappable: false, staged: false, onPick: () => {} };

export interface GameOverlayUiState {
  visible: boolean;
  sortLabel: string;
  onToggleSort: () => void;
  actionLabel: string;
  actionHint: string;
  actionEnabled: boolean;
  onAction: () => void;
  seatDelegate: Record<SeatPosition, SeatDelegateState>;
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
