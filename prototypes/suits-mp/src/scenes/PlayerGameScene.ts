import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { createPersistentUIState, renderGameView } from '../ui/renderGameView';
import type { PlayerSessionData } from '../net/playerSession';
import { preloadCardArt } from '../ui/cardArt';

export class PlayerGameScene extends Phaser.Scene {
  constructor() {
    super('PlayerGame');
  }

  preload(): void {
    preloadCardArt(this);
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

    // No local-only "checking the rules overlay" / redistribution-log tap
    // targets yet - both are stubbed with placeholder text this stage (see
    // ui/renderGameView.ts) since real presentation is Stage 3.
    actions.state.onMessage = (masked, context) => {
      data.hostPeerId.current = context.peerId;
      renderGameView(this, container, masked, (action) => void actions.gameAction.send(action), uiState);
    };

    room.onPeerLeave = (peerId) => {
      if (peerId === data.hostPeerId.current) {
        overlay.setVisible(true);
      }
    };
  }
}
