import Phaser from 'phaser';
import { tune } from '../sim/tune';
import type { Fighter } from '../sim/types';

// Two overlapping equipment pads. The body position and hitboxes never move.
export class TrainingDummy {
  private body: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private headHit = -Infinity;
  private bodyHit = -Infinity;

  constructor(private scene: Phaser.Scene) {
    this.body = scene.add.image(0, 0, '__DEFAULT').setDepth(10).setVisible(false);
    this.head = scene.add.image(0, 0, '__DEFAULT').setDepth(10.2).setVisible(false);
  }

  strike(zone: 'head' | 'body', now: number): void {
    if (zone === 'head') this.headHit = now;
    else this.bodyHit = now;
  }

  hide(): void {
    this.body.setVisible(false);
    this.head.setVisible(false);
  }

  draw(f: Fighter, now: number, scale: number): boolean {
    const bodyKey = 'punchies:training_dummy_body';
    const headKey = 'punchies:training_dummy_head';
    if (!this.scene.textures.exists(bodyKey) || !this.scene.textures.exists(headKey)) {
      this.hide();
      return false;
    }
    const v = tune.view;
    const d = v.trainingDummy;
    const angle = Math.atan2(f.fy, f.fx);
    const place = (img: Phaser.GameObjects.Image, key: string, height: number, forward: number, dy: number, hit: number) => {
      const elapsed = Math.max(0, now - hit);
      const envelope = Math.max(0, 1 - elapsed / d.shakeMs) ** 2;
      const phase = envelope > 0 ? elapsed * d.shakeHz * Math.PI * 2 / 1000 : 0;
      const lateral = Math.sin(phase) * d.shakeDistance * envelope * scale;
      img.setTexture(key).setOrigin(0.5).setScale(height * scale / img.height)
        .setPosition(f.x + f.fx * forward * scale + f.fy * lateral,
          f.y + f.fy * forward * scale - f.fx * lateral + dy)
        .setRotation(angle + Math.sin(phase + Math.PI / 2) * d.shakeAngle * envelope)
        .setVisible(true);
    };
    place(this.body, bodyKey, d.bodyHeight, 0, v.bodyOffsetY, this.bodyHit);
    place(this.head, headKey, d.headHeight, d.headForward, v.headOffsetY, this.headHit);
    return true;
  }
}
