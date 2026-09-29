import Phaser from 'phaser';
import { tune } from '../sim/tune';
import type { SimState } from '../sim/types';
import { remainingSeconds } from '../sim/sim';
import { LOGICAL_WIDTH, PIXEL_RATIO } from '../render/pixelRatio';

// In-canvas match HUD: health, stamina and stun meters per fighter, and the
// match timer. Star Power lives on the Uppercut button, fatigue on the punch
// buttons (see TouchControls).

const BAR_W = 250;
const MARGIN = 70;

export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private timer: Phaser.GameObjects.Text;
  private shownHealth = [0, 0];

  constructor(scene: Phaser.Scene, names: [string, string]) {
    this.g = scene.add.graphics().setDepth(90);
    const style = { fontFamily: 'monospace', fontSize: '10px', color: '#cccccc', resolution: PIXEL_RATIO };
    scene.add.text(MARGIN, 34, names[0], style).setDepth(91);
    scene.add.text(LOGICAL_WIDTH - MARGIN, 34, names[1], style).setOrigin(1, 0).setDepth(91);
    this.timer = scene.add
      .text(LOGICAL_WIDTH / 2, 6, '', { fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5, 0)
      .setDepth(91);
    this.shownHealth = [tune.health.max, tune.health.max];
  }

  draw(s: SimState): void {
    const g = this.g;
    g.clear();
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      const left = i === 0;
      const x = left ? MARGIN : LOGICAL_WIDTH - MARGIN - BAR_W;
      // Trailing "recent damage" chunk so hits read clearly.
      this.shownHealth[i] = Math.max(f.health, this.shownHealth[i] - 0.4);
      this.bar(x, 8, 14, f.health / tune.health.max, this.shownHealth[i] / tune.health.max, 0x3ad06a, left);
      const staminaColor = f.exhausted ? 0xff5a3a : 0x3ab0e0;
      this.bar(x, 25, 6, f.stamina / tune.stamina.max, 0, staminaColor, left);
      const stunFrac = Math.min(1, f.stun / tune.stun.threshold);
      const stunColor = f.stunFromMeter ? 0xffe03a : stunFrac > 0.7 ? 0xffa03a : 0xb07a3a;
      this.bar(x + BAR_W * 0.35, 34, 5, f.stunFromMeter ? 1 : stunFrac, 0, stunColor, left, BAR_W * 0.65);
    }
    this.timer.setText(s.timed ? String(remainingSeconds(s)) : '--');
  }

  private bar(x: number, y: number, h: number, frac: number, trail: number, color: number, fromLeft: boolean, w = BAR_W): void {
    const g = this.g;
    g.fillStyle(0x000000, 0.55);
    g.fillRect(x, y, w, h);
    const draw = (f: number, c: number, a: number) => {
      const fw = Math.max(0, Math.min(1, f)) * w;
      g.fillStyle(c, a);
      g.fillRect(fromLeft ? x : x + w - fw, y, fw, h);
    };
    if (trail > frac) draw(trail, 0xffffff, 0.7);
    draw(frac, color, 1);
    g.lineStyle(1, 0xffffff, 0.35);
    g.strokeRect(x, y, w, h);
  }
}
