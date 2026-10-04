import Phaser from 'phaser';
import { tune } from '../sim/tune';
import { pose } from './art';

// What touches the floor under a boxer: the separate feet layer from the art
// (`<body key>_feet`, same canvas and registration as the body) plus a soft
// ground shadow. Both sit below the body in screen Y so the body reads as
// standing above the floor under the ring tilt. The shadow always falls the
// same way, whichever way the boxer faces. Presentation only: hitboxes stay
// on the body at the sim position.
export class GroundLayer {
  private shadow: Phaser.GameObjects.Graphics;
  private feet: Phaser.GameObjects.Image;

  // Below the body sprites (depth 10 and 11), above the ring floor.
  constructor(scene: Phaser.Scene, private bodyRadius: number, depth = 9) {
    this.shadow = scene.add.graphics().setDepth(depth);
    this.feet = scene.add.image(0, 0, '__DEFAULT').setDepth(depth).setVisible(false);
  }

  // bodyKey: the body animation key, e.g. "marco_walk". scale: the boxer's
  // character scale (the sprite is drawn at half size times this).
  draw(bodyKey: string, progress: number, x: number, y: number, rotation: number, scale: number, alpha: number): void {
    const v = tune.view;
    const g = this.shadow;
    g.clear();
    g.fillStyle(0x000000, v.shadowAlpha * alpha);
    g.fillEllipse(x, y + v.shadowOffsetY, this.bodyRadius * 2.3 * scale * v.shadowSize, this.bodyRadius * 1.5 * scale * v.shadowSize);
    if (pose(this.feet, `${bodyKey}_feet`, progress)) {
      this.feet.setPosition(x, y + v.feetOffsetY).setScale(scale / 2).setRotation(rotation).setAlpha(alpha);
    }
  }

  hide(): void {
    this.shadow.clear();
    this.feet.setVisible(false);
  }
}
