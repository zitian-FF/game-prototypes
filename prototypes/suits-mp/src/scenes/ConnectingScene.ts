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
  displayName: string;
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

    // Everything from here on is real WebRTC/Trystero setup running on a
    // real device in the field, not just this repo's own dev sandbox - see
    // this file's own debugging notes below. Every step logs so a live
    // 2-device session's console tells the whole story without needing the
    // Network tab, and the whole chain is wrapped so a thrown exception
    // anywhere in it (getIceServers() itself, or synchronously inside
    // createNetworkRoom/createNetworkActions) surfaces as a real
    // 'connectionFailed' screen instead of leaving the busy "Crossing
    // over..." screen hung forever with only a silent, easy-to-miss
    // "Uncaught (in promise)" console entry - a class of bug found while
    // investigating exactly that reported hang (see BUILD_STATUS.md for
    // what could and couldn't be confirmed as the actual root cause without
    // a real device to reproduce on).
    console.log(`[suits-mp join] attempting code ${data.code}: fetching ICE servers...`);
    try {
      void data
        .getIceServers()
        .then((iceServers) => {
          console.log(
            `[suits-mp join] ICE servers resolved: ${iceServers ? `${iceServers.length} TURN/STUN server(s)` : 'none (STUN-only fallback)'}`,
          );
          if (settled) {
            console.log('[suits-mp join] already settled by the time ICE servers resolved - ignoring');
            return;
          }

          console.log(`[suits-mp join] creating room for code ${data.code}...`);
          const activeRoom = createNetworkRoom(data.code, {
            iceServers,
            onConnectionFailed: () => {
              console.warn('[suits-mp join] onConnectionFailed: WebRTC could not connect even with TURN fallback');
              fail('connectionFailed');
            },
          });
          // makeAction returns the same handle for a given namespace on
          // repeat calls, so PlayerLobby/PlayerGame reassigning
          // `.onMessage` on this same actions object later is what hands
          // the slot off from here.
          const activeActions = createNetworkActions(activeRoom);
          room = activeRoom;
          actions = activeActions;

          activeRoom.onPeerJoin = (peerId) => {
            console.log('[suits-mp join] onPeerJoin:', peerId);
            sawPeer = true;
            void activeActions.identity.send({ clientId: data.clientId, displayName: data.displayName }, { target: peerId });
          };

          activeActions.hostUI.onMessage = (message, context) => {
            console.log(`[suits-mp join] hostUI message "${message.type}" from ${context.peerId}`);
            if (message.type === 'lobbyJoined') succeed(false, context.peerId);
            else if (message.type === 'gameStarted') succeed(true, context.peerId);
            else if (message.type === 'alreadyInProgress') fail('alreadyInProgress');
            else if (message.type === 'roomFull') fail('roomFull');
          };

          timer = setTimeout(() => {
            console.warn(
              `[suits-mp join] timed out after ${tune.connectionTimeoutMs}ms (${sawPeer ? 'saw a peer, but no lobbyJoined/gameStarted reply' : 'never saw any peer at all'})`,
            );
            fail(sawPeer ? 'timeout' : 'roomNotFound');
          }, tune.connectionTimeoutMs);
        })
        .catch((err: unknown) => {
          console.error('[suits-mp join] unexpected error setting up the connection:', err);
          fail('connectionFailed');
        });
    } catch (err) {
      // Covers `data.getIceServers` throwing synchronously (e.g. not
      // actually a function by the time this scene runs) - a plain
      // `.then()/.catch()` chain can't catch that, since the exception
      // happens before a promise even exists to chain onto.
      console.error('[suits-mp join] getIceServers() threw synchronously:', err);
      fail('connectionFailed');
    }
  }
}
