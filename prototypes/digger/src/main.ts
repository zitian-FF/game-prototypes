import Phaser from 'phaser';
import { bindSelectIntent } from './input/intents';
import { mountDebugPanelIfRequested } from './debug/debugPanel';
import { generateBoard, shipDamage, upgradeCost } from './state/board';
import { applyEnergyRegen } from './state/energy';
import { clearState, loadState, saveState } from './state/persistence';
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
const SHIP_SPACING = 40;

// Declared max board bound going forward. Board size is still fixed at
// gridCols=5, gridRows=6 for every board (see state/board.ts) -- these are
// only used to verify the scale-to-fit geometry below stays workable up to
// this bound once board-size-per-depth generation is implemented later.
const MAX_GRID_COLS_BOUND = 7;
const MAX_GRID_ROWS_BOUND = 9;

// Explicit depths for everything rendered in board-world space (via
// boardCamera): without these, Phaser stacks same-depth siblings by
// insertion order, and buildBoard() destroys/recreates tile sprites on
// every respawn (including descend), re-inserting them at the end of the
// display list — i.e. on top of anything created earlier, like
// debrisEmitter (built once in create()). Giving the board a fixed low
// depth and effects a fixed higher one makes the stacking independent of
// creation/recreation order. Any future board-camera-space game object
// should default to EFFECTS_DEPTH (or higher), not BOARD_DEPTH, so it
// stays above the board regardless of when it or the board was last
// rebuilt.
const BOARD_DEPTH = 0;
const EFFECTS_DEPTH = 10;

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
  // Ship/HUD art reference zoom (native art px -> logical screen px),
  // derived once from tune.gridCols so ship/ammo/laser art keeps a stable
  // scale regardless of the current board's actual size.
  private artZoom = 1;

  // Height (logical px) reserved below BOARD_VIEWPORT_TOP for the board
  // viewport, computed once at startup from real measured content (see
  // computeBoardViewportHeight) rather than a hardcoded constant, since it
  // depends on loaded texture dimensions.
  private boardViewportHeight = 0;
  // Per-board scale-to-fit zoom (native tile px -> logical screen px),
  // recomputed in buildBoard() from the board's actual current
  // gridCols/gridRows so it works for any board up to the declared max
  // bound without rework.
  private boardZoom = 1;

  // The board (tile grid) renders through its own camera: a fixed-size
  // viewport near the top of the canvas, showing the whole board scaled to
  // fit (no scrolling at any board size). `cameras.main` stays the fixed
  // logical-pixel camera (build tag, ship, HUD) used for select-intent
  // hit-testing, exactly like every other prototype's single main camera —
  // the board camera is additional, ignored by main and ignoring everything
  // main draws, mirroring the existing UI-camera-ignoring-game-world
  // pattern.
  private boardCamera!: Phaser.Cameras.Scene2D.Camera;
  private tileSprites: Phaser.GameObjects.Image[] = [];

  // Single persistent emitter, reused for every debris burst via .explode()
  // rather than one emitter per hit — Phaser pools/batches particles per
  // emitter, so reusing it is what keeps rapid tapping cheap. Lives in
  // board-world space alongside tileSprites (ignored by cameras.main), not
  // hudLayer, since it never needs to reach anything outside the board.
  private debrisEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  // Per-particle random spin rate (deg over its full lifespan), keyed by
  // the Particle instance itself so the rotate onUpdate op can look it up
  // every frame. A WeakMap avoids stashing untyped custom fields directly
  // on Phaser's Particle objects.
  private debrisSpinRates = new WeakMap<Phaser.GameObjects.Particles.Particle, number>();

  private hudLayer!: Phaser.GameObjects.Container;
  private dynamicHud?: Phaser.GameObjects.Container;
  private hudHitRegions: HitRegion[] = [];
  private hudBottom = 0;
  private ship!: Phaser.GameObjects.Sprite;

  // Transient (non-persisted) reset-button confirmation deadline. `null`
  // means "showing the default Reset label"; a future timestamp means
  // "showing Confirm reset? until this time". Deliberately not part of
  // GameState -- a confirmation-in-progress has no business surviving a
  // reload, and reload is literally what confirming does.
  private resetConfirmUntil: number | null = null;

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
    // projectile_laser runs at its own frame rate (below); excluded here
    // rather than overridden after the fact, since anims.create() refuses
    // to replace an already-existing key (it just warns and keeps the
    // original), so a second call for the same key would silently do
    // nothing.
    for (const [key, config] of Object.entries(this.animations)) {
      if (key === 'projectile_laser') continue;
      this.anims.create({
        key,
        frames: config.frames.map((frame) => ({ key: 'atlas', frame })),
        frameRate: 20,
        repeat: -1,
        yoyo: false,
      });
    }
    this.anims.create({
      key: 'projectile_laser',
      frames: this.animations.projectile_laser.frames.map((frame) => ({ key: 'atlas', frame })),
      frameRate: 15,
      repeat: -1,
      yoyo: false,
    });

    this.state = loadState();
    this.applyRegenCatchup();

    const tileFrame = this.textures.get('tile_grass').get();
    this.tileNativeWidth = tileFrame.width;
    this.tileNativeHeight = tileFrame.height;

    const gridScreenWidth = WIDTH - GRID_MARGIN_X * 2;
    const tileScreenWidth = gridScreenWidth / tune.gridCols;
    this.artZoom = tileScreenWidth / this.tileNativeWidth;

    this.computeBoardViewportHeight();
    this.verifyMaxBoundFits();

    this.setUpCameras();
    this.buildBoard();
    this.buildDebrisEmitter();
    this.buildHud();

    bindSelectIntent(this, (worldX, worldY) => this.onTap(worldX, worldY));

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

  // Computes the board viewport height from real measured content rather
  // than a hardcoded constant, since it depends on loaded texture
  // dimensions: everything that must fit below the board (ship spacing +
  // ship + ammo sprite + text rows + buttons + margin), mirroring
  // buildShip()'s hudBottom derivation and renderHud()'s layout flow
  // exactly so the board viewport never overlaps or leaves a gap before the
  // HUD content beneath it.
  private computeBoardViewportHeight(): void {
    const shipFrames = this.animations.player_ship.frames;
    const shipFrame = this.textures.get('atlas').get(shipFrames[0]);
    const shipHeightScaled = shipFrame.height * this.artZoom;

    const ammoFrames = this.animations.ui_ammo.frames;
    const ammoNativeFrame = this.textures.get('atlas').get(ammoFrames[0]);
    const ammoScale = (WIDTH * 0.6) / ammoNativeFrame.width;
    const ammoScaledHeight = ammoNativeFrame.height * ammoScale;

    this.boardViewportHeight =
      SHIP_SPACING + shipHeightScaled + 20 + ammoScaledHeight + 4 + 26 + 30 + 44 + 10 + 48 + 16;
  }

  // Verifies the declared max board bound (MAX_GRID_COLS_BOUND x
  // MAX_GRID_ROWS_BOUND) still yields a tappable tile size once real
  // measured geometry is known, per every axis a future max-size board
  // could be constrained by. This does not change layout or force a pass —
  // it only reports, so a future regression here is visible rather than
  // silently shipped.
  private verifyMaxBoundFits(): void {
    const heightPathPx = this.boardViewportHeight / MAX_GRID_ROWS_BOUND;
    const heightPathOk = heightPathPx >= tune.minTileTapPx;
    const widthPathPx = (WIDTH - GRID_MARGIN_X * 2) / MAX_GRID_COLS_BOUND;
    const widthPathOk = widthPathPx >= tune.minTileTapPx;
    // eslint-disable-next-line no-console
    console.log(
      `[digger] boardViewportHeight=${this.boardViewportHeight.toFixed(2)}px ` +
        `maxBound height-path=${heightPathPx.toFixed(2)}px (${heightPathOk ? 'OK' : 'FAIL'}) ` +
        `width-path=${widthPathPx.toFixed(2)}px (${widthPathOk ? 'OK' : 'FAIL'}) ` +
        `vs minTileTapPx=${tune.minTileTapPx}`
    );
    if (!heightPathOk || !widthPathOk) {
      console.warn(
        '[digger] max board bound (7x9) would not meet minTileTapPx at current geometry -- see BUILD_STATUS.md'
      );
    }
  }

  private setUpCameras(): void {
    this.cameras.main.setZoom(PIXEL_RATIO);
    this.cameras.main.centerOn(WIDTH / 2, HEIGHT / 2);

    this.boardCamera = this.cameras.add(
      0,
      BOARD_VIEWPORT_TOP * PIXEL_RATIO,
      WIDTH * PIXEL_RATIO,
      this.boardViewportHeight * PIXEL_RATIO
    );
    this.boardCamera.setBackgroundColor(0x0a0a0a);

    // Cameras render in the order they appear in this.cameras.cameras, and
    // boardCamera was just appended after main, so without this it would
    // draw on top and its opaque background/tiles would occlude anything
    // in hudLayer wherever it visually overlaps the board viewport (e.g.
    // the laser effect's endpoint, which lands on a tile by design). Move
    // main to the end so the fixed HUD camera always renders last/on top.
    const cameraList = this.cameras.cameras;
    cameraList.splice(cameraList.indexOf(this.cameras.main), 1);
    cameraList.push(this.cameras.main);
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
      sprite.setDepth(BOARD_DEPTH);
      this.tileSprites.push(sprite);
    }
    this.cameras.main.ignore(this.tileSprites);

    const widthConstraintZoom = (WIDTH - GRID_MARGIN_X * 2) / this.state.gridCols / this.tileNativeWidth;
    const heightConstraintZoom = this.boardViewportHeight / (this.state.gridRows * this.tileNativeHeight);
    this.boardZoom = Math.min(widthConstraintZoom, heightConstraintZoom);
    this.boardCamera.setZoom(this.boardZoom * PIXEL_RATIO);

    // Centering on the board's own world-center, with the camera's fixed
    // viewport sized independently of the board's world size, is what
    // auto-centers the board within the viewport on whichever axis has
    // slack (the axis whose constraint above didn't bind) -- no separate
    // pan/clamp logic needed.
    const gridWorldWidth = this.state.gridCols * this.tileNativeWidth;
    const gridWorldHeight = this.state.gridRows * this.tileNativeHeight;
    this.boardCamera.centerOn(gridWorldWidth / 2, gridWorldHeight / 2);
  }

  // Created once; every hit reuses this same emitter via .explode() rather
  // than spawning a new one, so pooling/batching actually pays off under
  // rapid tapping. Frame array randomizes per-particle by default (Phaser's
  // setEmitterFrame defaults pickRandom to true for an array of frames) —
  // verified visually, no onEmit fallback needed. Continuous per-particle
  // spin (direction and speed both randomized) isn't expressible via a
  // plain rotate: {min,max} range, which only assigns one static value at
  // emit time — instead rotate uses the onEmit/onUpdate custom-op pair:
  // onEmit rolls a random deg-per-lifespan spin rate and stashes it in
  // debrisSpinRates, onUpdate reads it back and scales it by the
  // particle's lifetime progress (t, 0-1) every frame.
  private buildDebrisEmitter(): void {
    this.debrisEmitter = this.add.particles(0, 0, 'atlas', {
      frame: this.animations.fx_debris.frames,
      scale: { min: tune.debrisScaleMin, max: tune.debrisScaleMax },
      lifespan: { min: tune.debrisLifespanMinMs, max: tune.debrisLifespanMaxMs },
      alpha: { start: 1, end: 0 },
      // Phaser particle angle: 0deg = right, increasing clockwise (screen
      // space, Y-down) -- so "up" is -90deg, and a cone half-angle widens
      // symmetrically around that.
      angle: { min: -90 - tune.debrisConeHalfAngleDeg, max: -90 + tune.debrisConeHalfAngleDeg },
      speed: { min: tune.debrisSpeedMin, max: tune.debrisSpeedMax },
      gravityY: tune.debrisGravityY,
      rotate: {
        onEmit: (particle) => {
          if (particle) {
            const spinRate = Phaser.Math.Between(tune.debrisRotationSpeedMinDeg, tune.debrisRotationSpeedMaxDeg);
            this.debrisSpinRates.set(particle, spinRate);
          }
          return 0;
        },
        onUpdate: (particle, _key, t) => (this.debrisSpinRates.get(particle) ?? 0) * t,
      },
      emitting: false,
    });
    this.debrisEmitter.setDepth(EFFECTS_DEPTH);
    this.cameras.main.ignore(this.debrisEmitter);
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

    // Functional-only border marking the board region, so it reads as
    // distinct from the fixed HUD below it.
    const border = this.add.rectangle(
      WIDTH / 2,
      BOARD_VIEWPORT_TOP + this.boardViewportHeight / 2,
      WIDTH - GRID_MARGIN_X * 2 + 8,
      this.boardViewportHeight + 8
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
    const shipY = BOARD_VIEWPORT_TOP + this.boardViewportHeight + SHIP_SPACING + shipHalfHeight;

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

  // --- board <-> screen conversion --------------------------------------

  // Inverse of boardWorldToScreen below -- mirrors it exactly. Both share
  // the same viewport-center point and board-world-center point that
  // buildBoard() used to zoom/center the board camera, so together they
  // stay correct for any board size up to the declared max bound with no
  // further changes.
  private screenToBoardWorld(screenX: number, screenY: number): { x: number; y: number } {
    const gridWorldWidth = this.state.gridCols * this.tileNativeWidth;
    const gridWorldHeight = this.state.gridRows * this.tileNativeHeight;
    const viewportCenterX = WIDTH / 2;
    const viewportCenterY = BOARD_VIEWPORT_TOP + this.boardViewportHeight / 2;
    return {
      x: gridWorldWidth / 2 + (screenX - viewportCenterX) / this.boardZoom,
      y: gridWorldHeight / 2 + (screenY - viewportCenterY) / this.boardZoom,
    };
  }

  private boardWorldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const gridWorldWidth = this.state.gridCols * this.tileNativeWidth;
    const gridWorldHeight = this.state.gridRows * this.tileNativeHeight;
    const viewportCenterX = WIDTH / 2;
    const viewportCenterY = BOARD_VIEWPORT_TOP + this.boardViewportHeight / 2;
    return {
      x: viewportCenterX + (worldX - gridWorldWidth / 2) * this.boardZoom,
      y: viewportCenterY + (worldY - gridWorldHeight / 2) * this.boardZoom,
    };
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
    if (screenY < BOARD_VIEWPORT_TOP || screenY > BOARD_VIEWPORT_TOP + this.boardViewportHeight) return;
    if (screenX < 0 || screenX > WIDTH) return;

    // A tap landing in the letterboxed slack space (the axis the board's
    // zoom didn't bind on) converts to a board-world point outside the
    // board's own bounds, which the col/row range check below rejects --
    // no separate letterbox-bounds check needed.
    const boardPoint = this.screenToBoardWorld(screenX, screenY);
    const col = Math.floor(boardPoint.x / this.tileNativeWidth);
    const row = Math.floor(boardPoint.y / this.tileNativeHeight);
    if (col < 0 || col >= this.state.gridCols || row < 0 || row >= this.state.gridRows) return;

    const index = row * this.state.gridCols + col;
    const tile = this.state.tiles[index];
    if (!tile || tile.revealed) return;

    this.applyRegenCatchup();
    if (this.state.energy < 1) return;

    this.state.energy -= 1;
    tile.hp -= shipDamage(this.state.shipLevel);

    // Tile screen position, in the same fixed screen space as the ship —
    // mirrors the board-hit-test math above exactly (via the same
    // boardWorldToScreen/screenToBoardWorld pair) so the laser lands
    // pixel-accurate on the tile that was tapped.
    const tileWorldX = (col + 0.5) * this.tileNativeWidth;
    const tileWorldYCenter = (row + 0.5) * this.tileNativeHeight;
    const tileScreen = this.boardWorldToScreen(tileWorldX, tileWorldYCenter);
    this.fireLaser(this.ship.x, this.ship.y, tileScreen.x, tileScreen.y);

    // Tile board-world position (same space as tileSprites, and the same
    // formula buildBoard uses to place them) for the debris burst, which
    // stays entirely within the board and needs no cross-camera conversion.
    this.debrisEmitter.explode(
      Phaser.Math.Between(tune.debrisWeakCountMin, tune.debrisWeakCountMax),
      tileWorldX,
      tileWorldYCenter
    );

    if (tile.hp <= 0) {
      tile.hp = 0;
      tile.revealed = true;
      this.state.currency += tile.loot;
      this.tileSprites[index].setTexture('tile_hole');
      this.debrisEmitter.explode(
        Phaser.Math.Between(tune.debrisStrongCountMin, tune.debrisStrongCountMax),
        tileWorldX,
        tileWorldYCenter
      );
    }

    saveState(this.state);
    this.renderHud();
  }

  // Ship-to-tile hit effect on every successful damage tap. Both endpoints
  // are already in the fixed HUD-camera's screen space (this.ship.x/y
  // directly; the tapped tile converted by the caller), so the sprite
  // lives in hudLayer alongside the ship — fixed screen space, ignored by
  // boardCamera, unclipped by the board viewport it visually crosses.
  private fireLaser(fromX: number, fromY: number, toX: number, toY: number): void {
    const frames = this.animations.projectile_laser.frames;
    const nativeFrame = this.textures.get('atlas').get(frames[0]);

    const sprite = this.add.sprite(fromX, fromY, 'atlas', frames[0]);
    sprite.setOrigin(0, 0.5); // left edge anchors at fromX/fromY
    sprite.play('projectile_laser');

    const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    sprite.setRotation(angle);
    sprite.setScale(distance / nativeFrame.width, this.artZoom);

    this.hudLayer.add(sprite);

    this.tweens.add({
      targets: sprite,
      alpha: 0,
      scaleY: 0,
      duration: tune.laserFadeMs,
      onComplete: () => sprite.destroy(),
    });
  }

  private onUpgrade(): void {
    const cost = upgradeCost(this.state.shipLevel);
    if (this.state.currency < cost) return;
    this.state.currency -= cost;
    this.state.shipLevel += 1;
    saveState(this.state);
    this.renderHud();
  }

  // Same-button two-step confirm: first tap arms a countdown and switches
  // the label/color; a second tap while still armed actually resets.
  // Clearing localStorage then reloading is simpler and less error-prone
  // than manually resetting every transient scene field by hand.
  private onResetButtonTap(): void {
    const now = Date.now();
    if (this.resetConfirmUntil !== null && now < this.resetConfirmUntil) {
      clearState();
      window.location.reload();
      return;
    }
    this.resetConfirmUntil = now + tune.resetConfirmWindowMs;
    this.renderHud();
  }

  private onDescend(): void {
    if (this.state.tiles.some((t) => !t.revealed)) return;
    this.state.depth += 1;
    // Board size is fixed at gridCols/gridRowsBase for every board,
    // including post-descend -- board-size-per-depth generation is
    // deferred to a future task (see BUILD_STATUS.md).
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

    // Auto-cancel: no timer of its own -- this runs every renderHud() call,
    // including the existing 1s regen-tick timer, so a confirmation that's
    // gone unconfirmed past its window reverts on its own next tick, same
    // pattern the "Next in Ns" countdown below already relies on.
    const resetConfirming = this.resetConfirmUntil !== null && Date.now() < this.resetConfirmUntil;
    if (this.resetConfirmUntil !== null && !resetConfirming) {
      this.resetConfirmUntil = null;
    }

    const RESET_BUTTON_W = 140;
    const RESET_BUTTON_H = 32;
    this.hudButton(
      WIDTH - 16 - RESET_BUTTON_W,
      12,
      RESET_BUTTON_W,
      RESET_BUTTON_H,
      resetConfirming ? 'Confirm reset?' : 'Reset',
      () => this.onResetButtonTap(),
      { color: resetConfirming ? 0xaa2222 : 0x333333 }
    );

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
