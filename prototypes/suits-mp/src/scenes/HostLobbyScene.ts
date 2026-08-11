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
  private room!: ReturnType<typeof createNetworkRoom>;
  private actions!: ReturnType<typeof createNetworkActions>;
  private iceServers: RTCIceServer[] | undefined;
  private hostClientId!: string;
  private code!: string;
  private refreshing = false;

  private codeText!: Phaser.GameObjects.Text;
  private playerListText!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Text;
  private refreshButton!: Phaser.GameObjects.Text;
  private copyCodeButton!: Phaser.GameObjects.Text;
  private copyInviteButton!: Phaser.GameObjects.Text;

  // Debounces roster removal on disconnect (mobile connections blip
  // constantly) and is cancelled if the same client ID reappears before
  // the timer fires.
  private pendingRemoval = new Map<string, ReturnType<typeof setTimeout>>();

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

    this.hostClientId = data.clientId;

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
    this.iceServers = await data.getIceServers();

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
    this.roster.set(data.clientId, { clientId: data.clientId, peerId: 'host', slot: 'p0', isHost: true });

    statusText.destroy();
    this.buildLobbyUI(width, height);
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

  private buildLobbyUI(width: number, height: number): void {
    this.add
      .text(width / 2, 40, 'suits-mp host', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    this.codeText = this.add
      .text(width / 2, 80, `Room code: ${this.code}`, {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#ffd27a',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    this.copyCodeButton = this.makeCopyButton(width / 2 - 100, 128, '[ Copy code ]', () => this.code);
    this.copyInviteButton = this.makeCopyButton(width / 2 + 100, 128, '[ Copy invite link ]', () => this.inviteUrl());

    this.refreshButton = this.add
      .text(width / 2, 156, '[ Refresh code ]', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#88aaff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.refreshButton.on('pointerdown', () => void this.refreshRoomCode());

    this.add.text(30, 190, `Players (need exactly ${ROOM_CAPACITY}):`, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
      resolution: PIXEL_RATIO,
    });

    this.playerListText = this.add.text(30, 214, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#eeeeee',
      lineSpacing: 6,
      resolution: PIXEL_RATIO,
    });

    this.startButton = this.add
      .text(width / 2, height - 60, '[ Start Game ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#88ff88',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);
    this.startButton.on('pointerdown', () => this.startGame());

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
      const pending = this.pendingRemoval.get(clientId);
      if (pending) {
        clearTimeout(pending);
        this.pendingRemoval.delete(clientId);
      }

      const existing = this.roster.get(clientId);
      if (existing) {
        existing.peerId = context.peerId;
        void this.actions.hostUI.send({ type: 'lobbyJoined' }, { target: context.peerId });
        this.renderRoster();
        return;
      }

      if (this.roster.size >= ROOM_CAPACITY) {
        void this.actions.hostUI.send({ type: 'roomFull' }, { target: context.peerId });
        return;
      }

      this.roster.set(clientId, {
        clientId,
        peerId: context.peerId,
        slot: nextAvailableSlot(this.roster),
        isHost: false,
      });
      void this.actions.hostUI.send({ type: 'lobbyJoined' }, { target: context.peerId });
      this.renderRoster();
    };

    this.room.onPeerLeave = (peerId) => {
      for (const entry of this.roster.values()) {
        if (entry.peerId !== peerId || entry.isHost) continue;
        this.pendingRemoval.set(
          entry.clientId,
          setTimeout(() => {
            this.roster.delete(entry.clientId);
            this.pendingRemoval.delete(entry.clientId);
            this.renderRoster();
          }, tune.disconnectDebounceMs),
        );
        break;
      }
    };
  }

  private startGame(): void {
    if (this.roster.size !== ROOM_CAPACITY) return;

    // Cancel any removals still pending debounce - once the game starts, a
    // disconnect preserves the roster slot instead, so nothing scheduled
    // here should go on to delete it.
    for (const timer of this.pendingRemoval.values()) clearTimeout(timer);
    this.pendingRemoval.clear();
    // HostGameScene owns room.onPeerLeave from here (a mid-game disconnect
    // preserves the slot for reconnect) so this lobby-scoped handler
    // doesn't keep running against a Map that's no longer meant to lose
    // entries.
    this.room.onPeerLeave = null;

    void this.actions.hostUI.send({ type: 'gameStarted' });
    this.scene.start('HostGame', { room: this.room, actions: this.actions, roster: this.roster });
  }

  // Manual-only room-code refresh (no passive/background timer): first
  // tries to re-announce presence under the same code by leaving and
  // rejoining the Trystero room under that identical code (there is no
  // lower-level "reannounce" primitive exposed by Trystero's public API,
  // so a clean leave+rejoin is the closest equivalent) - if that code is
  // now occupied by someone else, falls back to generating a new one, same
  // rules as the initial host setup. Real peer connections don't survive a
  // room.leave() switch, so their roster entries are dropped (they'll need
  // to reconnect on the possibly-new code); only the host's own slot
  // survives.
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
      for (const timer of this.pendingRemoval.values()) clearTimeout(timer);
      this.pendingRemoval.clear();

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
    const bySlot = [...this.roster.values()].sort((a, b) => a.slot.localeCompare(b.slot));
    const lines = bySlot.map((entry) => `${entry.slot}: ${shortId(entry.clientId)}${entry.isHost ? ' (You, Host)' : ''}`);
    this.playerListText.setText(lines.join('\n'));

    const ready = this.roster.size === ROOM_CAPACITY;
    this.startButton.setAlpha(ready ? 1 : 0.4);
    if (ready) this.startButton.setInteractive({ useHandCursor: true });
    else this.startButton.disableInteractive();
  }

  private makeCopyButton(x: number, y: number, label: string, getValue: () => string): Phaser.GameObjects.Text {
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
