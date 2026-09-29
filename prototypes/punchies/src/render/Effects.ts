import Phaser from 'phaser';
import type { SimEvent, SimState } from '../sim/types';
import { sfx } from '../audio/sfx';
import { PIXEL_RATIO, VIEW } from './pixelRatio';

// Turns sim events into visual and audio feedback: sweet sparks, counter
// flash, block/perfect-guard rings, callout labels. Presentation only.
export class Effects {
  private flashRect: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene) {
    this.flashRect = scene.add
      .rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0xffffff, 0)
      .setDepth(80);
  }

  handle(events: SimEvent[], s: SimState, localIdx: number): void {
    for (const e of events) {
      switch (e.kind) {
        case 'throw':
          sfx.whoosh();
          break;
        case 'hit':
          if (e.counter) {
            this.spark(e.x, e.y, 0xff3a6a, 18);
            this.screenFlash(0xff3a6a, 0.35);
            this.scene.cameras.main.shake(140, 0.008);
            this.label(e.x, e.y - 30, 'COUNTER!', '#ff6a8a', 18);
            sfx.counter();
          } else if (e.sweet) {
            this.spark(e.x, e.y, 0xffe03a, 12);
            if (e.damage > 0) this.scene.cameras.main.shake(80, 0.004);
            this.label(e.x, e.y - 26, e.row === 'vulnerable' ? 'SWEET!' : 'sweet (body)', '#ffe03a', 12);
            sfx.sweet();
          } else {
            this.puff(e.x, e.y);
            this.label(e.x, e.y - 22, e.damage > 0 ? 'sour' : 'absorbed', '#bbbbbb', 10);
            sfx.sour();
          }
          if (e.punch === 'uppercut') this.label(e.x, e.y - 46, 'UPPERCUT!', '#ffc83a', 16);
          break;
        case 'block':
          this.ring(e.x, e.y, 0x3ad0c0, 14);
          this.label(e.x, e.y - 22, e.chip > 0 ? `CHIP -${e.chip.toFixed(1)}` : 'BLOCK', e.chip > 0 ? '#ffb03a' : '#3ad0c0', 11);
          sfx.block();
          break;
        case 'perfectGuard':
          this.ring(e.x, e.y, 0xffffff, 30);
          this.screenFlash(0xffffff, 0.25);
          this.label(e.x, e.y - 28, 'PERFECT GUARD', '#ffffff', 14);
          sfx.perfectGuard();
          break;
        case 'dodged':
          this.label(e.x, e.y - 20, 'dodged', '#b89aff', 11);
          sfx.dodge();
          break;
        case 'whiff': {
          const f = s.fighters[e.attacker];
          this.label(f.x, f.y - 30, e.punch === 'uppercut' ? 'WHIFF! (exposed)' : 'whiff', '#888888', 10);
          break;
        }
        case 'stunned': {
          const f = s.fighters[e.fighter];
          this.label(f.x, f.y - 36, 'STUNNED', '#ffe03a', 16);
          sfx.stun();
          break;
        }
        case 'starsReady':
          if (e.fighter === localIdx) sfx.starsReady();
          break;
        case 'ko':
          this.banner('K.O.');
          sfx.ko();
          break;
        case 'timeUp':
          this.banner(e.winner === null ? 'DRAW' : 'TIME');
          break;
      }
    }
  }

  private spark(x: number, y: number, color: number, size: number): void {
    const g = this.scene.add.graphics().setDepth(60);
    g.lineStyle(3, color, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.lineBetween(Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3, Math.cos(a) * size, Math.sin(a) * size);
    }
    g.setPosition(x, y);
    this.scene.tweens.add({ targets: g, scale: 1.8, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  private puff(x: number, y: number): void {
    const c = this.scene.add.circle(x, y, 7, 0xbbbbbb, 0.7).setDepth(60);
    this.scene.tweens.add({ targets: c, scale: 1.8, alpha: 0, duration: 180, onComplete: () => c.destroy() });
  }

  private ring(x: number, y: number, color: number, r: number): void {
    const c = this.scene.add.circle(x, y, r).setStrokeStyle(3, color, 1).setDepth(60);
    this.scene.tweens.add({ targets: c, scale: 1.6, alpha: 0, duration: 260, onComplete: () => c.destroy() });
  }

  private screenFlash(color: number, alpha: number): void {
    this.flashRect.setFillStyle(color, alpha);
    this.scene.tweens.add({ targets: this.flashRect, fillAlpha: 0, duration: 160 });
  }

  private label(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: 'monospace',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(70);
    this.scene.tweens.add({ targets: t, y: y - 18, alpha: 0, delay: 250, duration: 450, onComplete: () => t.destroy() });
  }

  private banner(text: string): void {
    const t = this.scene.add
      .text(VIEW.cx, VIEW.cy - 20, text, {
        fontFamily: 'monospace',
        fontSize: '56px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(95);
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 300, onComplete: () => t.destroy() });
  }
}
