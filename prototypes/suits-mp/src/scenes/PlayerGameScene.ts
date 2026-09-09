import Phaser from 'phaser';
import { addVersionStamp } from '../version/versionStamp';
import { createPortraitGuard } from '../orientation/orientation';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { createPersistentUIState, presentGameView } from '../ui/renderGameView';
import type { PlayerSessionData } from '../net/playerSession';
import { preloadCardArt } from '../ui/cardArt';
import { showAssetLoadProgress } from '../ui/loadingProgress';
import type { AssetLoadProgress } from '../ui/loadingProgress';

export class PlayerGameScene extends Phaser.Scene {
  private loading!: AssetLoadProgress;

  constructor() {
    super('PlayerGame');
  }

  preload(): void {
    this.loading = showAssetLoadProgress(this);
    preloadCardArt(this);
  }

  create(data: PlayerSessionData): void {
    // A failed asset fetch mid-preload: stop here rather than proceeding
    // into a game view missing card art. Retrying just restarts this same
    // scene with the same data, which re-runs preload() - preloadCardArt's
    // manifest-driven loader only re-requests textures that don't already
    // exist, so a partial success isn't re-fetched from scratch.
    if (this.loading.hadError) {
      this.loading.showRetry(() => this.scene.restart(data));
      return;
    }

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
    let loadingHidden = false;
    actions.state.onMessage = (masked, context) => {
      data.hostPeerId.current = context.peerId;
      // Asset loading finished back in preload(), but this scene has
      // nothing real to show until its first masked state arrives over the
      // network - keep the loading overlay up until that actually happens,
      // rather than hiding it as soon as preload completes, so there is no
      // gap of blank canvas between the two.
      if (!loadingHidden) {
        loadingHidden = true;
        this.loading.hide();
      }
      presentGameView(this, container, masked, (action) => void actions.gameAction.send(action), uiState);
    };

    room.onPeerLeave = (peerId) => {
      if (peerId === data.hostPeerId.current) {
        overlay.setVisible(true);
      }
    };
  }
}
