import Phaser from 'phaser';
import type { SimEvent, SimState } from '../sim/types';
import { sfx } from '../audio/sfx';
import { PIXEL_RATIO, VIEW } from './pixelRatio';

// Turns sim events into visual and audio feedback: sweet sparks, counter
// flash, block/perfect-guard rings, callout labels. Presentation only.
export class Effects {
  private flashRect: Phaser.GameObjects.Rectangle;
  private vignette: Phaser.GameObjects.Graphics;
  // Set by FightStage: flash a fighter's body (hit feedback on the boxer).
  onFighterFlash: (idx: number, color: number) => void = () => {};

  constructor(private scene: Phaser.Scene) {
    this.flashRect = scene.add
      .rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0xffffff, 0)
      .setDepth(80);
    // Red edge glow when you take a hit.
    this.vignette = scene.add.graphics().setDepth(81).setAlpha(0);
    for (let i = 0; i < 6; i++) {
      this.vignette.lineStyle(10, 0xff2a2a, 0.35 - i * 0.05);
      this.vignette.strokeRect(VIEW.left + 5 + i * 9, VIEW.top + 5 + i * 9, VIEW.width - 10 - i * 18, VIEW.height - 10 - i * 18);
    }
  }

  // Delivering vs receiving is judged from the local player's side, so on
  // each phone "you hit" and "you got hit" read differently.
  private hit(e: Extract<SimEvent, { kind: 'hit' }>, s: SimState, localIdx: number): void {
    const att = s.fighters[e.attacker];
    // localIdx -1 (local two-player): no "me", every hit uses the landed style.
    const dealt = localIdx === -1 || e.attacker === localIdx;
    const defIdx = 1 - e.attacker;
    const cam = this.scene.cameras.main;
    const big = e.counter || e.punch === 'uppercut';

    if (e.damage <= 0) {
      this.puff(e.x, e.y);
      this.label(e.x, e.y - 22, 'absorbed', '#bbbbbb', 10);
      sfx.sour();
      return;
    }

    // Directional spark along the strike (attacker's facing).
    const size = big ? 2 : e.sweet ? 1.25 : 0.8;
    const palette = dealt ? [0xffffff, 0xfff27a, 0xffc83a] : [0xffd0b0, 0xff8a3a, 0xff3a2a];
    this.directionalSpark(e.x, e.y, att.fx, att.fy, size, palette, big ? 16 : e.sweet ? 10 : 6);
    this.onFighterFlash(defIdx, dealt ? 0xffffff : 0xff4a4a);
    const def = s.fighters[defIdx];
    this.damageNumber(def.x, def.y - 34, e.damage, dealt ? '#fff27a' : '#ff5a5a', big);

    if (dealt) {
      cam.shake(big ? 150 : 70, big ? 0.009 : 0.003);
      if (e.counter) {
        this.shakyLabel(e.x, e.y - 34, 'COUNTER!', '#ffe03a', 22);
        this.screenFlash(0xffffff, 0.3);
        sfx.counter();
      } else if (e.sweet) {
        this.label(e.x, e.y - 26, e.row === 'vulnerable' ? 'SWEET!' : 'sweet (body)', '#ffe03a', 12);
        sfx.sweet();
      } else {
        this.label(e.x, e.y - 22, 'sour', '#bbbbbb', 10);
        sfx.sour();
      }
    } else {
      cam.shake(big ? 220 : 120, big ? 0.014 : 0.007);
      this.redEdges(big ? 0.9 : 0.55);
      try {
        navigator.vibrate?.(big ? [60, 40, 60] : 35);
      } catch {
        /* vibration unsupported */
      }
      if (e.counter) {
        this.shakyLabel(e.x, e.y - 34, 'PUNISHED!', '#ff3a3a', 22);
        sfx.hurtBig();
      } else {
        sfx.hurt();
      }
    }
    if (e.buffed) this.label(e.x, e.y - 48, 'POWER!', '#ff9a3a', 13);
    if (e.punch === 'uppercut') this.shakyLabel(e.x, e.y - 52, 'UPPERCUT!', '#ffc83a', 18);
  }

  // Tekken-style hit spark: a hot core flash plus streaks sprayed forward in
  // a cone along the punch direction, and a few embers.
  private directionalSpark(x: number, y: number, dx: number, dy: number, size: number, palette: number[], streaks: number): void {
    const core = this.scene.add.circle(x, y, 6 * size, palette[0], 1).setDepth(61);
    this.scene.tweens.add({ targets: core, scale: 2.2, alpha: 0, duration: 120, onComplete: () => core.destroy() });
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < streaks; i++) {
      const a = base + (Math.random() - 0.5) * 1.3;
      const len = (10 + Math.random() * 16) * size;
      const dist = (22 + Math.random() * 30) * size;
      const g = this.scene.add.graphics().setDepth(60);
      g.lineStyle(Math.max(1.5, 3 * size * (0.6 + Math.random() * 0.4)), palette[i % palette.length], 1);
      g.lineBetween(0, 0, Math.cos(a) * len, Math.sin(a) * len);
      g.setPosition(x, y);
      this.scene.tweens.add({
        targets: g,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        alpha: 0,
        duration: 140 + Math.random() * 120,
        ease: 'Cubic.easeOut',
        onComplete: () => g.destroy(),
      });
    }
    for (let i = 0; i < Math.round(streaks / 2); i++) {
      const a = base + (Math.random() - 0.5) * 2.2;
      const d = (14 + Math.random() * 26) * size;
      const c = this.scene.add.circle(x, y, 1.5 + Math.random() * 1.5, palette[1], 1).setDepth(60);
      this.scene.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 260, onComplete: () => c.destroy() });
    }
  }

  // Big and bold: pops in above the defender's head, holds, then floats
  // off. Consecutive numbers step sideways so rapid hits don't stack.
  private dmgSlot = 0;
  private damageNumber(x: number, y: number, dmg: number, color: string, big: boolean): void {
    this.dmgSlot = (this.dmgSlot + 1) % 3;
    const t = this.scene.add
      .text(x + (this.dmgSlot - 1) * 14, y, `${Math.round(dmg * 10) / 10}`, {
        fontFamily: 'monospace',
        fontSize: big ? '24px' : '17px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 5,
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(72)
      .setScale(1.6);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 110, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, y: y - 26, alpha: 0, delay: 380, duration: 520, ease: 'Cubic.easeIn', onComplete: () => t.destroy() });
  }

  // Callout that vibrates as it fades (impact text).
  private shakyLabel(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: 'monospace',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 4,
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(75)
      .setScale(1.4);
    const state = { k: 1 };
    this.scene.tweens.add({
      targets: state,
      k: 0,
      duration: 750,
      onUpdate: () => {
        const amp = 4 * state.k;
        t.setPosition(x + (Math.random() - 0.5) * 2 * amp, y - (1 - state.k) * 12 + (Math.random() - 0.5) * 2 * amp);
        t.setAlpha(Math.min(1, state.k * 1.6));
        t.setScale(1 + 0.4 * state.k * state.k);
      },
      onComplete: () => t.destroy(),
    });
  }

  private redEdges(strength: number): void {
    this.vignette.setAlpha(strength);
    this.scene.tweens.add({ targets: this.vignette, alpha: 0, duration: 380 });
  }

  handle(events: SimEvent[], s: SimState, localIdx: number): void {
    for (const e of events) {
      switch (e.kind) {
        case 'throw': {
          sfx.whoosh();
          // Subtle cue that this punch type is fatigued (slower, weaker).
          if (e.tired) {
            const f = s.fighters[e.attacker];
            this.subtle(f.x, f.y + 26, 'tired');
          }
          break;
        }
        case 'hit':
          this.hit(e, s, localIdx);
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
        case 'ready':
          this.banner('READY', 1.7, '#ffe03a');
          sfx.ready();
          break;
        case 'go':
          this.banner('GO!', 0.6, '#7fe08a', true);
          sfx.go();
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

  private subtle(x: number, y: number, text: string): void {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '9px', color: '#9a9aa0', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setAlpha(0.8)
      .setDepth(69);
    this.scene.tweens.add({ targets: t, y: y + 6, alpha: 0, duration: 600, onComplete: () => t.destroy() });
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

  private banner(text: string, holdSec = 1.2, color = '#ffffff', punch = false): void {
    const t = this.scene.add
      .text(VIEW.cx, VIEW.cy - 20, text, {
        fontFamily: 'monospace',
        fontSize: '56px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 6,
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(95);
    if (punch) {
      t.setScale(1.8);
      this.scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    }
    this.scene.tweens.add({ targets: t, alpha: 0, delay: holdSec * 1000, duration: 250, onComplete: () => t.destroy() });
  }

}
