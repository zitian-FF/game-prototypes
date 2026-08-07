import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import { bindPrimaryIntent } from '../input/intents';
import { createDeltaSender } from '../net/deltaSender';
import type { PlayerSessionData } from '../net/playerSession';

const BUTTON_SIZE = 220;

export class PlayerButtonScene extends Phaser.Scene {
  constructor() {
    super('PlayerButton');
  }

  create(data: PlayerSessionData): void {
    addVersionStamp(this);
    createOrientationGuard(this, 'portrait');

    const { actions, room } = data;
    const width = this.scale.width;
    const height = this.scale.height;

    const overlay = this.add.container(0, 0).setDepth(20000).setVisible(false);
    const overlayBg = this.add.rectangle(0, 0, width, height, 0x000000, 0.94).setOrigin(0);
    const overlayText = this.add
      .text(width / 2, height / 2, 'Host disconnected.\nSession ended.', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);
    overlay.add([overlayBg, overlayText]);

    const button = this.add
      .rectangle(width / 2, height / 2, BUTTON_SIZE, BUTTON_SIZE, 0x2266cc)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, height / 2, 'PRESS', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Accumulates one press per pointerdown and follows the send-when-idle
    // pattern (Part 5 of BRIEF.md): the displayed number never appears here
    // at all (only the host's screen shows counters), the delay-free local
    // accumulation is what keeps every click registering regardless of
    // network conditions.
    const sendDelta = createDeltaSender((delta) => actions.inputDelta.send(delta));

    bindPrimaryIntent(this, button, {
      onDown: () => {
        button.setFillStyle(0x1a4d99);
        sendDelta();
      },
      onUp: () => {
        button.setFillStyle(0x2266cc);
      },
    });

    room.onPeerLeave = (peerId) => {
      if (peerId === data.hostPeerId.current) {
        overlay.setVisible(true);
      }
    };
  }
}
