import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** A texture's size in world pixels and where the art's ground point sits inside it. */
export interface ArtBox {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

/** Nodes and HQs: a 72 px tile wide, tall enough for the silo and the padlock above a node. */
export const NODE_BOX: ArtBox = { w: 100, h: 136, ox: 50, oy: 100 };

/** Texture pixels per world pixel. Above this many device pixels per world pixel the scene draws live vectors instead. */
export const ART_RES = 2;

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
