import type { Screen, ErrorKind } from './lobbyContent';
import type { SeatInfo } from './lobbySeats';

// Mirrors dom/domUiStore.ts's bridge pattern (see that file's header
// comment), extended to carry the Lobby flow's real state: whichever real
// scene currently owns the flow (LandingScene, HostLobbyScene,
// ConnectingScene, PlayerLobbyScene) pushes its state in here on every
// change, and LobbyFlow.tsx renders it as a fully controlled component - it
// holds no screen/roomCode/seat state of its own (name-entry draft and the
// copy-to-clipboard toast are the only state it still owns locally, see
// LobbyFlow.tsx). Two purely-local screen transitions (Landing -> the join
// code-entry screen, and back) don't involve any scene/network action, so
// they're implemented as plain store mutations below (goToJoinScreen/
// goToLandingScreen) rather than routed through a scene.

export interface LobbyUiState {
  visible: boolean;
  screen: Screen;
  roomCode: string;
  seats: SeatInfo[];
  // Only meaningful while screen === 'waiting' (see showWaiting/
  // setWaitingHostLeft) - whether the host disconnected while this peer was
  // waiting in the lobby.
  hostLeft: boolean;
  // Only meaningful while screen === 'lobby' (see showHostLobbyRefreshError/
  // clearHostLobbyRefreshError) - whether the last room-code refresh attempt
  // threw. Surfaced as an inline message rather than navigating away, since
  // this is a user-initiated in-lobby retry, not a boot-time failure that
  // blocks the whole screen (compare showJoinError).
  refreshCodeError: boolean;
  onSinglePlayer: () => void;
  onHost: (name: string) => void;
  onSubmitJoin: (code: string, name: string) => void;
  onFillBot: (index: number) => void;
  onReleaseBot: (index: number) => void;
  onStartGame: () => void;
  onRefreshCode: () => void;
  // Used by both the busy screen's "Sever the thread" cancel button and the
  // error screen's secondary "Return to the threshold" button - both always
  // give up on the current attempt and go back to the Landing scene.
  onBack: () => void;
  // Error screen's primary button only - a smarter retry where one exists
  // (same-code reconnect for a transient failure), see ConnectingScene.
  onRetry: () => void;
}

const EMPTY_SEATS: SeatInfo[] = [
  { occupancy: null, displayName: '' },
  { occupancy: null, displayName: '' },
  { occupancy: null, displayName: '' },
  { occupancy: null, displayName: '' },
];

function noop(): void {}

function idleState(): LobbyUiState {
  return {
    visible: false,
    screen: 'landing',
    roomCode: '',
    seats: EMPTY_SEATS,
    hostLeft: false,
    refreshCodeError: false,
    onSinglePlayer: noop,
    onHost: noop,
    onSubmitJoin: noop,
    onFillBot: noop,
    onReleaseBot: noop,
    onStartGame: noop,
    onRefreshCode: noop,
    onBack: noop,
    onRetry: noop,
  };
}

let state: LobbyUiState = idleState();
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

// --- LandingScene -----------------------------------------------------

export function showLanding(
  onSinglePlayer: () => void,
  onHost: (name: string) => void,
  onSubmitJoin: (code: string, name: string) => void,
): void {
  state = { ...idleState(), visible: true, screen: 'landing', onSinglePlayer, onHost, onSubmitJoin };
  emit();
}

export function hideLanding(): void {
  if (!state.visible) return;
  state = idleState();
  emit();
}

// Pure local navigation - no scene/network involvement, so no scene needs
// to own these.
export function goToJoinScreen(): void {
  if (state.screen !== 'landing') return;
  state = { ...state, screen: 'join' };
  emit();
}

export function goToLandingScreen(): void {
  if (state.screen !== 'join') return;
  state = { ...state, screen: 'landing' };
  emit();
}

// --- HostLobbyScene -----------------------------------------------------

// Shown while setUpRoom's async ICE-fetch/collision-retry loop runs, before
// a room code exists yet.
export function showHostSettingUp(): void {
  state = { ...idleState(), visible: true, screen: 'joining', roomCode: '' };
  emit();
}

// No onBack: the design's 'lobby' screen has no leave-lobby affordance for
// the host (pre-existing gap in the mockup, not introduced by this wiring
// - see BUILD_STATUS.md).
export interface HostLobbyCallbacks {
  onFillBot: (index: number) => void;
  onReleaseBot: (index: number) => void;
  onStartGame: () => void;
  onRefreshCode: () => void;
}

export function showHostLobby(roomCode: string, seats: SeatInfo[], callbacks: HostLobbyCallbacks): void {
  state = { ...idleState(), visible: true, screen: 'lobby', roomCode, seats, ...callbacks };
  emit();
}

export function hideHostLobby(): void {
  if (!state.visible) return;
  state = idleState();
  emit();
}

// Set when refreshRoomCode's async sequence throws (see HostLobbyScene) -
// clears automatically the next time showHostLobby() runs (a successful
// refresh, or fillBot/releaseBot/identity churn in between), since that
// re-spreads idleState().
export function showHostLobbyRefreshError(): void {
  if (state.screen !== 'lobby') return;
  state = { ...state, refreshCodeError: true };
  emit();
}

// Called at the start of a fresh refresh attempt so a stale error from a
// previous attempt doesn't linger on screen through a new, still-in-flight
// one.
export function clearHostLobbyRefreshError(): void {
  if (state.screen !== 'lobby' || !state.refreshCodeError) return;
  state = { ...state, refreshCodeError: false };
  emit();
}

// --- ConnectingScene -----------------------------------------------------

export function showJoining(code: string, onCancel: () => void): void {
  state = { ...idleState(), visible: true, screen: 'joining', roomCode: code, onBack: onCancel };
  emit();
}

export function showJoinError(kind: ErrorKind, onRetry: () => void, onBack: () => void): void {
  state = { ...idleState(), visible: true, screen: kind, onRetry, onBack };
  emit();
}

export function hideJoinFlow(): void {
  if (!state.visible) return;
  state = idleState();
  emit();
}

// --- PlayerLobbyScene -----------------------------------------------------

// A connected peer waiting for the host to start. No live seat list here:
// the host doesn't currently broadcast roster/seat state to joined peers
// during the lobby phase (only the lobbyJoined/gameStarted/roomFull/
// alreadyInProgress signals) - adding that broadcast is a bigger, separate
// piece of networking surface than this screen needs, see BUILD_STATUS.md.
export function showWaiting(): void {
  state = { ...idleState(), visible: true, screen: 'waiting', hostLeft: false };
  emit();
}

// The host's connection dropped while this peer was waiting - flips a flag
// on the same 'waiting' screen rather than transitioning anywhere, since
// per the existing (pre-this-brief) behavior this is a terminal state, not
// a retryable failure.
export function setWaitingHostLeft(): void {
  if (state.screen !== 'waiting') return;
  state = { ...state, hostLeft: true };
  emit();
}

export function hideWaiting(): void {
  if (!state.visible) return;
  state = idleState();
  emit();
}
