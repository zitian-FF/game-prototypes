import Phaser from 'phaser';
import { bakePillow, bakeTexture, crackPaths, drawCrack } from 'dig-kit';
import type { TerrainCell } from '../game/terrain';
import { tune } from '../tune';

// Strata colours by depth band: grass, dirt, clay, sand, stone, slate, crystal.
export const STRATA = [0x5ed957, 0xd98f4a, 0xff7a59, 0xffd04a, 0x8fa3d1, 0x6f7df0, 0xc070ff];
const terKey = (s: number) => `dm_ter_${s}`;

export interface TerrainGeo {
  bw: number;
  bh: number;
}

export function bakeTerrainTextures(scene: Phaser.Scene, geo: TerrainGeo): void {
  const r = Math.min(geo.bw, geo.bh) * 0.3;
  STRATA.forEach((c, i) => bakePillow(scene, terKey(i), geo.bw, geo.bh, r, c, true));
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

/** One unbroken terrain block: pillow, cracks that grow with damage, and a gem glint if treasure is buried. */
export class TerrainView {
  readonly container: Phaser.GameObjects.Container;
  private cracks: Phaser.GameObjects.Graphics;
  private flashG: Phaser.GameObjects.Graphics;
  private glint: Phaser.GameObjects.Image | null = null;
  shake = 0;
  flash = 0;

  constructor(private scene: Phaser.Scene, readonly cell: TerrainCell, private geo: TerrainGeo, private seed: number) {
    this.container = scene.add.container(0, 0);
    const img = scene.add.image(0, 0, terKey(cell.strata)).setDisplaySize(geo.bw, geo.bh);
    this.cracks = scene.add.graphics();
    this.flashG = scene.add.graphics();
    this.container.add([img, this.cracks, this.flashG]);
    if (cell.gem > 0) {
      this.glint = scene.add.image(0, 0, 'dm_gem').setDisplaySize(22, 22).setAlpha(0.9);
      this.container.add(this.glint);
      scene.tweens.add({ targets: this.glint, scale: this.glint.scale * 1.18, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    this.redrawCracks();
  }

  /** Cracks add up as hp falls: more arms, thicker grooves. */
  redrawCracks(): void {
    const { hp, maxHp } = this.cell;
    const g = this.cracks;
    g.clear();
    if (hp >= maxHp) return;
    const dmg = 1 - hp / maxHp;
    const { bw, bh } = this.geo;
    for (const path of crackPaths(this.seed, 1 + Math.ceil(dmg * 4))) {
      const pts = path.map((p) => ({ x: -bw / 2 + p.x * bw, y: -bh / 2 + p.y * bh }));
      drawCrack(g, pts, 2.2 + dmg * 4.5, 0x3a2a55);
    }
    // Crack lines darken the surface a little more as it weakens.
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
