import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** A texture's size in world pixels and where the art's ground point sits inside it. */
export interface ArtBox {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

/**
 * Nodes and HQs: the pad with its rim glow and shadow (about 42 px below the ground point and either side), and
 * up to about 70 px above it for the tallest building, the padlock or the kind badge. Kept tight: it sets memory.
 */
export const NODE_BOX: ArtBox = { w: 92, h: 122, ox: 45, oy: 78 };

/**
 * Texture pixels per world pixel. 3 keeps a phone at its default zoom on baked art (live vectors there would cost
 * more geometry, and so more draw calls). About 30 looks per match at roughly 400 KB each.
 */
export const ART_RES = 3;

/**
 * Static vector art rendered once per look into a texture. Redrawing every node and HQ as vectors each frame was most
 * of the frame cost; a texture is one quad. Keys carry everything that changes the look (kind, colours, frame).
 */
export class ArtCache {
  private readonly made = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  texture(key: string, box: ArtBox, draw: (g: G, x: number, y: number) => void): string {
    const k = `art:${key}`;
    if (this.made.has(k)) return k;
    if (!this.scene.textures.exists(k)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.save();
      g.scaleCanvas(ART_RES, ART_RES);
      draw(g, box.ox, box.oy);
      g.restore();
      g.generateTexture(k, box.w * ART_RES, box.h * ART_RES);
      g.destroy();
    }
    this.made.add(k);
    return k;
  }
}
