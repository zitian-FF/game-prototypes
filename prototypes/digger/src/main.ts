import Phaser from 'phaser';
import { bindSelectIntent } from './input/intents';
import tune from '../tune.json';

interface AnimationConfig {
  frameCount: number;
  frames: string[];
}

interface ManifestEntry {
  path: string;
  hash: string;
  fetchedAt: string;
}

interface Tile {
  sprite: Phaser.GameObjects.Image;
  durability: number;
}

const GRID_COLS = 5;
const GRID_ROWS = 6;
const GRID_MARGIN_X = 24;
const GRID_MARGIN_TOP = 56;
const SHIP_SPACING = 40;

const WIDTH = 390;
const HEIGHT = 844;

// Phaser 3 dropped the old global `resolution` game-config option, so
// there's no single knob for "render at device pixel density" anymore.
// The equivalent today: size the canvas backing store at
// devicePixelRatio, then zoom every camera by the same factor and
// re-center it on the unchanged logical world (WIDTH x HEIGHT) so all
// existing pixel-coordinate math below keeps meaning what it already
// means. Capped at 2x - many phones report 3x+, and this scene rebuilds
// its whole object tree eagerly, so uncapped DPR would add real
// fill-rate cost for sharpness that's barely visible at this UI's sizes.
const PIXEL_RATIO = Math.min(Math.ceil(window.devicePixelRatio || 1), 2);

class DiggerScene extends Phaser.Scene {
  private tiles: Tile[] = [];

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

    const buildText = this.add.text(16, 16, `build ${__GIT_SHA__}`, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      resolution: PIXEL_RATIO,
    });

    // Tile world size = the art's native pixels; the camera zoom (computed
    // below) is what shrinks the grid to fit the portrait canvas. Uses the
    // fixed logical WIDTH, not this.scale.width, since the canvas backing
    // store is now WIDTH * PIXEL_RATIO and this layout math must stay in
    // logical/CSS pixel space regardless of device pixel ratio.
    const tileNativeFrame = this.textures.get('tile_grass').get();
    const tileNativeWidth = tileNativeFrame.width;
    const tileNativeHeight = tileNativeFrame.height;

    const gridScreenWidth = WIDTH - GRID_MARGIN_X * 2;
    const tileScreenWidth = gridScreenWidth / GRID_COLS;
    const tileScreenHeight = tileScreenWidth * (tileNativeHeight / tileNativeWidth);
    const gridScreenHeight = tileScreenHeight * GRID_ROWS;
    const zoom = tileScreenWidth / tileNativeWidth;

    // Phaser's camera zoom pivots around the viewport center (not the
    // origin), so screen->world conversion must account for that offset.
    const camCenterX = WIDTH / 2;
    const camCenterY = HEIGHT / 2;
    const toWorldX = (screenX: number) => (screenX - camCenterX) / zoom + camCenterX;
    const toWorldY = (screenY: number) => (screenY - camCenterY) / zoom + camCenterY;

    const worldGridLeft = toWorldX(GRID_MARGIN_X);
    const worldGridTop = toWorldY(GRID_MARGIN_TOP);

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const worldX = worldGridLeft + (col + 0.5) * tileNativeWidth;
        const worldY = worldGridTop + (row + 0.5) * tileNativeHeight;
        const sprite = this.add.image(worldX, worldY, 'tile_grass');
        this.tiles.push({ sprite, durability: Phaser.Math.Between(1, 3) });
      }
    }

    const shipFrame = this.textures.get('atlas').get(animations.player_ship.frames[0]);
    const shipScreenY =
      GRID_MARGIN_TOP + gridScreenHeight + SHIP_SPACING + (shipFrame.height * zoom) / 2;
    const shipWorldX = toWorldX(WIDTH / 2);
    const shipWorldY = toWorldY(shipScreenY);

    const ship = this.add.sprite(shipWorldX, shipWorldY, 'atlas', animations.player_ship.frames[0]);
    ship.play('player_ship');

    // tune.json amplitude is in on-screen pixels; convert to world units so
    // it reads the same regardless of the gameplay camera's zoom.
    const bobAmplitudeWorld = tune.shipBobAmplitudePx / zoom;
    this.tweens.add({
      targets: ship,
      y: shipWorldY - bobAmplitudeWorld,
      duration: tune.shipBobDurationMs / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Zooming by PIXEL_RATIO on top of the art-scale zoom renders at the
    // device's actual pixel density; centerOn() re-anchors the view on the
    // logical world center since the (now larger) canvas shifts it.
    this.cameras.main.setZoom(zoom * PIXEL_RATIO);
    this.cameras.main.centerOn(WIDTH / 2, HEIGHT / 2);

    // Second camera keeps screen-space UI (the build tag) readable and
    // unaffected by the gameplay camera's art-scale zoom, but still needs
    // its own PIXEL_RATIO zoom (+ re-centering) for sharp text.
    const uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    uiCamera.setZoom(PIXEL_RATIO);
    uiCamera.centerOn(WIDTH / 2, HEIGHT / 2);
    this.cameras.main.ignore(buildText);
    uiCamera.ignore([...this.tiles.map((tile) => tile.sprite), ship]);

    bindSelectIntent(this, (worldX, worldY) => {
      for (const tile of this.tiles) {
        if (tile.durability <= 0) continue;
        if (!tile.sprite.getBounds().contains(worldX, worldY)) continue;

        tile.durability -= 1;
        if (tile.durability <= 0) {
          tile.sprite.setTexture('tile_hole');
        }
        break;
      }
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
    width: WIDTH * PIXEL_RATIO,
    height: HEIGHT * PIXEL_RATIO,
  },
  scene: DiggerScene,
});
