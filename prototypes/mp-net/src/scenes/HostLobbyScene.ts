import Phaser from 'phaser';
import { createReconnectDebouncer, matchOrCreateRosterEntry } from 'mp-core';
import type { ReconnectDebouncer } from 'mp-core';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import { createNetworkRoom } from '../net/room';
import { createNetworkActions } from '../net/actions';
import { randomLobbyCode } from '../net/lobbyCode';
import { PIXEL_RATIO } from '../render/pixelRatio';
import tune from '../../tune.json';
import type { BootData } from '../net/playerSession';
import type { Roster, RosterEntry } from '../net/types';

const LANDSCAPE_WIDTH = 844;
const LANDSCAPE_HEIGHT = 390;
// Safety cap on the collision-retry loop (see Part 2 of BRIEF.md); with a
// 32-character, 5-slot alphabet a real collision run this long is not
// expected in practice, this just avoids ever hanging forever.
const MAX_CODE_ATTEMPTS = 5;

export class HostLobbyScene extends Phaser.Scene {
  private roster: Roster = new Map();
  private room!: ReturnType<typeof createNetworkRoom>;
  private actions!: ReturnType<typeof createNetworkActions>;
  private iceServers: RTCIceServer[] | undefined;
  private hostClientId!: string;
  private code!: string;
  private refreshing = false;

  private codeText!: Phaser.GameObjects.Text;
  private playerListText!: Phaser.GameObjects.Text;
  private refreshButton!: Phaser.GameObjects.Text;

  // Debounces roster removal on disconnect (mobile connections blip
  // constantly - see Part 4) and is cancelled if the same client ID
  // reappears before the timer fires. See packages/mp-core.
  private reconnectDebouncer: ReconnectDebouncer<RosterEntry> = createReconnectDebouncer(
    this.roster,
    tune.disconnectDebounceMs,
    () => this.renderRoster(),
  );

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

    this.hostClientId = data.clientId;

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
    this.iceServers = await data.iceServersPromise;

    let code = randomLobbyCode();
    let room = createNetworkRoom(code, { iceServers: this.iceServers });

    for (let attempt = 1; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const occupied = await this.checkOccupied(room);
      if (!occupied) break;
      await room.leave();
      code = randomLobbyCode();
      room = createNetworkRoom(code, { iceServers: this.iceServers });
    }

    if (!this.scene.isActive()) {
      // Scene was torn down (e.g. navigated away) while the async setup ran.
      void room.leave();
      return;
    }

    this.room = room;
    this.code = code;
    this.actions = createNetworkActions(room);
    this.roster.set(data.clientId, { clientId: data.clientId, peerId: 'host', counter: 0, isHost: true });

    statusText.destroy();
    this.buildLobbyUI();
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

