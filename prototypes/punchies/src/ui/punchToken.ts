import Phaser from 'phaser';
import { artKey } from '../render/art';

/** Two-tone token badge; UI art stays crisp at any display resolution. */
export function punchToken(scene: Phaser.Scene, x: number, y: number, radius: number, depth: number): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
  const key=artKey(scene,'punch_token');
  if(key){const image=scene.add.image(x,y,key).setDepth(depth);image.setScale(radius*2/Math.max(image.width,image.height));return image;}
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0x071326).fillCircle(x, y + 1, radius + 1.5);
  g.fillStyle(0x1688f4).fillCircle(x, y, radius);
  g.fillStyle(0xee454b).slice(x, y, radius, -Math.PI / 2, Math.PI / 2, false).fillPath();
  g.lineStyle(1.5, 0xffedc8).strokeCircle(x, y, radius);
  g.lineStyle(1, 0xffffff, 0.25).strokeCircle(x, y, radius - 2.5);
  // A compact glove silhouette with cuff and tucked thumb.
  g.fillStyle(0xfff4dc).fillRoundedRect(x - 3.5, y - 5, 7, 8, 2.5);
  g.fillRoundedRect(x - 5, y - 1.5, 3, 4, 1.5);
  g.fillRoundedRect(x - 3, y + 3.5, 6, 2, 0.7);
  return g;
}
