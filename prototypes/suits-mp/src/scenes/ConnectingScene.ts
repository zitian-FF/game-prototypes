import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { createNetworkRoom } from '../net/room';
import { createNetworkActions } from '../net/actions';
import { PIXEL_RATIO } from '../render/pixelRatio';
import tune from '../../tune.json';
import type { BootData, PlayerSessionData } from '../net/playerSession';

export interface ConnectingSceneData extends BootData {
  code: string;
}

type FailureOutcome = 'roomNotFound' | 'connectionFailed' | 'alreadyInProgress' | 'roomFull' | 'timeout';

const FAILURE_MESSAGES: Record<FailureOutcome, (code: string) => string> = {
  roomNotFound: (code) => `No host found on code ${code}.\nDouble-check the code and try again.`,
  connectionFailed: () =>
    "Connection failed even with TURN fallback.\nThis looks like a network issue on one side - retrying won't help.",
  alreadyInProgress: () => 'That game has already started.\nOnly existing participants can rejoin.',
  roomFull: () => 'That room is full (4/4 players).\nAsk the host for a different room.',
  timeout: () => 'Connection timed out.\nPlease try again.',
};

// Shared join-attempt flow for both manual code entry and a shared invite
// link - same underlying attempt regardless of how the code was obtained.
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

    const statusText = this.add
      .text(width / 2, height / 2 - 20, `Connecting to ${data.code}...`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#eeeeee',
        align: 'center',
        wordWrap: { width: width - 60 },
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    const backButton = this.add
      .text(width / 2, height / 2 + 70, '[ Back ]', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#88aaff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.start('Landing', { clientId: data.clientId, iceServersPromise: data.iceServersPromise });
    });

    let settled = false;
    let sawPeer = false;
    let room: ReturnType<typeof createNetworkRoom> | undefined;
    let actions: ReturnType<typeof createNetworkActions> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const fail = (outcome: FailureOutcome): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      void room?.leave();
      statusText.setText(FAILURE_MESSAGES[outcome](data.code));
      backButton.setVisible(true);
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

    void data.iceServersPromise.then((iceServers) => {
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