  private buildLobbyUI(): void {
    const width = LANDSCAPE_WIDTH;

    this.add
      .text(width / 2, 24, 'mp-net host', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    this.codeText = this.add
      .text(width / 2, 56, `Room code: ${this.code}`, {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffd27a',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    this.makeCopyButton(width / 2 - 110, 100, '[ Copy code ]', () => this.code);
    this.makeCopyButton(width / 2 + 110, 100, '[ Copy invite link ]', () => this.inviteUrl());

    this.refreshButton = this.add
      .text(width / 2, 122, '[ Refresh code ]', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#88aaff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.refreshButton.on('pointerdown', () => void this.refreshRoomCode());

    this.add.text(30, 150, 'Players:', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
      resolution: PIXEL_RATIO,
    });

    this.playerListText = this.add.text(30, 172, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#eeeeee',
      lineSpacing: 5,
      resolution: PIXEL_RATIO,
    });

    const startButton = this.add
      .text(width / 2, LANDSCAPE_HEIGHT - 30, '[ Start Game ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#88ff88',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Presence alone counts as ready, and the host itself is always a
    // participant, so Start is available as soon as the lobby exists.
    startButton.on('pointerdown', () => {
      // Cancel any removals still pending debounce - once the game starts, a
      // disconnect preserves the roster slot instead (see Part 4/6 of
      // BRIEF.md), so nothing scheduled here should go on to delete it.
      this.reconnectDebouncer.clearAll();
      // HostGameScene owns room.onPeerLeave from here (it intentionally does
      // nothing - a mid-game disconnect preserves the slot for reconnect) so
      // this lobby-scoped handler doesn't keep running against a Map that's
      // no longer meant to lose entries.
      this.room.onPeerLeave = null;

      void this.actions.hostUI.send({ type: 'gameStarted' });
      this.scene.start('HostGame', {
        room: this.room,
        actions: this.actions,
        roster: this.roster,
        hostClientId: this.hostClientId,
      });
    });

    this.wireRoomHandlers();
    this.renderRoster();
  }

  private inviteUrl(): string {
    return `${location.origin}${location.pathname}?lobby=${this.code}`;
  }

  // (Re)wires the identity/peer-leave handlers onto whatever `this.room` /
  // `this.actions` currently are - split out so refreshRoomCode can call it
  // again after swapping in a new room.
  private wireRoomHandlers(): void {
    this.actions.identity.onMessage = (clientId, context) => {
      this.reconnectDebouncer.cancelPending(clientId);

      matchOrCreateRosterEntry(this.roster, clientId, context.peerId, () => ({
        clientId,
        peerId: context.peerId,
        counter: 0,
        isHost: false,
      }));

      void this.actions.hostUI.send({ type: 'lobbyJoined' }, { target: context.peerId });
      this.renderRoster();
    };

    this.room.onPeerLeave = (peerId) => {
      this.reconnectDebouncer.scheduleRemovalOnLeave(peerId, (entry) => entry.isHost);
    };
  }

  // Manual-only room-code refresh (no passive/background timer): first
  // tries to re-announce presence under the same code by leaving and
  // rejoining the Trystero room under that identical code (there is no
  // lower-level "reannounce" primitive exposed by Trystero's public API,
  // so a clean leave+rejoin is the closest equivalent) - if that code is
  // now occupied by someone else, falls back to generating a new one, same
  // rules as the initial host setup. Real peer connections don't survive a
  // room.leave() switch, so their roster entries are dropped (they'll need
  // to reconnect on the possibly-new code); only the host's own slot is
  // preserved.
  private async refreshRoomCode(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    this.refreshButton.setText('[ Refreshing... ]');
    this.refreshButton.disableInteractive();

    try {
      await this.room.leave();

      for (const [clientId, entry] of [...this.roster.entries()]) {
        if (!entry.isHost) this.roster.delete(clientId);
      }
      this.reconnectDebouncer.clearAll();

      let code = this.code;
      let room = createNetworkRoom(code, { iceServers: this.iceServers });
      let occupied = await this.checkOccupied(room);

      if (occupied) {
        await room.leave();
        for (let attempt = 1; attempt < MAX_CODE_ATTEMPTS; attempt++) {
          code = randomLobbyCode();
          room = createNetworkRoom(code, { iceServers: this.iceServers });
          occupied = await this.checkOccupied(room);
          if (!occupied) break;
          await room.leave();
        }
      }

      if (!this.scene.isActive()) {
        void room.leave();
        return;
      }

      this.room = room;
      this.code = code;
      this.actions = createNetworkActions(room);
      this.wireRoomHandlers();

      this.codeText.setText(`Room code: ${this.code}`);
      this.renderRoster();
    } finally {
      this.refreshing = false;
      if (this.scene.isActive()) {
        this.refreshButton.setText('[ Refresh code ]');
        this.refreshButton.setInteractive({ useHandCursor: true });
      }
    }
  }

  private renderRoster(): void {
    const lines = [...this.roster.values()].map(
      (entry) => `${shortId(entry.clientId)}${entry.isHost ? ' (You, Host)' : ''}`,
    );
    this.playerListText.setText(lines.join('\n'));
  }

  private makeCopyButton(x: number, y: number, label: string, getValue: () => string): Phaser.GameObjects.Text {
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
      void navigator.clipboard.writeText(getValue()).then(() => {
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
