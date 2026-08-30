import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { createNetworkRoom } from '../net/room';
import { createNetworkActions } from '../net/actions';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { showJoining, showJoinError, hideJoinFlow } from '../dom/lobby/lobbyUiStore';
import type { ErrorKind } from '../dom/lobby/lobbyContent';
import tune from '../../tune.json';
import type { BootData, PlayerSessionData } from '../net/playerSession';

export interface ConnectingSceneData extends BootData {
  code: string;
}

type FailureOutcome = 'roomNotFound' | 'connectionFailed' | 'alreadyInProgress' | 'roomFull' | 'timeout';

// Maps ConnectingScene's own outcome vocabulary onto the DOM Lobby flow's
// error screens (dom/lobby/lobbyContent.ts) - same 5 concepts, named
// differently on each side of that boundary.
const OUTCOME_TO_ERROR_KIND: Record<FailureOutcome, ErrorKind> = {
  roomNotFound: 'notFound',
  connectionFailed: 'connFailed',
  alreadyInProgress: 'inProgress',
  roomFull: 'roomFull',
  timeout: 'timeout',
};

// A transient failure is worth retrying against the exact same code
// immediately; the other three imply the code itself (or the room's state)
// needs to change, so their retry sends the player back to Landing to
// re-enter or reconsider instead.
const SAME_CODE_RETRY: ReadonlySet<FailureOutcome> = new Set(['connectionFailed', 'timeout']);

// Shared join-attempt flow for both manual code entry and a shared invite
// link - same underlying attempt regardless of how the code was obtained.
// Presentation comes entirely from the DOM Lobby flow (see root CLAUDE.md's
// "UI implementation split") rather than Phaser primitives - this scene's
// job is purely the real connection attempt and pushing its outcome into
// the DOM store.
export class ConnectingScene extends Phaser.Scene {
  constructor() {
    super('Connecting');
  }

  create(data: ConnectingSceneData): void {
    addVersionStamp(this);
    createPortraitGuard(this);
    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    const toLanding = (): void => {
      this.scene.start('Landing', { clientId: data.clientId, getIceServers: data.getIceServers });
    };

    let settled = false;
    let sawPeer = false;
    let room: ReturnType<typeof createNetworkRoom> | undefined;
    let actions: ReturnType<typeof createNetworkActions> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    showJoining(data.code, () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      void room?.leave();
      toLanding();
    });
    // Phaser doesn't auto-call a `shutdown()` method on Scene subclasses
    // (only `Systems#shutdown`, which fires this event) - see
    // node_modules/phaser/src/scene/Systems.js.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, hideJoinFlow);

    const fail = (outcome: FailureOutcome): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      void room?.leave();

      const retry = SAME_CODE_RETRY.has(outcome) ? () => this.scene.start('Connecting', data) : toLanding;
      showJoinError(OUTCOME_TO_ERROR_KIND[outcome], retry, toLanding);
    };

    const succeed = (toGameScreen: boolean, hostPeerId: string): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);

      const sessionData: PlayerSessionData = {
        room: room!,
        actions: actions!,
        clientId: data.clientId,
        lobbyCode: data.code,
        hostPeerId: { current: hostPeerId },
      };
      this.scene.start(toGameScreen ? 'PlayerGame' : 'PlayerLobby', sessionData);
    };

    void data.getIceServers().then((iceServers) => {
      if (settled) return;

      const activeRoom = createNetworkRoom(data.code, {
        iceServers,
        onConnectionFailed: () => fail('connectionFailed'),
      });
      // makeAction returns the same handle for a given namespace on repeat
      // calls, so PlayerLobby/PlayerGame reassigning `.onMessage` on this
      // same actions object later is what hands the slot off from here.
      const activeActions = createNetworkActions(activeRoom);
      room = activeRoom;
      actions = activeActions;

      activeRoom.onPeerJoin = (peerId) => {
        sawPeer = true;
        void activeActions.identity.send(data.clientId, { target: peerId });
      };

      activeActions.hostUI.onMessage = (message, context) => {
        if (message.type === 'lobbyJoined') succeed(false, context.peerId);
        else if (message.type === 'gameStarted') succeed(true, context.peerId);
        else if (message.type === 'alreadyInProgress') fail('alreadyInProgress');
        else if (message.type === 'roomFull') fail('roomFull');
      };

      timer = setTimeout(() => fail(sawPeer ? 'timeout' : 'roomNotFound'), tune.connectionTimeoutMs);
    });
  }
}
