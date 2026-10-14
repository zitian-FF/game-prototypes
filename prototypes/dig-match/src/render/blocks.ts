import Phaser from 'phaser';
import { bakePillow, crackPaths, drawCrack, mix, shade } from 'dig-kit';
import type { Block } from '../game/types';
import { tune } from '../tune';

// Block colours (index = Block.color). Saturated pastels, matching dice-dig.
export const BLOCK_COLORS = [0x5ed957, 0xffa23a, 0x4d9bff, 0xff6fb5, 0xffd93a];
export const ROCK_COLOR = 0x9fb0d6;
const SLAB = 7;

export interface BlockGeo {
  /** Drawn block size (cell size minus the gap). */
  bw: number;
  bh: number;
}

export const colorKey = (c: number) => `dm_blk_${c}`;
const rockTopKey = (hp: number) => `dm_rock_top_${hp}`;

/** Bakes every texture the blocks need, once. */
export function bakeBlockTextures(scene: Phaser.Scene, geo: BlockGeo): void {
  const r = Math.min(geo.bw, geo.bh) * tune.block.cornerRadius;
  BLOCK_COLORS.forEach((col, i) => bakePillow(scene, colorKey(i), geo.bw, geo.bh, r, col, true));
  for (let hp = 1; hp <= 3; hp++) bakePillow(scene, rockTopKey(hp), geo.bw, geo.bh - SLAB * (hp - 1), r, ROCK_COLOR, true);
  bakePillow(scene, 'dm_rock_low', geo.bw, SLAB * 2, Math.min(r, SLAB), shade(ROCK_COLOR, 0.78), false);
}

/** One block on the board: a container of sprites that the scene moves and tweens. */
export class BlockView {
  readonly container: Phaser.GameObjects.Container;
  private maxHp: number;
  private cracks: Phaser.GameObjects.Graphics | null = null;
  private weakMark: Phaser.GameObjects.Graphics | null = null;
  private body: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, readonly block: Block, x: number, y: number, private geo: BlockGeo) {
    this.maxHp = block.hp;
    this.container = scene.add.container(x, y);
    this.build();
  }

  get id(): number {
    return this.block.id;
  }

  private build(): void {
    const { bw, bh } = this.geo;
    for (const o of this.body) o.destroy();
    this.body = [];
    this.cracks?.destroy();
    this.cracks = null;
    const b = this.block;
    if (b.rock) {
      const n = b.hp - 1;
      const topH = bh - SLAB * n;
      for (let k = n; k >= 1; k--) {
        const edge = -bh / 2 + topH + SLAB * k;
        this.body.push(this.scene.add.image(0, edge - SLAB, 'dm_rock_low').setDisplaySize(bw, SLAB * 2));
      }
      this.body.push(this.scene.add.image(0, -bh / 2 + topH / 2, rockTopKey(b.hp)).setDisplaySize(bw, topH));
      if (b.hp < this.maxHp) {
        const g = this.scene.add.graphics();
        const count = this.maxHp - b.hp + 1;
        for (const path of crackPaths(b.id, count + 1)) {
          const pts = path.map((p) => ({ x: -bw / 2 + p.x * bw, y: -bh / 2 + p.y * topH }));
          drawCrack(g, pts, 2 + (this.maxHp - b.hp) * 1.2, 0x3a2a55);
        }
        this.cracks = g;
      }
    } else {
      this.body.push(this.scene.add.image(0, 0, colorKey(b.color)).setDisplaySize(bw, bh));
    }
    this.container.add(this.body);
    if (this.cracks) this.container.add(this.cracks);
    if (b.weak && !this.weakMark) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xff9db4, 0.35);
      g.fillCircle(0, 0, bw * 0.28);
      g.lineStyle(2.5, 0xff2f6a, 1);
      g.beginPath();
      g.moveTo(-bw * 0.16, -bw * 0.1);
      g.lineTo(bw * 0.16, bw * 0.1);
      g.moveTo(bw * 0.16, -bw * 0.1);
      g.lineTo(-bw * 0.16, bw * 0.1);
      g.strokePath();
      this.weakMark = g;
      this.container.add(g);
      this.scene.tweens.add({ targets: g, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
    }
  }

  /** Re-skins the block after a recolour or after a rock lost health. */
  refresh(): void {
    this.build();
    if (this.weakMark) this.container.bringToTop(this.weakMark);
  }

  /** Colour used for break particles. */
  get tint(): number {
    return this.block.rock ? ROCK_COLOR : mix(BLOCK_COLORS[this.block.color], 0xffffff, 0.15);
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    if (this.weakMark) this.scene.tweens.killTweensOf(this.weakMark);
    this.container.destroy();
  }
}
