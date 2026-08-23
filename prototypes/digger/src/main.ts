import Phaser from 'phaser';
import { bindSelectIntent, bindVerticalDragIntent } from './input/intents';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { generateBoard, rowsForDepth, shipDamage, upgradeCost } from './state/board';
import { applyEnergyRegen } from './state/energy';
import { loadState, saveState } from './state/persistence';
import type { GameState } from './state/types';
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

interface HitRegion {
  rect: Phaser.Geom.Rectangle;
  onTap: () => void;
}

const GRID_MARGIN_X = 24;
const BOARD_VIEWPORT_TOP = 56;
const BOARD_VIEWPORT_HEIGHT = 340;
const SHIP_SPACING = 40;

const WIDTH = 390;
const HEIGHT = 844;

// See the comment in the original digger main.ts (and every other
// prototype) for why this replaces Phaser 3's dropped `resolution`
// game-config option: size the canvas backing store at devicePixelRatio,
// zoom cameras by the same factor, and re-center on the unchanged logical
// world so existing pixel-coordinate math keeps meaning what it means.
// Capped at 2x since this scene rebuilds its object tree eagerly.
const PIXEL_RATIO = Math.min(Math.ceil(window.devicePixelRatio || 1), 2);

mountDebugPanelIfRequested();

class DiggerScene extends Phaser.Scene {
  private state!: GameState;
  private animations!: Record<string, AnimationConfig>;

  private tileNativeWidth = 0;
  private tileNativeHeight = 0;
  // World-fit zoom (native tile px -> logical screen px), independent of
  // PIXEL_RATIO and independent of depth since GRID_COLS never changes.
  private artZoom = 1;

  // The board (tile grid) renders through its own camera: clipped to a
  // fixed-height viewport near the top of the canvas, scrollable
  // vertically. `cameras.main` stays the fixed logical-pixel camera (build
  // tag, ship, HUD) used for select-intent hit-testing, exactly like every
  // other prototype's single main camera — the board camera is additional,
  // ignored by main and ignoring everything main draws, mirroring the
  // existing UI-camera-ignoring-game-world pattern.
  private boardCamera!: Phaser.Cameras.Scene2D.Camera;
  private tileSprites: Phaser.GameObjects.Image[] = [];

  // World-space (board-native-pixel) Y the board camera is centered on;
  // clamped so the viewport never scrolls past the grid's top or bottom.
  private panCenterY = 0;

  private hudLayer!: Phaser.GameObjects.Container;
  private dynamicHud?: Phaser.GameObjects.Container;
  private hudHitRegions: HitRegion[] = [];
  private hudBottom = 0;
  private ship!: Phaser.GameObjects.Sprite;

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
    this.animations = this.cache.json.get('animations') as Record<string, AnimationConfig>;
    for (const [key, config] of Object.entries(this.animations)) {
      this.anims.create({
        key,
        frames: config.frames.map((frame) => ({ key: 'atlas', frame })),
        frameRate: 20,
        repeat: -1,
        yoyo: false,
      });
    }

    this.state = loadState();
    this.applyRegenCatchup();

    const tileFrame = this.textures.get('tile_grass').get();
    this.tileNativeWidth = tileFrame.width;
    this.tileNativeHeight = tileFrame.height;

    const gridScreenWidth = WIDTH - GRID_MARGIN_X * 2;
    const tileScreenWidth = gridScreenWidth / tune.gridCols;
    this.artZoom = tileScreenWidth / this.tileNativeWidth;

    this.setUpCameras();
    this.buildBoard();
    this.buildHud();

    bindSelectIntent(this, (worldX, worldY) => this.onTap(worldX, worldY));
    bindVerticalDragIntent(this, (deltaY) => this.onDrag(deltaY));

