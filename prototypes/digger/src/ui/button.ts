import Phaser from 'phaser';
import { PIXEL_RATIO } from '../pixelRatio';

export interface ButtonStyle {
  fill: number;
  edge: number;
}

export class Button {
  readonly container: Phaser.GameObjects.Container;
  private gfx: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text | null = null;
  private selected = false;
  private pressed = false;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private w: number,
    private h: number,
    title: string,
    sub: string | null,
    private style: ButtonStyle,
    onTap: () => void,
    titleSize = 18,
  ) {
    this.gfx = scene.add.graphics();
    this.title = scene.add
      .text(0, sub ? -8 : 0, title, {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        fontSize: `${titleSize}px`,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [this.gfx, this.title];
    if (sub) {
      this.sub = scene.add
        .text(0, 11, sub, { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#d8d0e8', resolution: PIXEL_RATIO })
        .setOrigin(0.5);
      children.push(this.sub);
    }
    this.container = scene.add.container(x, y, children).setSize(w, h);
    this.container.setInteractive({ useHandCursor: true });
    this.container.on('pointerdown', () => {
      this.pressed = true;
      this.redraw();
      scene.tweens.add({ targets: this.container, scale: 0.95, duration: 60, yoyo: true });
      onTap();
    });
    const release = () => {
      this.pressed = false;
      this.redraw();
    };
    this.container.on('pointerup', release);
    this.container.on('pointerout', release);
    this.redraw();
  }

  setSelected(v: boolean): void {
    this.selected = v;
    this.redraw();
  }

  setText(title: string, sub?: string): void {
    this.title.setText(title);
    if (sub !== undefined) this.sub?.setText(sub);
  }

  private redraw(): void {
    const g = this.gfx;
    const { w, h } = this;
    g.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 12);
    g.fillStyle(this.selected ? this.style.edge : this.style.fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + (this.pressed ? 3 : 0), w, h, 12);
    g.fillStyle(0xffffff, this.selected ? 0.28 : 0.14);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3 + (this.pressed ? 3 : 0), w - 6, h * 0.34, 9);
    g.lineStyle(this.selected ? 3 : 2, this.selected ? 0xffffff : this.style.edge, 1);
    g.strokeRoundedRect(-w / 2, -h / 2 + (this.pressed ? 3 : 0), w, h, 12);
  }
}
