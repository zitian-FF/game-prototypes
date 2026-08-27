import Phaser from 'phaser';
import { matchOrCreateRosterEntry } from 'mp-core';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import type { Roster, SharedNetData } from '../net/types';

interface Row {
  label: Phaser.GameObjects.Text;
  counterText: Phaser.GameObjects.Text;
}

const ROW_HEIGHT = 28;
const LIST_TOP = 70;
const LIST_LEFT = 40;

export class HostGameScene extends Phaser.Scene {
  private roster!: Roster;
  private rows = new Map<string, Row>();
  private peerToClient = new Map<string, string>();

  constructor() {
    super('HostGame');
  }

  create(data: SharedNetData & { roster: Roster }): void {
    addVersionStamp(this);
    createOrientationGuard(this, 'landscape');

    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    const { actions, roster } = data;
    this.roster = roster;
    this.rows.clear();
    this.peerToClient.clear();

    this.add
      .text(width / 2, 24, 'Players', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    for (const entry of this.roster.values()) {
      this.peerToClient.set(entry.peerId, entry.clientId);
      this.addRow(entry.clientId);
    }

    actions.identity.onMessage = (clientId, context) => {
      matchOrCreateRosterEntry(this.roster, clientId, context.peerId, () => ({
        clientId,
        peerId: context.peerId,
        counter: 0,
        lastInputMask: 0,
      }));
      this.peerToClient.set(context.peerId, clientId);
      this.addRow(clientId);
      this.renderRow(clientId);

      // Reconnect hook: a peer that (re)identifies once the game is already
      // running gets told again so it lands on the button screen, not left
      // stuck on the waiting screen.
      void actions.hostUI.send({ type: 'gameStarted' }, { target: context.peerId });
    };

    actions.input.onMessage = (mask, context) => {
      const clientId = this.peerToClient.get(context.peerId);
      if (!clientId) return;
      const entry = this.roster.get(clientId);
      if (!entry) return;

      const prevBit0 = entry.lastInputMask & 1;
      const bit0 = mask & 1;
      if (bit0 === 1 && prevBit0 === 0) {
        entry.counter += 1;
      }
      entry.lastInputMask = mask;
      this.renderRow(clientId);
    };
  }

  private addRow(clientId: string): void {
    if (this.rows.has(clientId)) return;
    const index = this.rows.size;
    const y = LIST_TOP + index * ROW_HEIGHT;

    const label = this.add.text(LIST_LEFT, y, shortId(clientId), {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#eeeeee',
      resolution: PIXEL_RATIO,
    });
    const counterText = this.add.text(LIST_LEFT + 220, y, '0', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#88ff88',
      resolution: PIXEL_RATIO,
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
