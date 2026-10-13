import Phaser from 'phaser';
import { tune } from '../sim/tune';
import type { Fighter } from '../sim/types';

// Two overlapping equipment pads. The body position and hitboxes never move.
export class TrainingDummy {
  private body: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private gloves: Phaser.GameObjects.Image[];
  private arms: Phaser.GameObjects.Graphics;
  private pose: { forward: number; spread: number; drop: number } | null = null;
  private lastDraw = 0;
  private headHit = -Infinity;
  private bodyHit = -Infinity;

  constructor(private scene: Phaser.Scene) {
    this.body = scene.add.image(0, 0, '__DEFAULT').setDepth(10).setVisible(false);
    this.head = scene.add.image(0, 0, '__DEFAULT').setDepth(10.2).setVisible(false);
    this.arms = scene.add.graphics().setDepth(9.9);
    this.gloves = [0, 1].map(() => scene.add.image(0, 0, '__DEFAULT').setDepth(10.1).setVisible(false));
  }

  strike(zone: 'head' | 'body', now: number): void {
    if (zone === 'head') this.headHit = now;
    else this.bodyHit = now;
  }

  hide(): void {
    this.body.setVisible(false);
    this.head.setVisible(false);
    this.arms.clear();
    this.gloves.forEach(g => g.setVisible(false));
    this.pose = null;
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
    this.drawArms(f, now, scale);
    return true;
  }

  private drawArms(f: Fighter, now: number, scale: number): void {
    const d = tune.view.trainingDummy;
    const gloveKey = 'punchies:training_dummy_glove';
    this.arms.clear();
    if (!this.scene.textures.exists(gloveKey)) {
      this.gloves.forEach(g => g.setVisible(false));
      return;
    }
    const lowered = f.forceVulnerable || f.stunTimer > 0;
    const guarding = f.guarding && !lowered;
    const target = { forward: lowered ? d.loweredForward : guarding ? d.guardForward : d.normalForward,
      spread: lowered ? d.loweredSpread : guarding ? d.guardSpread : d.normalSpread,
      drop: lowered ? d.loweredOffsetY : 0 };
    const blend = 1 - Math.exp(-Math.max(0, now - this.lastDraw) / d.poseMs);
    this.lastDraw = now;
    if (!this.pose) this.pose = { ...target };
    else for (const k of ['forward', 'spread', 'drop'] as const) this.pose[k] += (target[k] - this.pose[k]) * blend;
    const fx = Math.cos(this.body.rotation), fy = Math.sin(this.body.rotation);
    const point = (forward: number, spread: number, drop = 0) => ({
      x: this.body.x + (fx * forward + fy * spread) * scale,
      y: this.body.y + (fy * forward - fx * spread) * scale + drop * scale,
    });
    for (const [i, glove] of this.gloves.entries()) {
      const side = i === 0 ? 1 : -1;
      const shoulder = point(0, d.shoulderSpread * side);
      const fist = point(this.pose.forward, this.pose.spread * side, this.pose.drop);
      const elbow = point(this.pose.forward * 0.35, (d.shoulderSpread + this.pose.spread) * 0.5 * side, this.pose.drop * 0.5);
      for (const [width, color] of [[d.armWidth + 2, 0x101b32], [d.armWidth, 0xb97b37]]) {
        this.arms.lineStyle(width * scale, color);
        this.arms.lineBetween(shoulder.x, shoulder.y, elbow.x, elbow.y);
        this.arms.lineBetween(elbow.x, elbow.y, fist.x, fist.y);
        this.arms.fillStyle(color);
        for (const p of [shoulder, elbow, fist]) this.arms.fillCircle(p.x, p.y, width * scale / 2);
      }
      glove.setTexture(gloveKey).setFlipX(i === 0).setOrigin(0.5)
        .setScale(d.gloveHeight * scale / glove.height)
        .setPosition(fist.x, fist.y)
        .setRotation(Math.atan2(fist.y - elbow.y, fist.x - elbow.x) + Math.PI / 2)
        .setDepth(guarding ? 10.3 : 10.1).setVisible(true);
    }
  }
}
