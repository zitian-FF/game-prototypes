import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { createInitialState, applyAction } from '../host/gameHost';
import { chooseBotAction } from '../host/botAI';
import { buildMaskedState } from '../host/mask';
import { activePlayerId } from '../rules/engine';
import { renderGameView } from '../ui/renderGameView';
import { fromNetPlayerId, toNetPlayerId } from '../net/netPlayerId';
import type { createNetworkRoom } from '../net/room';
import type { createNetworkActions, ClientAction } from '../net/actions';
import type { Roster, RosterEntry } from '../net/types';
import type { GameState, PlayerId } from '../rules/types';

export interface HostGameData {
  room: ReturnType<typeof createNetworkRoom>;
  actions: ReturnType<typeof createNetworkActions>;
  roster: Roster;
}

// Safety cap on the bot-driving loop below - the game state always makes
// forward progress (a card is played, a trick resolves, the game ends), so
// this is only a guard against an unforeseen bug looping forever, not
// something expected to matter in practice.
const MAX_BOT_STEPS = 1000;

// Runs the authoritative game host: owns the one canonical GameState,
// applies every incoming action through gameHost.applyAction, and after
// each change computes and sends a fresh masked payload to every peer via
// a targeted per-peer `state.send` - never a shared broadcast (see
// net/actions.ts). The host's own screen renders the exact same masked
// view of its own slot, just built and applied locally instead of over the
// network. Bot-filled seats (see HostLobbyScene's "Fill with bots") are
// driven the same way: driveBotsIfNeeded feeds their moves through the
// exact same applyAction path a real peer's action takes.
export class HostGameScene extends Phaser.Scene {
  private roster!: Roster;
  private actions!: ReturnType<typeof createNetworkActions>;
  private state!: GameState;
  private container!: Phaser.GameObjects.Container;

  constructor() {
    super('HostGame');
  }

  create(data: HostGameData): void {
    addVersionStamp(this);
    createPortraitGuard(this);
    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    this.roster = data.roster;
    this.actions = data.actions;
    this.state = createInitialState();
    this.container = this.add.container(0, 0);

    // Deliberately no room.onPeerLeave here: a mid-game disconnect
    // preserves the roster slot and hand indefinitely for reconnect, so
    // there's nothing to react to. HostLobbyScene clears its own
    // debounced-removal handler before transitioning here.

    data.actions.gameAction.onMessage = (action, context) => {
      const entry = this.entryForPeer(context.peerId);
      if (!entry) return;
      this.applyAndBroadcast(fromNetPlayerId(entry.slot), action);
    };

    data.actions.identity.onMessage = (clientId, context) => {
      const entry = this.roster.get(clientId);
      if (!entry) {
        // No roster slot for this client ID: a stranger, not a reconnect.
        void data.actions.hostUI.send({ type: 'alreadyInProgress' }, { target: context.peerId });
        return;
      }
      entry.peerId = context.peerId;
      void data.actions.hostUI.send({ type: 'gameStarted' }, { target: context.peerId });
      // Reconnect: immediately re-send this peer's current masked payload
      // rather than waiting for the next game-state change.
      this.sendMaskedStateTo(entry);
    };

    this.broadcastAll();
    // Covers the case where the very first leader (whoever holds Yog-2) is
    // itself a bot seat.
    this.driveBotsIfNeeded();
  }

  private entryForPeer(peerId: string): RosterEntry | undefined {
    for (const entry of this.roster.values()) {
      if (entry.peerId === peerId) return entry;
    }
    return undefined;
  }

  private entryForSlot(slot: PlayerId): RosterEntry | undefined {
    const net = toNetPlayerId(slot);
    for (const entry of this.roster.values()) {
      if (entry.slot === net) return entry;
    }
    return undefined;
  }

  private applyAndBroadcast(fromSlot: PlayerId, action: ClientAction): void {
    const result = applyAction(this.state, fromSlot, action);
    if (!result.ok) {
      console.warn(`suits-mp host: rejected action from slot ${fromSlot}: ${result.error}`);
      return;
    }
    this.state = result.state;
    this.broadcastAll();
    this.driveBotsIfNeeded();
  }

  // Feeds one bot move at a time through the exact same applyAction path a
  // real peer's action takes (see host/botAI.ts), broadcasting after each
  // so the host's own screen and any connected human peers can observe bot
  // turns happening rather than jumping straight to the next human
  // decision. Stops as soon as the active seat isn't a bot, or the game is
  // over.
  private driveBotsIfNeeded(): void {
    for (let i = 0; i < MAX_BOT_STEPS && this.state.phase !== 'gameOver'; i++) {
      const active = activePlayerId(this.state);
      if (active === null) return;
      const entry = this.entryForSlot(active);
      if (!entry?.isBot) return;

      const action = chooseBotAction(this.state, active);
      const result = applyAction(this.state, active, action);
      if (!result.ok) {
        console.warn(`suits-mp host: bot action rejected for slot ${active}: ${result.error}`);
        return;
      }
      this.state = result.state;
      this.broadcastAll();
    }
  }

  private sendMaskedStateTo(entry: RosterEntry): void {
    // Bots have no observer (no real network peer, and nothing renders
    // their perspective) - nothing to build or send.
    if (entry.isBot) return;
    const slot = fromNetPlayerId(entry.slot);
    const masked = buildMaskedState(this.state, slot);
    if (entry.isHost) {
      renderGameView(this, this.container, masked, (action) => this.applyAndBroadcast(slot, action));
    } else {
      void this.actions.state.send(masked, { target: entry.peerId });
    }
  }

  private broadcastAll(): void {
    for (const entry of this.roster.values()) this.sendMaskedStateTo(entry);
  }
}
