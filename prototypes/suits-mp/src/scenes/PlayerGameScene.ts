import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { createPersistentUIState, presentGameView } from '../ui/renderGameView';
import type { PlayerSessionData } from '../net/playerSession';

export class PlayerGameScene extends Phaser.Scene {
  constructor() {
    super('PlayerGame');
  }

  create(data: PlayerSessionData): void {
    addVersionStamp(this);
    createPortraitGuard(this);
    this.cameras.main.setZoom(PIXEL_RATIO);
    const width = this.scale.width / PIXEL_RATIO;
    const height = this.scale.height / PIXEL_RATIO;
    this.cameras.main.centerOn(width / 2, height / 2);

    const { actions, room } = data;
    const container = this.add.container(0, 0);
    // One instance for the scene's whole lifetime, not rebuilt per masked
    // state - see ui/renderGameView.ts's PersistentUIState doc comment.
    const uiState = createPersistentUIState();

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

    const waitingForState = this.add.container(0, 0).setDepth(19999);
    waitingForState.add([
      this.add.rectangle(0, 0, width, height, 0x05080a, 0.97).setOrigin(0),
      this.add.text(width / 2, height / 2, 'Waiting for the host...', {
        fontFamily: 'monospace', fontSize: '16px', color: '#d8c078', resolution: PIXEL_RATIO,
      }).setOrigin(0.5),
    ]);

    // No local-only "checking the rules overlay" / redistribution-log tap
    // targets yet - both are stubbed with placeholder text this stage (see
    // ui/renderGameView.ts) since real presentation is Stage 3.
    let waitingHidden = false;
    actions.state.onMessage = (masked, context) => {
      data.hostPeerId.current = context.peerId;
      // All assets were prepared during Boot; wait only for the first real
      // masked state from the host before revealing the board.
      if (!waitingHidden) {
        waitingHidden = true;
        waitingForState.destroy();
      }
      presentGameView(this, container, masked, (action) => void actions.gameAction.send(action), uiState, true);
    };

    room.onPeerLeave = (peerId) => {
      if (peerId === data.hostPeerId.current) {
        overlay.setVisible(true);
      }
    };
  }
}
