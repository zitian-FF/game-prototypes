import { useSyncExternalStore } from 'react';
import { RulesModal } from './RulesModal';
import { RedistLogModal } from './RedistLogModal';
import { MenuModal } from './MenuModal';
import { VictoryModal } from './VictoryModal';
import { closeMenu, closeRedistLog, closeRules, getSnapshot, subscribe } from './domUiStore';
import { LobbyFlow } from './lobby/LobbyFlow';
import { getSnapshot as getLobbySnapshot, subscribe as subscribeLobby } from './lobby/lobbyUiStore';
import { GameOverlay } from './overlay/GameOverlay';
import { getSnapshot as getGameOverlaySnapshot, subscribe as subscribeGameOverlay } from './overlay/gameOverlayStore';
import { TutorialIntroModal } from './tutorial/TutorialIntroModal';
import { TutorialLessonBanner } from './tutorial/TutorialLessonBanner';
import { TutorialCompleteModal } from './tutorial/TutorialCompleteModal';
import { getSnapshot as getTutorialSnapshot, subscribe as subscribeTutorial } from './tutorial/tutorialUiStore';

// Single React root for suits-mp's whole DOM overlay layer (see
// mountDom.ts). Add future DOM chrome (React + Tailwind, per root
// CLAUDE.md's "UI implementation split") as siblings here rather than
// mounting a separate React root per component. Each piece of chrome
// (Rules modal, Lobby flow, ...) owns its own visibility store and is
// rendered independently - in practice at most one is visible at a time,
// since only one Phaser scene drives the game at once.
export function DomRoot(): JSX.Element {
  const {
    rulesOpen,
    closeRules: onClose,
    redistLogOpen,
    redistLogEntries,
    closeRedistLog: onCloseRedistLog,
    menuOpen,
    onMenuRules,
    onMenuPreviousTrick,
    closeMenu: onCloseMenu,
    victoryOpen,
    victoryTeamHeadline,
    victoryTrickNumber,
    victoryIdentities,
    onVictoryBackToMenu,
  } = useSyncExternalStore(subscribe, getSnapshot);
  const lobby = useSyncExternalStore(subscribeLobby, getLobbySnapshot);
  const gameOverlay = useSyncExternalStore(subscribeGameOverlay, getGameOverlaySnapshot);
  const tutorial = useSyncExternalStore(subscribeTutorial, getTutorialSnapshot);

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
      {redistLogOpen && (
        <RedistLogModal
          entries={redistLogEntries}
          onClose={() => {
            onCloseRedistLog();
            closeRedistLog();
          }}
        />
      )}
      {menuOpen && (
        <MenuModal
          onRules={onMenuRules}
          onPreviousTrick={onMenuPreviousTrick}
          onClose={() => {
            onCloseMenu();
            closeMenu();
          }}
        />
      )}
      {victoryOpen && (
        <VictoryModal
          teamHeadline={victoryTeamHeadline}
          trickNumber={victoryTrickNumber}
          identities={victoryIdentities}
          onBackToMenu={onVictoryBackToMenu}
        />
      )}
      {lobby.visible && (
        <LobbyFlow
          screen={lobby.screen}
          roomCode={lobby.roomCode}
          seats={lobby.seats}
          hostLeft={lobby.hostLeft}
          refreshCodeError={lobby.refreshCodeError}
          onSinglePlayer={lobby.onSinglePlayer}
          onTutorial={lobby.onTutorial}
          onHost={lobby.onHost}
          onSubmitJoin={lobby.onSubmitJoin}
          onFillBot={lobby.onFillBot}
          onReleaseBot={lobby.onReleaseBot}
          onStartGame={lobby.onStartGame}
          onRefreshCode={lobby.onRefreshCode}
          onBack={lobby.onBack}
          onRetry={lobby.onRetry}
        />
      )}
      {gameOverlay.visible && (
        <GameOverlay
          sortLabel={gameOverlay.sortLabel}
          onToggleSort={gameOverlay.onToggleSort}
          actionLabel={gameOverlay.actionLabel}
          actionHint={gameOverlay.actionHint}
          actionEnabled={gameOverlay.actionEnabled}
          onAction={gameOverlay.onAction}
          onOpenRedistLog={gameOverlay.onOpenRedistLog}
          onOpenMenu={gameOverlay.onOpenMenu}
          seatDelegate={gameOverlay.seatDelegate}
          seatLabels={gameOverlay.seatLabels}
          currentTurnSeat={gameOverlay.currentTurnSeat}
          starterSeat={gameOverlay.starterSeat}
          leadGodIndex={gameOverlay.leadGodIndex}
          teamName={gameOverlay.teamName}
          yourGodChip={gameOverlay.yourGodChip}
          teammateGodChip={gameOverlay.teammateGodChip}
        />
      )}
      {tutorial.introOpen && <TutorialIntroModal onDismiss={tutorial.onIntroDismiss} />}
      {tutorial.lessonOpen && <TutorialLessonBanner text={tutorial.lessonText} />}
      {tutorial.completeOpen && <TutorialCompleteModal onBackToMenu={tutorial.onCompleteBackToMenu} />}
    </>
  );
}
