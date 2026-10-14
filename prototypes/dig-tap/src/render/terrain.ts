import Phaser from 'phaser';
import { PIXEL_RATIO, bakePillow, bakeTexture, crackPaths, drawCrack } from 'dig-kit';
import type { Block } from '../game/terrain';
import { tune } from '../tune';

// Strata colours by depth band: grass, dirt, clay, sand, stone, slate, crystal.
export const STRATA = [0x5ed957, 0xd98f4a, 0xff7a59, 0xffd04a, 0x8fa3d1, 0x6f7df0, 0xc070ff];
const ROCK_COLOR = 0x7d879f;
const TNT_COLOR = 0xe8434f;
const CRYSTAL_COLOR = 0xb45cff;
const terKey = (s: number) => `dm_ter_${s}`;

export interface TerrainGeo {
  bw: number;
  bh: number;
}

export function bakeTerrainTextures(scene: Phaser.Scene, geo: TerrainGeo): void {
  const r = Math.min(geo.bw, geo.bh) * 0.3;
  STRATA.forEach((c, i) => bakePillow(scene, terKey(i), geo.bw, geo.bh, r, c, true));
  bakePillow(scene, 'dt_rock', geo.bw, geo.bh, r * 0.8, ROCK_COLOR, true);
  bakePillow(scene, 'dt_tnt', geo.bw, geo.bh, r, TNT_COLOR, true);
  bakePillow(scene, 'dt_crystal', geo.bw, geo.bh, r, CRYSTAL_COLOR, true);
  bakeTexture(scene, 'dm_gem', 26, 26, (g, res) => {
    const s = res * 26;
    const pts = [
      { x: s * 0.5, y: s * 0.04 },
      { x: s * 0.94, y: s * 0.4 },
      { x: s * 0.5, y: s * 0.96 },
      { x: s * 0.06, y: s * 0.4 },
    ];
    g.fillStyle(0x2fd0ff, 1);
    g.fillPoints(pts, true);
    g.fillStyle(0x9af0ff, 1);
    g.fillPoints([pts[0], pts[1], { x: s * 0.5, y: s * 0.4 }], true);
    g.fillStyle(0x0e8fd0, 1);
    g.fillPoints([pts[3], { x: s * 0.5, y: s * 0.4 }, pts[2]], true);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(s * 0.38, s * 0.26, s * 0.07);
  });
  bakeTexture(scene, 'dm_orb', 16, 16, (g, res) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(8 * res, 8 * res, 8 * res);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8 * res, 8 * res, 5 * res);
  });
}

const textureFor = (b: Block): string => (b.kind === 'rock' ? 'dt_rock' : b.kind === 'tnt' ? 'dt_tnt' : b.kind === 'crystal' ? 'dt_crystal' : terKey(b.strata));

/**
 * One block on the board: pillow, cracks that grow with damage, and a marker
 * for what it is (rivets for rock, TNT label, crystal facets, gem glint).
 * It falls under gravity toward the row the rules say it belongs in.
 */
export class TerrainView {
  readonly container: Phaser.GameObjects.Container;
  private cracks: Phaser.GameObjects.Graphics;
  private flashG: Phaser.GameObjects.Graphics;
  private glint: Phaser.GameObjects.Image | null = null;
  shake = 0;
  flash = 0;
  /** Falling state, in px. */
  vy = 0;
  placed = false;
  /** Board row this block is drawn at (lags the rules while a chain plays). */
  targetRow = 0;

  constructor(private scene: Phaser.Scene, readonly block: Block, private geo: TerrainGeo) {
    this.container = scene.add.container(0, 0);
    const img = scene.add.image(0, 0, textureFor(block)).setDisplaySize(geo.bw, geo.bh);
    this.cracks = scene.add.graphics();
    this.flashG = scene.add.graphics();
    this.container.add([img]);
    this.decorate();
    this.container.add([this.cracks, this.flashG]);
    if (block.gem > 0) {
      this.glint = scene.add.image(0, 0, 'dm_gem').setDisplaySize(22, 22).setAlpha(0.9);
      this.container.add(this.glint);
      scene.tweens.add({ targets: this.glint, scale: this.glint.scale * 1.18, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    this.redrawCracks();
  }

  private decorate(): void {
    const { bw, bh } = this.geo;
    const g = this.scene.add.graphics();
    const b = this.block;
    if (b.kind === 'rock') {
      g.fillStyle(0x2c2f3a, 0.9);
      for (const [x, y] of [[-0.36, -0.34], [0.36, -0.34], [0.36, 0.34], [-0.36, 0.34]]) g.fillCircle(x * bw, y * bh, 2.6);
      g.lineStyle(3, 0x2c2f3a, 0.75);
      g.beginPath();
      g.moveTo(-bw * 0.16, -bh * 0.14);
      g.lineTo(bw * 0.16, bh * 0.14);
      g.moveTo(bw * 0.16, -bh * 0.14);
      g.lineTo(-bw * 0.16, bh * 0.14);
      g.strokePath();
    } else if (b.kind === 'tnt') {
      const t = this.scene.add
        .text(0, 1, 'TNT', { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: '17px', color: '#fff3c4', stroke: '#7a1620', strokeThickness: 3, resolution: PIXEL_RATIO })
        .setOrigin(0.5);
      this.container.add(t);
      g.fillStyle(0xffd23f, 1);
      g.fillCircle(bw * 0.32, -bh * 0.36, 4);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(bw * 0.32, -bh * 0.36, 2);
    } else if (b.kind === 'crystal') {
      const s = Math.min(bw, bh) * 0.3;
      g.fillStyle(0xffffff, 0.8);
      g.fillPoints([{ x: 0, y: -s }, { x: s * 0.7, y: 0 }, { x: 0, y: s }, { x: -s * 0.7, y: 0 }], true);
      g.fillStyle(0xe2c2ff, 1);
      g.fillPoints([{ x: 0, y: -s }, { x: s * 0.7, y: 0 }, { x: 0, y: 0 }], true);
    }
    this.container.add(g);
  }

  /** Cracks add up as hp falls: more arms, thicker grooves. */
  redrawCracks(): void {
    const { hp, maxHp } = this.block;
    const g = this.cracks;
    g.clear();
    if (hp >= maxHp) return;
    const dmg = 1 - hp / maxHp;
    const { bw, bh } = this.geo;
    for (const path of crackPaths(this.block.id * 31 + 7, 1 + Math.ceil(dmg * 4))) {
      const pts = path.map((p) => ({ x: -bw / 2 + p.x * bw, y: -bh / 2 + p.y * bh }));
      drawCrack(g, pts, 2.2 + dmg * 4.5, 0x3a2a55);
    }
    g.fillStyle(0x000000, dmg * 0.14);
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, Math.min(bw, bh) * 0.3);
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - (dt * 1000) / tune.feel.tapShakeMs);
    this.flash = Math.max(0, this.flash - (dt * 1000) / tune.feel.tapFlashMs);
    this.flashG.clear();
    if (this.flash > 0.01) {
      this.flashG.fillStyle(0xffffff, Math.min(0.85, this.flash));
      this.flashG.fillRoundedRect(-this.geo.bw / 2, -this.geo.bh / 2, this.geo.bw, this.geo.bh, Math.min(this.geo.bw, this.geo.bh) * 0.3);
    }
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    if (this.glint) this.scene.tweens.killTweensOf(this.glint);
    this.container.destroy();
  }
}
