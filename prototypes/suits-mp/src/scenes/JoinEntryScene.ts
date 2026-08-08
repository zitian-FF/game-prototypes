import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { isValidLobbyCode, normalizeLobbyCode, LOBBY_CODE_LENGTH } from '../net/lobbyCode';
import { PIXEL_RATIO } from '../render/pixelRatio';
import type { BootData } from '../net/playerSession';

// Manual room-code entry. Uses a plain DOM <input> overlay (Phaser has no
// native text field) - this is menu/form UI, not gameplay, so it sits
// outside the intent layer that gameplay input goes through.
export class JoinEntryScene extends Phaser.Scene {
  constructor() {
    super('JoinEntry');
  }

  create(data: BootData): void {
    addVersionStamp(this);
    createPortraitGuard(this);
    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    this.add
      .text(width / 2, height / 2 - 160, 'Enter room code', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#eeeeee',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);

    const inputStyle =
      'font-family:monospace;font-size:32px;text-align:center;width:220px;' +
      'letter-spacing:8px;text-transform:uppercase;background:#222;color:#fff;' +
      'border:1px solid #555;padding:8px;';
    const dom = this.add.dom(width / 2, height / 2 - 80, 'input', inputStyle);
    const input = dom.node as HTMLInputElement;
    input.maxLength = LOBBY_CODE_LENGTH;
    input.setAttribute('autocapitalize', 'characters');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('placeholder', 'CODE');

    let code = '';
    const connectButton = this.add
      .text(width / 2, height / 2 + 10, '[ Connect ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#88ff88',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setAlpha(0.4);

    const updateConnectButton = (valid: boolean): void => {
      connectButton.setAlpha(valid ? 1 : 0.4);
      if (valid) connectButton.setInteractive({ useHandCursor: true });
      else connectButton.disableInteractive();
    };

    input.addEventListener('input', () => {
      code = normalizeLobbyCode(input.value).slice(0, LOBBY_CODE_LENGTH);
      input.value = code;
      updateConnectButton(isValidLobbyCode(code));
    });

    connectButton.on('pointerdown', () => {
      if (!isValidLobbyCode(code)) return;
      this.scene.start('Connecting', { ...data, code });
    });

    const backButton = this.add
      .text(width / 2, height / 2 + 80, '[ Back ]', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#88aaff',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => this.scene.start('Landing', data));
  }
}
