import type Phaser from 'phaser';
import { mix, shade } from './color';

/**
 * A soft pillow: concentric rounded rects that lighten toward the centre fake
 * the smooth shading of a rounded cube. Expensive to draw live, so bake it
 * once with `bakePillow` and draw the texture as a sprite.
 */
export function pillow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, base: number, glossy: boolean): void {
  const steps = 10;
  const inset = Math.min(w, h) * 0.034;
  for (let j = 0; j <= steps; j++) {
    const t = j / steps;
    const i = j * inset;
    const col = mix(shade(base, 0.62), mix(base, 0xffffff, 0.2), Math.pow(t, 0.8));
    // Light comes from the top left: the lit core sits up and left of centre.
    g.fillStyle(col, 1);
    g.fillRoundedRect(x + i * 0.75, y + i * 0.55, w - i * 1.9, h - i * 1.7, Math.max(1, r - i * 0.8));
  }
  if (glossy) {
    g.fillStyle(0xffffff, 0.42);
    g.fillRoundedRect(x + w * 0.14, y + h * 0.1, w * 0.36, Math.max(3, h * 0.12), 3);
    g.fillStyle(0xffffff, 0.2);
    g.fillCircle(x + w * 0.82, y + h * 0.17, Math.max(2, w * 0.04));
  }
}

/** Texture resolution multiplier used when baking, for sharp sprites on high-density screens. */
export const BAKE_RES = 2;

/** Bakes a Graphics drawing into a texture, sized in logical pixels. */
export function bakeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics, res: number) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g, BAKE_RES);
  g.generateTexture(key, Math.ceil(w * BAKE_RES), Math.ceil(h * BAKE_RES));
  g.destroy();
}

/** Bakes one pillow texture. Draw it with setDisplaySize(w, h). */
export function bakePillow(scene: Phaser.Scene, key: string, w: number, h: number, radius: number, color: number, glossy: boolean): void {
  bakeTexture(scene, key, w, h, (g, res) => pillow(g, 0, 0, w * res, h * res, radius * res, color, glossy));
}
