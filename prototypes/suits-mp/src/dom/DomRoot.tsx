import { useSyncExternalStore } from 'react';
import { RulesModal } from './RulesModal';
import { closeRules, getSnapshot, subscribe } from './domUiStore';
import { LobbyFlow } from './lobby/LobbyFlow';
import { getSnapshot as getLobbySnapshot, subscribe as subscribeLobby } from './lobby/lobbyUiStore';
import { GameOverlay } from './overlay/GameOverlay';
import { getSnapshot as getGameOverlaySnapshot, subscribe as subscribeGameOverlay } from './overlay/gameOverlayStore';

// Single React root for suits-mp's whole DOM overlay layer (see
// mountDom.ts). Add future DOM chrome (React + Tailwind, per root
// CLAUDE.md's "UI implementation split") as siblings here rather than
// mounting a separate React root per component. Each piece of chrome
// (Rules modal, Lobby flow, ...) owns its own visibility store and is
// rendered independently - in practice at most one is visible at a time,
// since only one Phaser scene drives the game at once.
export function DomRoot(): JSX.Element {
  const { rulesOpen, closeRules: onClose } = useSyncExternalStore(subscribe, getSnapshot);
  const { visible: lobbyVisible, onSinglePlayer } = useSyncExternalStore(subscribeLobby, getLobbySnapshot);
  const gameOverlay = useSyncExternalStore(subscribeGameOverlay, getGameOverlaySnapshot);

  return (
    <>
      {rulesOpen && (
        <RulesModal
          onClose={() => {
            onClose();
            closeRules();
          }}
        />
      )}
      {lobbyVisible && <LobbyFlow onSinglePlayer={onSinglePlayer} />}
      {gameOverlay.visible && (
        <GameOverlay
          sortLabel={gameOverlay.sortLabel}
          onToggleSort={gameOverlay.onToggleSort}
          actionLabel={gameOverlay.actionLabel}
          actionHint={gameOverlay.actionHint}
          actionEnabled={gameOverlay.actionEnabled}
          onAction={gameOverlay.onAction}
          seatDelegate={gameOverlay.seatDelegate}
        />
      )}
    </>
  );
}