    // Live regen recompute + countdown refresh while the tab stays open.
    // The same timestamp-anchored calc runs again on next load, so this
    // isn't "a timer that only runs while the tab is open" in the sense
    // the house Persistence rule warns against — it's just an in-memory
    // convenience; correctness never depends on this event having fired.
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.applyRegenCatchup();
        this.renderHud();
      },
    });
  }

  // --- setup ---------------------------------------------------------

  private setUpCameras(): void {
    this.cameras.main.setZoom(PIXEL_RATIO);
    this.cameras.main.centerOn(WIDTH / 2, HEIGHT / 2);

    this.boardCamera = this.cameras.add(
      0,
      BOARD_VIEWPORT_TOP * PIXEL_RATIO,
      WIDTH * PIXEL_RATIO,
      BOARD_VIEWPORT_HEIGHT * PIXEL_RATIO
    );
    this.boardCamera.setZoom(this.artZoom * PIXEL_RATIO);
    this.boardCamera.setBackgroundColor(0x0a0a0a);
  }

  private buildBoard(): void {
    for (const sprite of this.tileSprites) sprite.destroy();
    this.tileSprites = [];

    const cols = this.state.gridCols;
    for (let i = 0; i < this.state.tiles.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const worldX = (col + 0.5) * this.tileNativeWidth;
      const worldY = (row + 0.5) * this.tileNativeHeight;
      const tile = this.state.tiles[i];
      const sprite = this.add.image(worldX, worldY, tile.revealed ? 'tile_hole' : 'tile_grass');
      this.tileSprites.push(sprite);
    }
    this.cameras.main.ignore(this.tileSprites);

    this.panCenterY = this.clampPanCenterY(0);
    this.applyPan();
  }

  private buildHud(): void {
    this.hudLayer = this.add.container(0, 0);
    this.boardCamera.ignore(this.hudLayer);

    const buildText = this.add.text(16, 16, `build ${__GIT_SHA__}`, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      resolution: PIXEL_RATIO,
    });
    this.hudLayer.add(buildText);

    // Functional-only border marking the scrollable board region, so it
    // reads as distinct from the fixed HUD below it.
    const border = this.add.rectangle(
      WIDTH / 2,
      BOARD_VIEWPORT_TOP + BOARD_VIEWPORT_HEIGHT / 2,
      WIDTH - GRID_MARGIN_X * 2 + 8,
      BOARD_VIEWPORT_HEIGHT + 8
    );
    border.setStrokeStyle(1, 0x444444, 0.8);
    border.setFillStyle(0, 0);
    this.hudLayer.add(border);

    this.buildShip();
    this.renderHud();
  }

  private buildShip(): void {
    const frames = this.animations.player_ship.frames;
    const shipFrame = this.textures.get('atlas').get(frames[0]);
    const shipHalfHeight = (shipFrame.height * this.artZoom) / 2;
    const shipY = BOARD_VIEWPORT_TOP + BOARD_VIEWPORT_HEIGHT + SHIP_SPACING + shipHalfHeight;

    this.ship = this.add.sprite(WIDTH / 2, shipY, 'atlas', frames[0]);
    this.ship.setScale(this.artZoom);
    this.ship.play('player_ship');
    this.hudLayer.add(this.ship);

    // Ship lives in the fixed logical-pixel camera now (object-scaled by
    // artZoom rather than camera-zoomed), so tune.json's amplitude is
    // already in this camera's world units — no zoom conversion needed.
    this.tweens.add({
      targets: this.ship,
      y: shipY - tune.shipBobAmplitudePx,
      duration: tune.shipBobDurationMs / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.hudBottom = shipY + shipHalfHeight + 20;
  }

  // --- camera pan ------------------------------------------------------

  private viewportWorldHeight(): number {
    return BOARD_VIEWPORT_HEIGHT / this.artZoom;
  }

  private clampPanCenterY(target: number): number {
    const viewportHeight = this.viewportWorldHeight();
    const gridHeight = this.state.gridRows * this.tileNativeHeight;
    if (gridHeight <= viewportHeight) return gridHeight / 2;
    return Phaser.Math.Clamp(target, viewportHeight / 2, gridHeight - viewportHeight / 2);
  }

  private applyPan(): void {
    const gridWorldCenterX = (this.state.gridCols * this.tileNativeWidth) / 2;
    this.boardCamera.centerOn(gridWorldCenterX, this.panCenterY);
  }

  private onDrag(deltaY: number): void {
    const worldDelta = deltaY / this.boardCamera.zoom;
    this.panCenterY = this.clampPanCenterY(this.panCenterY - worldDelta);
    this.applyPan();
  }

  // --- input -----------------------------------------------------------

  // worldX/worldY come from cameras.main (the fixed logical camera, zoomed
  // by PIXEL_RATIO only and centered on the logical center) — for that
  // camera, world coordinates are numerically identical to logical screen
  // pixels, so they double as both HUD hit-test space and, via the pan
  // math below, board hit-test space.
  private onTap(worldX: number, worldY: number): void {
    for (const region of this.hudHitRegions) {
      if (region.rect.contains(worldX, worldY)) {
        region.onTap();
        return;
      }
    }
    this.onTapBoard(worldX, worldY);
  }

  private onTapBoard(screenX: number, screenY: number): void {
    if (screenY < BOARD_VIEWPORT_TOP || screenY > BOARD_VIEWPORT_TOP + BOARD_VIEWPORT_HEIGHT) return;
    if (screenX < GRID_MARGIN_X || screenX > WIDTH - GRID_MARGIN_X) return;

    const tileScreenWidth = (WIDTH - GRID_MARGIN_X * 2) / this.state.gridCols;
    const scrollTopWorldY = this.panCenterY - this.viewportWorldHeight() / 2;
    const boardWorldY = scrollTopWorldY + (screenY - BOARD_VIEWPORT_TOP) / this.artZoom;

    const col = Math.floor((screenX - GRID_MARGIN_X) / tileScreenWidth);
    const row = Math.floor(boardWorldY / this.tileNativeHeight);
    if (col < 0 || col >= this.state.gridCols || row < 0 || row >= this.state.gridRows) return;

    const index = row * this.state.gridCols + col;
    const tile = this.state.tiles[index];
    if (!tile || tile.revealed) return;

    this.applyRegenCatchup();
    if (this.state.energy < 1) return;

    this.state.energy -= 1;
    tile.hp -= shipDamage(this.state.shipLevel);
    if (tile.hp <= 0) {
      tile.hp = 0;
      tile.revealed = true;
      this.state.currency += tile.loot;
      this.tileSprites[index].setTexture('tile_hole');
    }

    saveState(this.state);
    this.renderHud();
  }

  private onUpgrade(): void {
    const cost = upgradeCost(this.state.shipLevel);
    if (this.state.currency < cost) return;
    this.state.currency -= cost;
    this.state.shipLevel += 1;
    saveState(this.state);
    this.renderHud();
  }

  private onDescend(): void {
    if (this.state.tiles.some((t) => !t.revealed)) return;
    this.state.depth += 1;
    this.state.gridRows = rowsForDepth(this.state.depth);
    this.state.tiles = generateBoard(this.state.depth);
    saveState(this.state);
    this.buildBoard();
    this.renderHud();
  }

  // --- energy ------------------------------------------------------------

  private applyRegenCatchup(): void {
    const result = applyEnergyRegen(this.state.energy, this.state.energyTimestamp, Date.now());
    this.state.energy = result.energy;
    this.state.energyTimestamp = result.timestamp;
  }

  // --- HUD rendering -----------------------------------------------------

  private hudText(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    align: 'left' | 'right' | 'center' = 'left'
  ): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, value, {
      fontFamily: 'monospace',
      fontSize: `${size}px`,
      color,
      resolution: PIXEL_RATIO,
    });
    if (align === 'right') t.setOrigin(1, 0);
    else if (align === 'center') t.setOrigin(0.5, 0);
    this.dynamicHud!.add(t);
    return t;
  }

  private hudButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onTap: () => void,
    opts?: { disabled?: boolean; color?: number }
  ): number {
    const color = opts?.color ?? 0x333333;
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, color, opts?.disabled ? 0.3 : 1);
    rect.setStrokeStyle(2, 0xffffff, opts?.disabled ? 0.2 : 0.7);
    const t = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: w - 12 },
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);
    this.dynamicHud!.add([rect, t]);
    if (!opts?.disabled) {
      this.hudHitRegions.push({ rect: new Phaser.Geom.Rectangle(x, y, w, h), onTap });
    }
    return y + h;
  }

  private renderHud(): void {
    this.dynamicHud?.destroy();
    this.dynamicHud = this.add.container(0, 0);
    this.hudLayer.add(this.dynamicHud);
    this.hudHitRegions = [];

    let y = this.hudBottom;

    // ui_ammo is a 32-frame belt sprite, one frame per possible energy
    // value (energyMax = 31 -> 0..31 inclusive = 32 values). Frame index
    // maps directly to energy, ascending, no reversal: energy 0 -> frame 0
    // (ui_ammo0001), energy 31 -> frame 31 (ui_ammo0032), confirmed as the
    // intended mapping.
    const ammoFrames = this.animations.ui_ammo.frames;
    const ammoNativeFrame = this.textures.get('atlas').get(ammoFrames[0]);
    const ammoScale = (WIDTH * 0.6) / ammoNativeFrame.width;
    const ammoScaledWidth = ammoNativeFrame.width * ammoScale;
    const ammoScaledHeight = ammoNativeFrame.height * ammoScale;
    const ammoFrameIndex = this.state.energy;

    const ammoSprite = this.add.image(WIDTH / 2, y + ammoScaledHeight / 2, 'atlas', ammoFrames[ammoFrameIndex]);
    ammoSprite.setScale(ammoScale);
    this.dynamicHud.add(ammoSprite);

    // Energy count, centered in the sprite's circular badge. Badge center
    // measured directly from the source art (frame 1) as a fraction of the
    // native frame: ~9.9% in from the left edge, dead center vertically.
    const AMMO_BADGE_CX_FRAC = 0.099;
    const AMMO_BADGE_CY_FRAC = 0.5;
    const badgeX = WIDTH / 2 - ammoScaledWidth / 2 + AMMO_BADGE_CX_FRAC * ammoScaledWidth;
    const badgeY = y + AMMO_BADGE_CY_FRAC * ammoScaledHeight;
    const badgeText = this.add
      .text(badgeX, badgeY, `${this.state.energy}/${tune.energyMax}`, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#000000',
        align: 'center',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5, 0.5);
    this.dynamicHud.add(badgeText);

    y += ammoScaledHeight + 4;

    const nextInText =
      this.state.energy >= tune.energyMax
        ? 'Energy full'
        : `Next in ${Math.ceil(
            Math.max(0, tune.energyRegenMs - (Date.now() - this.state.energyTimestamp)) / 1000
          )}s`;
    this.hudText(WIDTH / 2, y, nextInText, 13, '#888888', 'center');

    y += 26;

    this.hudText(16, y, `Loot: ${this.state.currency}`, 16, '#ffe066');
    y += 30;

    const damage = shipDamage(this.state.shipLevel);
    const cost = upgradeCost(this.state.shipLevel);
    y = this.hudButton(
      16,
      y,
      WIDTH - 32,
      44,
      `Lvl ${this.state.shipLevel} | DMG ${damage} | Upgrade: ${cost} Loot`,
      () => this.onUpgrade(),
      { disabled: this.state.currency < cost, color: 0x226622 }
    );
    y += 10;

    if (this.state.tiles.every((t) => t.revealed)) {
      this.hudButton(16, y, WIDTH - 32, 48, `Descend to depth ${this.state.depth + 1}`, () => this.onDescend(), {
        color: 0x664411,
      });
    }
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
