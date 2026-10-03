import Phaser from 'phaser';
import { tune } from '../sim/tune';
import { maxHealth, maxStamina, punchCfg, stunThreshold } from '../sim/character';
import type { Fighter, SimState } from '../sim/types';
import { fatigueLevel, remainingSeconds } from '../sim/sim';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';

const FATIGUE_TYPES = ['jab', 'cross', 'hook'] as const;
const ROW_W = 170;

// In-canvas match HUD: health, stamina and stun meters per fighter, and the
// match timer. Star Power lives on the Uppercut button, fatigue on the punch
// buttons (see TouchControls).

const BAR_W = 250;
const MARGIN = 70;

export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private timer: Phaser.GameObjects.Text;
  private shownHealth = [0, 0];
  // Tutorial: only these parts are drawn ('health', 'stamina', 'stun',
  // 'timer'). null = everything.
  shown: Set<string> | null = null;
  // Fighters whose Star Power / fatigue row is drawn (keyboard or
  // controller players; touch players see it on their buttons).
  resourceRow: number[] = [];
  private labels: Phaser.GameObjects.Text[][] = [[], []];

  constructor(scene: Phaser.Scene, names: [string, string]) {
    this.g = scene.add.graphics().setDepth(90);
    const style = { fontFamily: 'monospace', fontSize: '10px', color: '#cccccc', resolution: PIXEL_RATIO };
    const tag = { fontFamily: 'monospace', fontSize: '9px', color: '#aab0bc', resolution: PIXEL_RATIO };
    for (let i = 0; i < 2; i++) {
      const x0 = i === 0 ? VIEW.left + MARGIN : VIEW.right - MARGIN - ROW_W;
      this.labels[i] = ['J', 'C', 'H'].map((l, k) =>
        scene.add.text(x0 + 40 + k * 44, VIEW.top + 54, l, tag).setOrigin(0, 0.5).setDepth(91).setVisible(false),
      );
    }
    scene.add.text(VIEW.left + MARGIN, VIEW.top + 34, names[0], style).setDepth(91);
    scene.add.text(VIEW.right - MARGIN, VIEW.top + 34, names[1], style).setOrigin(1, 0).setDepth(91);
    this.timer = scene.add
      .text(VIEW.cx, VIEW.top + 6, '', { fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5, 0)
      .setDepth(91);
    this.shownHealth = [-1, -1];
  }

  draw(s: SimState): void {
    const g = this.g;
    g.clear();
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      const left = i === 0;
      const x = left ? VIEW.left + MARGIN : VIEW.right - MARGIN - BAR_W;
      const y = VIEW.top;
      // Trailing "recent damage" chunk so hits read clearly.
      this.shownHealth[i] = this.shownHealth[i] < 0 ? f.health : Math.max(f.health, this.shownHealth[i] - 0.4);
      const show = (p: string) => this.shown === null || this.shown.has(p);
      if (show('health')) this.bar(x, y + 8, 14, f.health / maxHealth(f), this.shownHealth[i] / maxHealth(f), 0x3ad06a, left);
      const staminaColor = f.exhausted ? 0xff5a3a : 0x3ab0e0;
      if (show('stamina')) this.bar(x, y + 25, 6, f.stamina / maxStamina(f), 0, staminaColor, left);
      const stunFrac = Math.min(1, f.stun / stunThreshold(f));
      const stunColor = f.stunFromMeter ? 0xffe03a : stunFrac > 0.7 ? 0xffa03a : 0xb07a3a;
      if (show('stun')) this.bar(x + BAR_W * 0.35, y + 34, 5, f.stunFromMeter ? 1 : stunFrac, 0, stunColor, left, BAR_W * 0.65);
    }
    for (let i = 0; i < 2; i++) this.labels[i].forEach((t) => t.setVisible(this.resourceRow.includes(i)));
    for (const i of this.resourceRow) this.drawResources(s.fighters[i], i === 0);
    this.timer.setText(s.timed ? String(remainingSeconds(s)) : '--');
    this.timer.setVisible(this.shown === null || this.shown.has('timer'));
  }

  // Keyboard / controller players have no touch buttons showing Star Power
  // and fatigue, so they get this row under their name instead:
  // star pips, then J / C / H fatigue pips.
  private drawResources(f: Fighter, left: boolean): void {
    const g = this.g;
    const y = VIEW.top + 54;
    const x0 = left ? VIEW.left + MARGIN : VIEW.right - MARGIN - ROW_W;
    const max = tune.stars.max;
    const ready = f.stars >= max;
    for (let i = 0; i < max; i++) {
      g.fillStyle(i < f.stars ? (ready ? 0xffc83a : 0xffe03a) : 0x333333, 1);
      g.fillCircle(x0 + 5 + i * 11, y, 4);
    }
    FATIGUE_TYPES.forEach((type, k) => {
      const gx = x0 + 40 + k * 44;
      const bars = punchCfg(f, type).fatigueBars;
      const level = fatigueLevel(f, type);
      for (let i = 0; i < bars; i++) {
        const on = i < level;
        g.fillStyle(on ? 0xff5a3a : 0xffffff, on ? 0.95 : 0.2);
        g.fillRect(gx + 10 + i * 8, y - 2, 6, 4);
      }
    });
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
