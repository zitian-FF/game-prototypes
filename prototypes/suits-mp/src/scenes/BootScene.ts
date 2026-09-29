import Phaser from 'phaser';
import { preloadGameAssets } from '../ui/cardArt';
import { showAssetLoadProgress } from '../ui/loadingProgress';
import type { AssetLoadProgress } from '../ui/loadingProgress';
import type { BootData } from '../net/playerSession';
import titleBackgroundUrl from '../titleArt/title_cosmos_backdrop_v2.webp?url';
import titleMoonUrl from '../titleArt/title_celestial_moon.webp?url';
import titleVioletUrl from '../titleArt/title_planet_amethyst.webp?url';
import titleOchreUrl from '../titleArt/title_planet_ochre.webp?url';

interface StartupData extends BootData {
  initialCode: string | null;
}

// The one loading boundary for the whole prototype. All packaged art is
// decoded and registered before the landing screen or invite flow can run.
export class BootScene extends Phaser.Scene {
  private loading!: AssetLoadProgress;

  constructor() { super('Boot'); }

  preload(): void {
    this.loading = showAssetLoadProgress(this, 'Preparing the game');
    preloadGameAssets(this);
    this.load.image('title_cosmos_backdrop_v2', titleBackgroundUrl);
    this.load.image('title_celestial_moon', titleMoonUrl);
    this.load.image('title_planet_amethyst', titleVioletUrl);
    this.load.image('title_planet_ochre', titleOchreUrl);
  }

  create(data: StartupData): void {
    if (this.loading.hadError) {
      this.loading.showRetry(() => this.scene.restart(data));
      return;
    }
    this.loading.hide();
    if (data.initialCode) {
      this.scene.start('Connecting', { ...data, code: data.initialCode, displayName: '' });
    } else {
      this.scene.start('Landing', data);
    }
  }
}
