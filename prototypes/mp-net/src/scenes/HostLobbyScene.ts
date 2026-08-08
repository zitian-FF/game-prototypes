import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import { createNetworkRoom } from '../net/room';
import { createNetworkActions } from '../net/actions';
import { randomLobbyCode } from '../net/lobbyCode';
import { PIXEL_RATIO } from '../render/pixelRatio';
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
    // scale.resize() is documented as NONE-mode-only: it resizes the canvas
    // but leaves the FIT-mode aspect ratio locked to the initial portrait
    // config, so the browser keeps CSS-fitting this landscape content as if
    // it were still 390x844 (stretched/cropped instead of a small centered
    // landscape box). setGameSize() is the scale-mode-aware equivalent - it
    // additionally updates that locked aspect ratio to match.
    this.scale.setGameSize(LANDSCAPE_WIDTH * PIXEL_RATIO, LANDSCAPE_HEIGHT * PIXEL_RATIO);
    createOrientationGuard(this, 'landscape');

    this.cameras.main.setZoom(PIXEL_RATIO);
    this.cameras.main.centerOn(LANDSCAPE_WIDTH / 2, LANDSCAPE_HEIGHT / 2);

    const statusText = this.add
      .text(LANDSCAPE_WIDTH / 2, LANDSCAPE_HEIGHT / 2, 'Setting up room...', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#eeeeee',
        resolution: PIXEL_RATIO,
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
    const width = LANDSCAPE_WIDTH;

    this.add
      .text(width / 2, 24, 'mp-net host', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 60, `Room code: ${code}`, {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: '#ffd27a',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    const inviteUrl = `${location.origin}${location.pathname}?lobby=${code}`;

    this.makeCopyButton(width / 2 - 110, 110, '[ Copy code ]', code);
    this.makeCopyButton(width / 2 + 110, 110, '[ Copy invite link ]', inviteUrl);

    this.add.text(30, 150, 'Players:', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
      resolution: PIXEL_RATIO,
    });

    const playerListText = this.add.text(30, 172, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#eeeeee',
      lineSpacing: 5,
      resolution: PIXEL_RATIO,
    });

    const renderRoster = (): void => {
      const lines = [...this.roster.values()].map(
        (entry) => `${shortId(entry.clientId)}${entry.isHost ? ' (You, Host)' : ''}`,
      );
      playerListText.setText(lines.join('\n'));
    };
    renderRoster();

    const startButton = this.add
      .text(width / 2, LANDSCAPE_HEIGHT - 30, '[ Start Game ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#88ff88',
        resolution: PIXEL_RATIO,
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
      // Cancel any removals still pending debounce - once the game starts, a
      // disconnect preserves the roster slot instead (see Part 4/6 of
      // BRIEF.md), so nothing scheduled here should go on to delete it.
      for (const timer of pendingRemoval.values()) clearTimeout(timer);
      pendingRemoval.clear();
      // HostGameScene owns room.onPeerLeave from here (it intentionally does
      // nothing - a mid-game disconnect preserves the slot for reconnect) so
      // this lobby-scoped handler doesn't keep running against a Map that's
      // no longer meant to lose entries.
      room.onPeerLeave = null;

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
        resolution: PIXEL_RATIO,
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
