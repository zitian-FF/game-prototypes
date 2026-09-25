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
import { shuffleRosterSeats } from '../net/shuffleSeats';
import { showHostSettingUp, showHostLobby, hideHostLobby } from '../uiState/lobby/lobbyUiStore';
import type { SeatInfo } from '../uiState/lobby/lobbySeats';
import tune from '../../tune.json';
import type { BootData } from '../net/playerSession';
import { ROOM_CAPACITY } from '../net/types';
import type { NetPlayerId } from '../net/netPlayerId';
import type { Roster, RosterEntry } from '../net/types';

export interface HostLobbyData extends BootData {
  displayName: string;
}

// Short codes make collisions possible. Check every candidate before showing
// it, and cap retries so room setup cannot hang indefinitely.
const MAX_CODE_ATTEMPTS = 5;

function nextAvailableSlot(roster: Roster) {
  const taken = new Set([...roster.values()].map((e) => e.slot));
  const free = ALL_NET_PLAYER_IDS.find((slot) => !taken.has(slot));
  if (!free) throw new Error('no free slot (room is full)');
  return free;
}

function rosterToSeats(roster: Roster): SeatInfo[] {
  return ALL_NET_PLAYER_IDS.map((slot) => {
    const entry = [...roster.values()].find((e) => e.slot === slot);
    if (!entry) return { occupancy: null, displayName: '' };
    const occupancy = entry.isBot ? 'bot' : entry.isHost ? 'host' : 'peer';
    return { occupancy, displayName: entry.displayName };
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
  private starting = false;

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

  create(data: HostLobbyData): void {
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

    // `setUpRoom` is async and was previously fired-and-forgotten
    // (`void this.setUpRoom(data)` with no `.catch()`) - any exception
    // thrown inside it (getIceServers() itself, or synchronously inside
    // createNetworkRoom) would silently reject and leave the "Setting up
    // room..." busy screen hung forever with no visible error, the same
    // class of bug found and fixed in ConnectingScene's join flow (see
    // BUILD_STATUS.md). No equivalent error screen exists for the host
    // side, so this falls back to Landing - an existing, safe escape hatch
    // - rather than leaving the host stuck with no way out.
    void this.setUpRoom(data).catch((err: unknown) => {
      console.error('[suits-mp host] unexpected error setting up the room:', err);
      if (this.scene.isActive()) {
        this.scene.start('Landing', { clientId: data.clientId, getIceServers: data.getIceServers });
      }
    });
  }

  private async setUpRoom(data: HostLobbyData): Promise<void> {
    console.log('[suits-mp host] fetching ICE servers...');
    this.iceServers = await data.getIceServers();
    console.log(
      `[suits-mp host] ICE servers resolved: ${this.iceServers ? `${this.iceServers.length} TURN/STUN server(s)` : 'none (STUN-only fallback)'}`,
    );

    let code = randomLobbyCode();
    console.log(`[suits-mp host] creating room for code ${code}...`);
    let room = createNetworkRoom(code, { iceServers: this.iceServers });

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const occupied = await this.checkOccupied(room);
      if (!occupied) break;
      if (attempt === MAX_CODE_ATTEMPTS - 1) {
        await room.leave();
        throw new Error('could not find an available room code');
      }
      console.log(`[suits-mp host] code ${code} already occupied, trying a new one...`);
      await room.leave();
      code = randomLobbyCode();
      room = createNetworkRoom(code, { iceServers: this.iceServers });
    }
    console.log(`[suits-mp host] room ready on code ${code}`);

    if (!this.scene.isActive()) {
      // Scene was torn down (e.g. navigated away) while the async setup ran.
      void room.leave();
      return;
    }

    this.room = room;
    this.code = code;
    this.actions = createNetworkActions(room);
    this.roster.set(data.clientId, {
      clientId: data.clientId,
      peerId: 'host',
      displayName: data.displayName,
      slot: 'p0',
      isHost: true,
    });

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

  // Wires the identity/peer-leave handlers onto `this.room`/`this.actions`.
  private wireRoomHandlers(): void {
    this.actions.identity.onMessage = ({ clientId, displayName }, context) => {
      this.reconnectDebouncer.cancelPending(clientId);

      const result = matchOrCreateRosterEntry(this.roster, clientId, context.peerId, () => {
        if (this.roster.size >= ROOM_CAPACITY) return null;
        return {
          clientId,
          peerId: context.peerId,
          displayName,
          slot: nextAvailableSlot(this.roster),
          isHost: false,
        };
      });

      if (result.kind === 'rejected') {
        void this.actions.hostUI.send({ type: 'roomFull' }, { target: context.peerId });
        return;
      }

      const entry = this.roster.get(clientId);
      if (entry && !entry.isHost && entry.peerId === context.peerId) entry.displayName = displayName.trim().slice(0, 20);

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
    this.roster.set(clientId, { clientId, peerId: 'bot', displayName: '', slot, isHost: false, isBot: true });
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
    if (this.roster.size !== ROOM_CAPACITY || this.starting) return;
    this.starting = true;
    void this.collectNamesAndStart();
  }

  private async collectNamesAndStart(): Promise<void> {
    const requestId = crypto.randomUUID();
    const pending = new Set([...this.roster.values()].filter((entry) => !entry.isHost && !entry.isBot).map((entry) => entry.clientId));
    this.actions.finalName.onMessage = ({ clientId, displayName, requestId: replyId }, context) => {
      const entry = this.roster.get(clientId);
      if (replyId !== requestId || !entry || entry.peerId !== context.peerId || !pending.has(clientId)) return;
      entry.displayName = displayName.trim().slice(0, 20);
      pending.delete(clientId);
    };
    if (pending.size) {
      await this.actions.hostUI.send({ type: 'requestFinalNames', requestId });
      await new Promise<void>((resolve) => {
        const deadline = Date.now() + 3000;
        const poll = () => pending.size === 0 || Date.now() >= deadline ? resolve() : setTimeout(poll, 50);
        poll();
      });
    }
    if (!this.scene.isActive()) return;
    for (const entry of this.roster.values()) {
      if (!entry.displayName.trim()) entry.displayName = `Player ${ALL_NET_PLAYER_IDS.indexOf(entry.slot) + 1}`;
    }
    // Shuffle occupants while preserving their names and peer identities.
    // The engine's p0..p3 order now varies independently of lobby join order.
    shuffleRosterSeats(this.roster);

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

  // Manual-only room-code refresh (no passive/background timer).
  //
  // Originally implemented as room.leave() + rejoin under the same code
  // ("the closest equivalent to re-announce presence Trystero's public API
  // exposes"). That was the bug: Trystero's Room.leave() (see
  // @trystero-p2p/core's room.mjs) sends a goodbye to every peer and then
  // destroys each of their connections - so a refresh silently kicked every
  // already-connected player, not just this room's advertised presence.
  //
  // Investigated what Trystero actually supports here before picking a
  // fix (rather than assuming leave+rejoin was the only option), by reading
  // @trystero-p2p/core's own strategy implementation:
  //
  //   - A room only "stops announcing" if it's `passive` (this app never
  //     sets that option) or has been left. For a normal, non-passive room
  //     like this one, `strategy.mjs`'s internal announce loop re-publishes
  //     presence forever on its own - a fast warmup (233ms, 533ms, 1333ms
  //     after joining) settling into a steady ~5.3s interval - for as long
  //     as the room stays open. There is no scenario where our own open
  //     room's announcement "lapses" while it's alive; leaving and
  //     rejoining was never actually necessary to keep it discoverable.
  //   - Trystero also caches rooms per (appId, roomId) for the lifetime of
  //     the page (`occupiedRooms` in strategy.mjs, only cleared by
  //     leave()) - so re-checking "is my current code now occupied by
  //     someone else" can't be done via a second, disposable room object
  //     while this one stays open: joining the same code again just hands
  //     back this exact room instance. A real occupancy re-check is only
  //     possible by leaving first, which is the one thing this fix needs
  //     to avoid.
  //
  // Given both of those, a refresh under the still-current code has
  // nothing left to do at the network level - the room is already
  // continuously, automatically announcing itself. This is now a pure UI
  // confirmation: no room/actions/roster change, so no peer is ever
  // touched, let alone dropped.
  //
  // Not handled: another host independently generating this exact code
  // while this lobby sits idle. This is more likely with three-character
  // codes; per the finding above it cannot be detected without leaving
  // this room first - the one
  // action this fix exists to avoid. See BUILD_STATUS.md's Known Issues
  // for what a real fix would need if this ever turns out to matter.
  private refreshRoomCode(): void {
    this.pushLobbyState();
  }

  private pushLobbyState(): void {
    showHostLobby(this.code, rosterToSeats(this.roster), this.roster.get(this.hostClientId)?.displayName ?? '', {
      onOwnNameChange: (name) => {
        const host = this.roster.get(this.hostClientId);
        if (host) { host.displayName = name.trim().slice(0, 20); this.pushLobbyState(); }
      },
      onFillBot: (i) => this.fillBot(ALL_NET_PLAYER_IDS[i]),
      onReleaseBot: (i) => this.releaseBot(ALL_NET_PLAYER_IDS[i]),
      onStartGame: () => this.startGame(),
      onRefreshCode: () => this.refreshRoomCode(),
    });
  }
}
