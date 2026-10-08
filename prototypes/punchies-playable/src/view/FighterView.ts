import Phaser from 'phaser';

// Index written by scripts/prepare-art.mjs: one sheet per fighter, frames in
// reading order, each action a run of frames. Art faces right.
export interface ArtIndex {
  cell: number;
  chars: Record<string, Record<string, { start: number; count: number }>>;
}

// A fighter drawn either as a coloured rectangle (placeholder, always works)
// or from the sprite sheet. The art faces right, so the root is rotated:
// -90 faces up (player), +90 faces down (enemies).
export class FighterView {
  readonly root: Phaser.GameObjects.Container;
  private body?: Phaser.GameObjects.Rectangle;
  private glove?: Phaser.GameObjects.Rectangle;
  private sprite?: Phaser.GameObjects.Sprite;
  private flashUntil = 0;
  private flashColor = 0xffffff;

  constructor(
    scene: Phaser.Scene,
    private readonly char: string,
    private readonly color: number,
    private readonly size: number,
    private readonly art: ArtIndex | null,
  ) {
    this.root = scene.add.container(0, 0);
    if (art && scene.textures.exists(char)) {
      this.sprite = scene.add.sprite(0, 0, char, 0).setDisplaySize(size, size);
      this.root.add(this.sprite);
    } else {
      this.body = scene.add.rectangle(0, 0, size * 0.28, size * 0.28, color).setStrokeStyle(2, 0x101b32);
      this.glove = scene.add.rectangle(size * 0.17, 0, size * 0.11, size * 0.11, 0xfff1d1).setStrokeStyle(2, 0x101b32);
      const nose = scene.add.rectangle(size * 0.11, 0, size * 0.04, size * 0.07, 0x101b32);
      this.root.add([this.body, nose, this.glove]);
    }
  }

  // action: idle, walk, jab, cross, guard, hit_light, ko. t is 0..1 progress
  // through the action. extend (0..1) drives the placeholder glove.
  pose(action: string, t: number, extend: number): void {
    if (this.sprite) {
      const a = this.art?.chars[this.char]?.[action];
      if (a) this.sprite.setFrame(a.start + Math.min(a.count - 1, Math.floor(Math.max(0, Math.min(0.999, t)) * a.count)));
    } else if (this.glove && this.body) {
      this.glove.x = this.size * (0.17 + 0.3 * extend);
      this.body.setAlpha(action === 'ko' ? 0.6 : 1);
    }
  }

  flash(color: number, now: number, ms: number): void {
    this.flashColor = color;
    this.flashUntil = now + ms;
  }

  // Apply the hit flash (strobes between the flash colour and normal).
  tick(now: number): void {
    const on = now < this.flashUntil && Math.floor(now / 50) % 2 === 0;
    if (this.sprite) {
      if (on) this.sprite.setTintFill(this.flashColor);
      else this.sprite.clearTint();
    } else {
      this.body?.setFillStyle(on ? this.flashColor : this.color);
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}
