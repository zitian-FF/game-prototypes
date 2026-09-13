import type { CardId, ForcedDeal, PlayerId } from '../rules/types';
import type { ClientAction } from '../net/actions';
import type { NetPlayerId } from '../net/netPlayerId';

// Extends the existing ForcedDeal pattern (rules/types.ts, used by
// rules/engine.ts's initGame) from "a forced starting deal" to "a forced
// starting deal plus a scripted sequence of actions across the scene" -
// per suits-mp-tutorial-design.md's Section 1.2. `deal` still goes through
// initGame() exactly as any other ForcedDeal would (so the local player's
// own hand/god/leader assignment is real, valid game data the real rules
// engine operates on identically to a normal game); `steps` is new.
//
// Every step's action - local or scripted-remote - is dispatched through
// the exact same host/gameHost.ts `applyAction` a real peer's action would
// go through (see TutorialScene), so trick resolution, rank comparison,
// and Powered/Dormant determination all run for real, never faked. This
// does mean every seat's scripted cards must currently be genuinely legal
// (in the real holder's hand, matching required suit, etc.) for
// `applyAction` to accept them - the design doc's "fully fabricated/non-
// deck-constrained" remote data is NOT yet supported as a bypass-legality
// path. Scene 1 doesn't need that (its remote plays are ordinary legal
// follows), so this is a known, called-out gap for whichever later scene
// first needs genuinely invalid remote data - see BUILD_STATUS.md.
export interface TutorialScript {
  deal: ForcedDeal;
  steps: TutorialStep[];
}

// Auto-played by the tutorial itself, standing in for a remote seat's
// "move" - dispatched with a real delay so the existing card-play travel
// animation has time to read, exactly as a real bot/peer turn would.
export interface TutorialAutoStep {
  kind: 'auto';
  forSlot: PlayerId;
  action: ClientAction;
  delayMs: number;
}

// Waits for the local player to submit exactly `allowedAction` - every
// other otherwise-legal option is hard-locked out for the duration (see
// applyTutorialLock in ui/renderGameView.ts). `lock` is what the hard-lock
// gate actually disables against; `pointer` is what the guide pointer
// points at meanwhile; `lesson` is the callout text shown alongside it.
export interface TutorialWaitStep {
  kind: 'wait';
  allowedAction: ClientAction;
  lock: TutorialLock;
  pointer: GuidePointerTarget;
  lesson: string;
}

export type TutorialStep = TutorialAutoStep | TutorialWaitStep;

// One entry in a scripted redistribution plan: this specific card goes to
// this specific seat. A whole plan (see TutorialLock/GuidePointerTarget's
// own 'redistributeAssignments' variant below) is a list of these, one per
// real contributor - ui/renderGameView.ts resolves *which one* is next
// live, every render, from the real assignedIds/stagedId the ordinary
// redistribution UI already tracks (never a separate tutorial-only
// progress counter), so it naturally advances as the player actually
// redistributes for real.
export interface TutorialRedistributeAssignment {
  cardId: CardId;
  toPlayer: NetPlayerId;
}

// What the hard-lock gate restricts. 'handCard' (Scene 1) and
// 'redistributeAssignments' (Scene 2) are both implemented -
// 'delegateTo'/'actionButton' are still just reserved shapes for
// Scenes 3/6 (delegate-selection seat targets, a bare confirm tap with
// no card selection involved) so the union doesn't need reshaping again
// later - see BUILD_STATUS.md.
export type TutorialLock =
  | { kind: 'handCard'; cardId: CardId }
  | { kind: 'redistributeAssignments'; assignments: TutorialRedistributeAssignment[] }
  | { kind: 'delegateTo'; toPlayer: NetPlayerId }
  | { kind: 'actionButton' };

// What the guide pointer points at. 'handCard' and 'redistributeAssignments'
// are both resolved to a real screen position today (the former via
// PersistentUIState.lastHandLayoutsByCardId; the latter resolves to
// either a hand card's position or a seat's position depending on how
// far the player has actually progressed - see
// ui/renderGameView.ts's nextTutorialRedistributeTarget). 'seat' is a
// plain, static single-seat point (used internally by
// 'redistributeAssignments', and reserved standalone for a future
// delegate-selection scene); 'actionButton' is still a reserved shape
// nothing resolves yet - see BUILD_STATUS.md.
export type GuidePointerTarget =
  | { kind: 'handCard'; cardId: CardId }
  | { kind: 'redistributeAssignments'; assignments: TutorialRedistributeAssignment[] }
  | { kind: 'seat'; slot: NetPlayerId }
  | { kind: 'actionButton' };

// One scene marker in the top-of-screen scene selector (see
// dom/tutorial/TutorialTopBar.tsx) - 'locked' scenes aren't reachable yet
// (not completed, and not the scene currently in progress), 'current' is
// the scene in progress right now (tappable - re-runs it from the
// start), 'completed' scenes show a checkmark and are also tappable
// (jump back and re-run). `sceneNumber` is 1-based, matching what's
// actually shown to the player.
export type TutorialSceneStatus = 'locked' | 'current' | 'completed';

export interface TutorialSceneMarker {
  sceneNumber: number;
  status: TutorialSceneStatus;
}

// Threaded optionally through renderGameView.ts's presentGameView/
// renderGameView/renderWithView, layered on top of the real legality/
// render pipeline rather than replacing any of it - undefined/null on
// every real (non-tutorial) call site, so this has zero effect on normal
// gameplay. `lock`/`pointer`/`lesson` are only ever non-null while a
// TutorialWaitStep is the active step (auto steps and the gap between
// scenes pass null for those three - nothing to lock or point at while
// it's not the local player's real turn anyway); `scenes`/`onSelectScene`/
// `onQuit` are populated on every tutorial render regardless of step
// kind, since the scene selector and quit control must stay reachable
// throughout a scene, not just during a guided wait.
export interface TutorialHudConfig {
  lock: TutorialLock | null;
  pointer: GuidePointerTarget | null;
  lesson: string | null;
  scenes: TutorialSceneMarker[];
  onSelectScene: (sceneNumber: number) => void;
  onQuit: () => void;
}
