import Phaser from 'phaser';

interface AnimationConfig {
  frameCount: number;
  frames: string[];
}

interface ManifestEntry {
  path: string;
  hash: string;
  fetchedAt: string;
}

class DiggerScene extends Phaser.Scene {
  preload(): void {
    this.load.json('manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-manifest', () => {
      const manifest = this.cache.json.get('manifest') as ManifestEntry[];

      for (const entry of manifest) {
        if (entry.path.startsWith('loose/')) {
          const filename = entry.path.slice('loose/'.length);
          const key = filename.replace(/\.[^.]+$/, '');
          this.load.image(key, `assets/${entry.path}`);
        }
      }

      this.load.atlas('atlas', 'assets/atlas/atlas.png', 'assets/atlas/atlas.json');
      this.load.json('animations', 'assets/atlas/animations.json');
    });
  }

  create(): void {
    const animations = this.cache.json.get('animations') as Record<string, AnimationConfig>;

    for (const [key, config] of Object.entries(animations)) {
      this.anims.create({
        key,
        frames: config.frames.map((frame) => ({ key: 'atlas', frame })),
        frameRate: 20,
        repeat: -1,
        yoyo: false,
      });
    }

    const shipX = this.scale.width / 2;
    const shipY = this.scale.height * 0.3;
    const ship = this.add.sprite(shipX, shipY, 'atlas', animations.player_ship.frames[0]);
    ship.play('player_ship');

    this.add.text(16, 16, `build ${__GIT_SHA__}`, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#111111',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 844,
  },
  scene: DiggerScene,
});
