import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import { createNetworkRoom } from '../net/room';
import { createNetworkActions } from '../net/actions';
import { randomLobbyCode } from '../net/lobbyCode';
import tune from '../../tune.json';
import type { BootData } from '../net/playerSession';
import type { Roster } from '../net/types';

const LANDSCAPE_WIDTH = 844;
const LANDSCAPE_HEIGHT = 390;
// Safety cap on the collision-retry loop (see Part 2 of BRIEF.md); with a
// 32-character, 5-slot alphabet a real collision run this long is not
// expected in practice, this just avoids ever hanging forever.
const MAX_CODE_ATTEMPTS = 5;

export class HostLobbyScene extends Phaser.Scene {
  private roster: Roster = new Map();

  constructor() {
    super('HostLobby');
  }

  create(data: BootData): void {
    addVersionStamp(this);
    this.scale.resize(LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT);
    createOrientationGuard(this, 'landscape');

    const statusText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Setting up room...', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#eeeeee',
      })
      .setOrigin(0.5);

    void this.setUpRoom(data, statusText);
  }

  private async setUpRoom(data: BootData, statusText: Phaser.GameObjects.Text): Promise<void> {
    const iceServers = await data.iceServersPromise;

    let code = randomLobbyCode();
    let room = createNetworkRoom(code, { iceServers });

    for (let attempt = 1; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const occupied = await this.checkOccupied(room);
      if (!occupied) break;
      await room.leave();
      code = randomLobbyCode();
      room = createNetworkRoom(code, { iceServers });
    }

    if (!this.scene.isActive()) {
      // Scene was torn down (e.g. navigated away) while the async setup ran.
      void room.leave();
      return;
    }

    const actions = createNetworkActions(room);
    this.roster.set(data.clientId, { clientId: data.clientId, peerId: 'host', counter: 0, isHost: true });

    statusText.destroy();
    this.buildLobbyUI(room, actions, code, data.clientId);
  }

  // Joins the room and waits a short window for any peer to announce
  // themselves - if one does, someone else is already hosting on this code.
  private checkOccupied(room: ReturnType<typeof createNetworkRoom>): Promise<boolean> {
    return new Promise((resolve) => {
      let occupied = false;
      room.onPeerJoin = () => {
        occupied = true;
      };
      setTimeout(() => resolve(occupied), tune.hostOccupancyCheckMs);
    });
  }

  private buildLobbyUI(
    room: ReturnType<typeof createNetworkRoom>,
    actions: ReturnType<typeof createNetworkActions>,
    code: string,
    hostClientId: string,
  ): void {
    const width = this.scale.width;

    this.add
      .text(width / 2, 24, 'mp-net host', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 60, `Room code: ${code}`, {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: '#ffd27a',
      })
      .setOrigin(0.5);

    const inviteUrl = `${location.origin}${location.pathname}?lobby=${code}`;

    this.makeCopyButton(width / 2 - 110, 110, '[ Copy code ]', code);
    this.makeCopyButton(width / 2 + 110, 110, '[ Copy invite link ]', inviteUrl);

    this.add.text(30, 150, 'Players:', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
    });

    const playerListText = this.add.text(30, 172, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#eeeeee',
      lineSpacing: 5,
    });

    const renderRoster = (): void => {
      const lines = [...this.roster.values()].map(
        (entry) => `${shortId(entry.clientId)}${entry.isHost ? ' (You, Host)' : ''}`,
      );
      playerListText.setText(lines.join('\n'));
    };
    renderRoster();

    const startButton = this.add
      .text(width / 2, this.scale.height - 30, '[ Start Game ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#88ff88',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Debounces roster removal on disconnect (mobile connections blip
    // constantly - see Part 4) and is cancelled if the same client ID
    // reappears before the timer fires.
    const pendingRemoval = new Map<string, ReturnType<typeof setTimeout>>();

    actions.identity.onMessage = (clientId, context) => {
      const pending = pendingRemoval.get(clientId);
      if (pending) {
        clearTimeout(pending);
        pendingRemoval.delete(clientId);
      }

      const existing = this.roster.get(clientId);
      if (existing) {
        existing.peerId = context.peerId;
      } else {
        this.roster.set(clientId, { clientId, peerId: context.peerId, counter: 0, isHost: false });
      }

      void actions.hostUI.send({ type: 'lobbyJoined' }, { target: context.peerId });
      renderRoster();
    };

    room.onPeerLeave = (peerId) => {
      for (const entry of this.roster.values()) {
        if (entry.peerId !== peerId || entry.isHost) continue;
        pendingRemoval.set(
          entry.clientId,
          setTimeout(() => {
            this.roster.delete(entry.clientId);
            pendingRemoval.delete(entry.clientId);
            renderRoster();
          }, tune.disconnectDebounceMs),
        );
        break;
      }
    };

    // Presence alone counts as ready, and the host itself is always a
    // participant, so Start is available as soon as the lobby exists.
    startButton.on('pointerdown', () => {
      void actions.hostUI.send({ type: 'gameStarted' });
      this.scene.start('HostGame', { room, actions, roster: this.roster, hostClientId });
    });
  }

  private makeCopyButton(x: number, y: number, label: string, value: string): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#88aaff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    button.on('pointerdown', () => {
      void navigator.clipboard.writeText(value).then(() => {
        const original = label;
        button.setText('[ Copied! ]');
        this.time.delayedCall(1200, () => button.setText(original));
      });
    });

    return button;
  }
}

function shortId(clientId: string): string {
  return clientId.slice(0, 8);
}
