import Phaser from 'phaser';
import { createReconnectDebouncer, matchOrCreateRosterEntry } from 'mp-core';
import type { ReconnectDebouncer } from 'mp-core';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { createNetworkRoom } from '../net/room';
import { createNetworkActions } from '../net/actions';
import { randomLobbyCode } from '../net/lobbyCode';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { ALL_NET_PLAYER_IDS } from '../net/netPlayerId';
import { showHostSettingUp, showHostLobby, hideHostLobby } from '../dom/lobby/lobbyUiStore';
import type { SeatOccupancy } from '../dom/lobby/lobbySeats';
import tune from '../../tune.json';
import type { BootData } from '../net/playerSession';
import { ROOM_CAPACITY } from '../net/types';
import type { NetPlayerId } from '../net/netPlayerId';
import type { Roster, RosterEntry } from '../net/types';

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

function rosterToSeats(roster: Roster): SeatOccupancy[] {
  return ALL_NET_PLAYER_IDS.map((slot) => {
    const entry = [...roster.values()].find((e) => e.slot === slot);
    if (!entry) return null;
    if (entry.isBot) return 'bot';
    return entry.isHost ? 'host' : 'peer';
  });
}

// Presentation comes entirely from the DOM Lobby flow (dom/lobby/LobbyFlow.tsx,
// mounted via lobbyUiStore) rather than Phaser primitives - see root
// CLAUDE.md's "UI implementation split". This scene keeps owning the real
// room/roster/reconnect lifecycle (room creation with collision retry,
// identity handshake, reconnect debounce, Start Game) and pushes its state
// into the DOM store on every change, rather than rendering it itself.
export class HostLobbyScene extends Phaser.Scene {
  private roster: Roster = new Map();
  private room!: ReturnType<typeof createNetworkRoom>;
  private actions!: ReturnType<typeof createNetworkActions>;
  private iceServers: RTCIceServer[] | undefined;
  private hostClientId!: string;
  private code!: string;
  private refreshing = false;

  // Debounces roster removal on disconnect (mobile connections blip
  // constantly) and is cancelled if the same client ID reappears before
  // the timer fires. See packages/mp-core.
  private reconnectDebouncer: ReconnectDebouncer<RosterEntry> = createReconnectDebouncer(
    this.roster,
    tune.disconnectDebounceMs,
    () => this.pushLobbyState(),
  );

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

    showHostSettingUp();
    // Phaser doesn't auto-call a `shutdown()` method on Scene subclasses
    // (only `Systems#shutdown`, which fires this event) - see
    // node_modules/phaser/src/scene/Systems.js.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, hideHostLobby);

    void this.setUpRoom(data);
  }

  private async setUpRoom(data: BootData): Promise<void> {
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

    this.wireRoomHandlers();
    this.pushLobbyState();
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

  private inviteUrl(): string {
    return `${location.origin}${location.pathname}?lobby=${this.code}`;
  }

  // (Re)wires the identity/peer-leave handlers onto whatever `this.room` /
  // `this.actions` currently are - split out so refreshRoomCode can call it
  // again after swapping in a new room.
  private wireRoomHandlers(): void {
    this.actions.identity.onMessage = (clientId, context) => {
      this.reconnectDebouncer.cancelPending(clientId);

      const result = matchOrCreateRosterEntry(this.roster, clientId, context.peerId, () => {
        if (this.roster.size >= ROOM_CAPACITY) return null;
        return {
          clientId,
          peerId: context.peerId,
          slot: nextAvailableSlot(this.roster),
          isHost: false,
        };
      });

      if (result.kind === 'rejected') {
        void this.actions.hostUI.send({ type: 'roomFull' }, { target: context.peerId });
        return;
      }

      void this.actions.hostUI.send({ type: 'lobbyJoined' }, { target: context.peerId });
      this.pushLobbyState();
    };

    this.room.onPeerLeave = (peerId) => {
      this.reconnectDebouncer.scheduleRemovalOnLeave(peerId, (entry) => entry.isHost);
    };
  }

  // Adds a host-local bot to the given (currently empty) slot - see
  // host/botAI.ts and HostGameScene.driveBotsIfNeeded for how `isBot`
  // drives it purely host-locally at game time, no network peer involved.
  private fillBot(slot: NetPlayerId): void {
    if ([...this.roster.values()].some((e) => e.slot === slot)) return;
    const clientId = `bot:${slot}`;
    this.roster.set(clientId, { clientId, peerId: 'bot', slot, isHost: false, isBot: true });
    this.pushLobbyState();
  }

  private releaseBot(slot: NetPlayerId): void {
    for (const [clientId, entry] of this.roster) {
      if (entry.slot === slot && entry.isBot) {
        this.roster.delete(clientId);
        break;
      }
    }
    this.pushLobbyState();
  }

  private startGame(): void {
    if (this.roster.size !== ROOM_CAPACITY) return;

    // Cancel any removals still pending debounce - once the game starts, a
    // disconnect preserves the roster slot instead, so nothing scheduled
    // here should go on to delete it.
    this.reconnectDebouncer.clearAll();
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
  // to reconnect on the possibly-new code); only the host's own slot and
  // any host-local bot slots survive.
  private async refreshRoomCode(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      await this.room.leave();

      for (const [clientId, entry] of [...this.roster.entries()]) {
        if (!entry.isHost && !entry.isBot) this.roster.delete(clientId);
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
      this.pushLobbyState();
    } finally {
      this.refreshing = false;
    }
  }

  private pushLobbyState(): void {
    showHostLobby(this.code, rosterToSeats(this.roster), {
      onFillBot: (i) => this.fillBot(ALL_NET_PLAYER_IDS[i]),
      onReleaseBot: (i) => this.releaseBot(ALL_NET_PLAYER_IDS[i]),
      onStartGame: () => this.startGame(),
      onRefreshCode: () => void this.refreshRoomCode(),
    });
  }
}
