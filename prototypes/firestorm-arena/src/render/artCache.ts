import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** A texture's size in world pixels and where the art's ground point sits inside it. */
export interface ArtBox {
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** Texture pixels per world pixel for this box. */
  res: number;
}

/**
 * A 2x2 node: the pad with its rim glow and shadow (about 80 px below the ground point and either side), and up to
 * about 110 px above it for the tallest building, the padlock or the kind badge. Kept tight: it sets memory. At 2.5
 * texture pixels per world pixel a look is about 770 KB, with around 15 node looks a match.
 */
export const NODE_BOX: ArtBox = { w: 160, h: 192, ox: 80, oy: 112, res: 2.5 };

/** An HQ: one cell, so a much smaller box, baked a little sharper. About 400 KB a look. */
export const HQ_BOX: ArtBox = { w: 92, h: 122, ox: 45, oy: 78, res: 3 };

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
      g.scaleCanvas(box.res, box.res);
      draw(g, box.ox, box.oy);
      g.restore();
      g.generateTexture(k, Math.ceil(box.w * box.res), Math.ceil(box.h * box.res));
      g.destroy();
    }
    this.made.add(k);
    return k;
  }
}
