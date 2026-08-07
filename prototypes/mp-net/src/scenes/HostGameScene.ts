import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import { bindPrimaryIntent } from '../input/intents';
import { createDeltaSender } from '../net/deltaSender';
import type { createNetworkRoom } from '../net/room';
import type { createNetworkActions } from '../net/actions';
import type { Roster } from '../net/types';

export interface HostGameData {
  room: ReturnType<typeof createNetworkRoom>;
  actions: ReturnType<typeof createNetworkActions>;
  roster: Roster;
  hostClientId: string;
}

interface Row {
  label: Phaser.GameObjects.Text;
  counterText: Phaser.GameObjects.Text;
}

const ROW_HEIGHT = 26;
const LIST_TOP = 60;
const LIST_LEFT = 30;
const BUTTON_SIZE = 130;

export class HostGameScene extends Phaser.Scene {
  private roster!: Roster;
  private rows = new Map<string, Row>();
  private peerToClient = new Map<string, string>();

  constructor() {
    super('HostGame');
  }

  create(data: HostGameData): void {
    addVersionStamp(this);
    createOrientationGuard(this, 'landscape');

    const { actions, roster, hostClientId } = data;
    this.roster = roster;
    this.rows.clear();
    this.peerToClient.clear();

    this.add
      .text(160, 24, 'Players', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    for (const entry of this.roster.values()) {
      if (!entry.isHost) this.peerToClient.set(entry.peerId, entry.clientId);
      this.addRow(entry.clientId, entry.isHost);
      this.renderRow(entry.clientId);
    }

    // Host is authoritative: it applies a delta to the roster then
    // re-broadcasts the new total. The local row render only ever happens
    // from inside this function - including for the host's own presses
    // below - so no screen (including the host's) updates optimistically
    // ahead of that broadcast (Part 5 of BRIEF.md).
    const applyDelta = (clientId: string, delta: number): void => {
      const entry = this.roster.get(clientId);
      if (!entry) return;
      entry.counter += delta;
      void actions.hostUI.send({ type: 'counterUpdate', clientId, counter: entry.counter });
      this.renderRow(clientId);
    };

    actions.inputDelta.onMessage = (delta, context) => {
      const clientId = this.peerToClient.get(context.peerId);
      if (!clientId) return;
      applyDelta(clientId, delta);
    };

    actions.identity.onMessage = (clientId, context) => {
      const entry = this.roster.get(clientId);
      if (!entry) {
        // Game already started and this client ID has no roster slot: a
        // stranger, not a reconnect. Reject rather than let them in silently.
        void actions.hostUI.send({ type: 'alreadyInProgress' }, { target: context.peerId });
        return;
      }

      entry.peerId = context.peerId;
      this.peerToClient.set(context.peerId, clientId);
      this.addRow(clientId, entry.isHost);
      this.renderRow(clientId);

      // Reconnect: their counter was preserved host-side keyed by client ID
      // (untouched above), so telling them the game has started sends them
      // straight back to the button screen, not the lobby.
      void actions.hostUI.send({ type: 'gameStarted' }, { target: context.peerId });
    };

    const button = this.add
      .rectangle(this.scale.width - 100, this.scale.height / 2, BUTTON_SIZE, BUTTON_SIZE, 0x2266cc)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(this.scale.width - 100, this.scale.height / 2, 'PRESS', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const sendHostDelta = createDeltaSender((delta) => {
      applyDelta(hostClientId, delta);
      return Promise.resolve();
    });

    bindPrimaryIntent(this, button, {
      onDown: () => {
        button.setFillStyle(0x1a4d99);
        sendHostDelta();
      },
      onUp: () => {
        button.setFillStyle(0x2266cc);
      },
    });
  }

  private addRow(clientId: string, isHost: boolean): void {
    if (this.rows.has(clientId)) return;
    const index = this.rows.size;
    const y = LIST_TOP + index * ROW_HEIGHT;

    const label = this.add.text(LIST_LEFT, y, shortId(clientId) + (isHost ? ' (Host)' : ''), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#eeeeee',
    });
    const counterText = this.add.text(LIST_LEFT + 230, y, '0', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#88ff88',
    });
    this.rows.set(clientId, { label, counterText });
  }

  private renderRow(clientId: string): void {
    const row = this.rows.get(clientId);
    const entry = this.roster.get(clientId);
    if (!row || !entry) return;
    row.counterText.setText(String(entry.counter));
  }
}

function shortId(clientId: string): string {
  return clientId.slice(0, 8);
}
