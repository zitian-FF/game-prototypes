import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createOrientationGuard } from '../orientation/orientation';
import { bindPrimaryIntent } from '../input/intents';
import { PIXEL_RATIO } from '../render/pixelRatio';
import type { SharedNetData } from '../net/types';

const BUTTON_SIZE = 220;
const INPUT_BIT_PRIMARY = 1 << 0;

export class PlayerButtonScene extends Phaser.Scene {
  constructor() {
    super('PlayerButton');
  }

  create(data: SharedNetData): void {
    addVersionStamp(this);
    createOrientationGuard(this, 'portrait');

    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    const { actions } = data;

    const overlay = this.add.container(0, 0).setDepth(20000).setVisible(false);
    const overlayBg = this.add.rectangle(0, 0, width, height, 0x000000, 0.94).setOrigin(0);
    const overlayText = this.add
      .text(width / 2, height / 2, 'Host disconnected.\nSession ended.', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        align: 'center',
        resolution: PIXEL_RATIO,
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
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    let pressed = false;
    bindPrimaryIntent(this, button, {
      onDown: () => {
        if (pressed) return;
        pressed = true;
        button.setFillStyle(0x1a4d99);
        void actions.input.send(INPUT_BIT_PRIMARY);
      },
      onUp: () => {
        if (!pressed) return;
        pressed = false;
        button.setFillStyle(0x2266cc);
        void actions.input.send(0);
      },
    });

    this.game.events.once('host-disconnected', () => {
      if (!this.scene.isActive()) return;
      overlay.setVisible(true);
    });
  }
}
