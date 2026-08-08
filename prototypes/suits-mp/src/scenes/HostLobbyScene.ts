import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { createNetworkRoom } from '../net/room';
import { createNetworkActions } from '../net/actions';
import { randomLobbyCode } from '../net/lobbyCode';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { ALL_NET_PLAYER_IDS } from '../net/netPlayerId';
import tune from '../../tune.json';
import type { BootData } from '../net/playerSession';
import { ROOM_CAPACITY } from '../net/types';
import type { Roster } from '../net/types';

// Safety cap on the collision-retry loop; with a 32-character, 5-slot
// alphabet a real collision run this long is not expected in practice,
// this just avoids ever hanging forever.
const MAX_CODE_ATTEMPTS = 5;

function nextAvailableSlot(roster: Roster) {
  const taken = new Set([...roster.values()].map((e) => e.slot));
  const free = ALL_NET_PLAYER_IDS.find((slot) => !taken.has(slot));
  if (!free) throw new Error('no free slot (room is full)');
  return free;
}

export class HostLobbyScene extends Phaser.Scene {
  private roster: Roster = new Map();

  constructor() {
    super('HostLobby');
  }

  create(data: BootData): void {
    addVersionStamp(this);
    createPortraitGuard(this);

    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    const statusText = this.add
      .text(width / 2, height / 2, 'Setting up room...', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#eeeeee',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    void this.setUpRoom(data, statusText, width, height);
  }

  private async setUpRoom(
    data: BootData,
    statusText: Phaser.GameObjects.Text,
    width: number,
    height: number,
  ): Promise<void> {
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
    this.roster.set(data.clientId, { clientId: data.clientId, peerId: 'host', slot: 'p0', isHost: true });

    statusText.destroy();
    this.buildLobbyUI(room, actions, code, width, height);
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
    width: number,
    height: number,
  ): void {
    this.add
      .text(width / 2, 40, 'suits-mp host', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 80, `Room code: ${code}`, {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffd27a',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    const inviteUrl = `${location.origin}${location.pathname}?lobby=${code}`;

    this.makeCopyButton(width / 2 - 90, 130, '[ Copy code ]', code);
    this.makeCopyButton(width / 2 + 90, 130, '[ Copy invite link ]', inviteUrl);

    this.add.text(30, 180, `Players (need exactly ${ROOM_CAPACITY}):`, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
      resolution: PIXEL_RATIO,
    });

    const playerListText = this.add.text(30, 204, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#eeeeee',
      lineSpacing: 6,
      resolution: PIXEL_RATIO,
    });

    const startButton = this.add
      .text(width / 2, height - 60, '[ Start Game ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#88ff88',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    const updateStartButton = (): void => {
      const ready = this.roster.size === ROOM_CAPACITY;
      startButton.setAlpha(ready ? 1 : 0.4);
      if (ready) startButton.setInteractive({ useHandCursor: true });
      else startButton.disableInteractive();
    };

    const renderRoster = (): void => {
      const bySlot = [...this.roster.values()].sort((a, b) => a.slot.localeCompare(b.slot));
      const lines = bySlot.map((entry) => `${entry.slot}: ${shortId(entry.clientId)}${entry.isHost ? ' (You, Host)' : ''}`);
      playerListText.setText(lines.join('\n'));
      updateStartButton();
    };
    renderRoster();

    // Debounces roster removal on disconnect (mobile connections blip
    // constantly) and is cancelled if the same client ID reappears before
    // the timer fires.
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
        void actions.hostUI.send({ type: 'lobbyJoined' }, { target: context.peerId });
        renderRoster();
        return;
      }

      if (this.roster.size >= ROOM_CAPACITY) {
        void actions.hostUI.send({ type: 'roomFull' }, { target: context.peerId });
        return;
      }

      this.roster.set(clientId, { clientId, peerId: context.peerId, slot: nextAvailableSlot(this.roster), isHost: false });
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

    // Presence alone counts as ready; the host itself already occupies
    // slot p0. Start only enables once all 4 slots are filled (see
    // updateStartButton/renderRoster above) - if someone leaves pre-game
    // and the count drops below 4, it disables again automatically.
    startButton.on('pointerdown', () => {
      if (this.roster.size !== ROOM_CAPACITY) return;

      // Cancel any removals still pending debounce - once the game starts,
      // a disconnect preserves the roster slot instead, so nothing
      // scheduled here should go on to delete it.
      for (const timer of pendingRemoval.values()) clearTimeout(timer);
      pendingRemoval.clear();
      // HostGameScene owns room.onPeerLeave from here (a mid-game
      // disconnect preserves the slot for reconnect) so this lobby-scoped
      // handler doesn't keep running against a Map that's no longer meant
      // to lose entries.
      room.onPeerLeave = null;

      void actions.hostUI.send({ type: 'gameStarted' });
      this.scene.start('HostGame', { room, actions, roster: this.roster });
    });
  }

  private makeCopyButton(x: number, y: number, label: string, value: string): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '13px',
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
