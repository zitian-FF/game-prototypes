import Phaser from 'phaser';
import { t } from '../i18n';
import type { IntentLayer, TapIntent } from '../input/intents';
import { tune } from '../sim/tune';
import { punchCfg } from '../sim/character';
import type { Fighter } from '../sim/types';
import { fatigueLevel } from '../sim/sim';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { artImage } from '../render/art';

// MOBA-style touch controls drawn in-canvas. Left side: floating joystick.
// Right side: a main button split into Jab (left half) / Cross (right half),
// with Hook, Guard, Dodge and Uppercut arc buttons around it. Writes only
// to the intent layer.

type ButtonId = 'hook' | 'guard' | 'dodge' | 'uppercut';

interface ArcButton {
  id: ButtonId;
  x: number;
  y: number;
  r: number;
  label: string;
}

// Anchored to the bottom-right of the visible view (see VIEW).
const MAIN = { x: VIEW.right - 92, y: VIEW.bottom - 90, r: 58 };
const ARC_BUTTONS: ArcButton[] = [
  { id: 'hook', x: MAIN.x - 100, y: MAIN.y + 18, r: 28, get label() { return t('common.hook'); } },
  { id: 'guard', x: MAIN.x - 84, y: MAIN.y - 64, r: 28, get label() { return t('common.guard'); } },
  { id: 'dodge', x: MAIN.x - 30, y: MAIN.y - 110, r: 26, get label() { return t('common.dodge'); } },
  { id: 'uppercut', x: MAIN.x + 42, y: MAIN.y - 116, r: 32, get label() { return t('common.upper'); } },
];
const JOYSTICK_ZONE_RIGHT = VIEW.left + VIEW.width * 0.45;
const JOYSTICK_ZONE_TOP = VIEW.top + 64;
const JOYSTICK_HINT = { x: VIEW.left + 110, y: VIEW.bottom - 90 };
// Extra touch slop beyond the drawn radius, since thumbs land imprecisely.
const TOUCH_SLOP = 8;

type Owner = { kind: 'joystick'; ox: number; oy: number } | { kind: 'guard' } | { kind: 'tap' };

export class TouchControls {
  private g: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private owners = new Map<number, Owner>();
  private stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
  private flash = new Map<string, number>();
  private labelIds: string[] = ['jab', 'cross', 'hook', 'guard', 'dodge', 'uppercut'];
  private visible = true;
  private chrome: { image: Phaser.GameObjects.Image; ids: string[] }[] = [];
  private stickArt: Phaser.GameObjects.Image | null = null;
  private knobArt: Phaser.GameObjects.Image | null = null;
  // Tutorial: only these parts are shown/usable ('stick', 'jab', 'cross',
  // 'hook', 'guard', 'dodge', 'uppercut', 'fatigue'). null = everything.
  shown: Set<string> | null = null;

  private isShown(id: string): boolean {
    return this.shown === null || this.shown.has(id);
  }

  constructor(
    private scene: Phaser.Scene,
    private intents: IntentLayer,
  ) {
    scene.input.addPointer(3);
    this.g = scene.add.graphics().setDepth(100);
    const txt = (x: number, y: number, s: string, size: number) =>
      this.labels.push(
        scene.add
          .text(x, y, s, { fontFamily: 'Arial Black, Arial', fontStyle:'bold', stroke:'#081225', strokeThickness:2, fontSize: `${size}px`, color: '#fff3da', resolution: PIXEL_RATIO })
          .setOrigin(0.5)
          .setAlpha(1)
          .setDepth(101),
      );
    const jabIcon = artImage(scene, 'icon_jab', MAIN.x - MAIN.r / 2, MAIN.y - 14, 38, 38, 101);
    const crossIcon = artImage(scene, 'icon_cross', MAIN.x + MAIN.r / 2, MAIN.y - 14, 38, 38, 101);
    if (jabIcon) this.chrome.push({ image: jabIcon, ids: ['jab'] });
    if (crossIcon) this.chrome.push({ image: crossIcon, ids: ['cross'] });
    txt(MAIN.x - MAIN.r / 2, MAIN.y + (jabIcon ? 18 : -6), t('common.jab'), 13);
    txt(MAIN.x + MAIN.r / 2, MAIN.y + (crossIcon ? 18 : -6), t('common.cross'), 13);
    for (const b of ARC_BUTTONS) txt(b.x, b.id === 'uppercut' ? b.y + 2 : b.y, b.label, 10);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this.onDown, this);
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
      scene.input.off('pointerupoutside', this.onUp, this);
    });
  }

  private hitTest(x: number, y: number): TapIntent | 'guard' | null {
    for (const b of ARC_BUTTONS) {
      if (this.isShown(b.id) && Phaser.Math.Distance.Between(x, y, b.x, b.y) <= b.r + TOUCH_SLOP) return b.id;
    }
    if (Phaser.Math.Distance.Between(x, y, MAIN.x, MAIN.y) <= MAIN.r + TOUCH_SLOP) {
      const half = x < MAIN.x ? 'jab' : 'cross';
      return this.isShown(half) ? half : null;
    }
    return null;
  }

  // Set false while a full-screen overlay (the "i" panel) is open.
  enabled = true;

  // Hidden when the player is using a keyboard or controller.
  setVisible(v: boolean): void {
    this.visible = v;
    this.g.setVisible(v);
    this.labels.forEach((l, i) => l.setVisible(v && this.isShown(this.labelIds[i])));
    this.chrome.forEach(c => c.image.setVisible(v && c.ids.some(id => this.isShown(id))));
    this.stickArt?.setVisible(v && this.isShown('stick'));
    this.knobArt?.setVisible(v && this.isShown('stick'));
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    const x = p.worldX;
    const y = p.worldY;
    const hit = this.hitTest(x, y);
    if (hit === 'guard') {
      this.owners.set(p.id, { kind: 'guard' });
      this.intents.setGuard(`touch${p.id}`, true);
      return;
    }
    if (hit) {
      this.owners.set(p.id, { kind: 'tap' });
      this.intents.tap(hit);
      this.flash.set(hit, 8);
      return;
    }
    if (this.isShown('stick') && x < JOYSTICK_ZONE_RIGHT && y > JOYSTICK_ZONE_TOP && !this.stick.active) {
      this.owners.set(p.id, { kind: 'joystick', ox: x, oy: y });
      this.stick = { active: true, ox: x, oy: y, x, y };
      this.intents.setTouchMove(0, 0);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const owner = this.owners.get(p.id);
    if (!owner || owner.kind !== 'joystick') return;
    const r = tune.input.joystickRadius;
    let dx = p.worldX - this.stick.ox;
    let dy = p.worldY - this.stick.oy;
    const len = Math.sqrt(dx * dx + dy * dy);
    // Floating stick: drag the base along if the thumb goes past the rim.
    if (len > r) {
      this.stick.ox = p.worldX - (dx / len) * r;
      this.stick.oy = p.worldY - (dy / len) * r;
      dx = (dx / len) * r;
      dy = (dy / len) * r;
    }
    this.stick.x = this.stick.ox + dx;
    this.stick.y = this.stick.oy + dy;
    const nx = dx / r;
    const ny = dy / r;
    const mag = Math.sqrt(nx * nx + ny * ny);
    if (mag < tune.input.joystickDeadzone) this.intents.setTouchMove(0, 0);
    else this.intents.setTouchMove(nx, ny);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const owner = this.owners.get(p.id);
    if (!owner) return;
    this.owners.delete(p.id);
    if (owner.kind === 'guard') this.intents.setGuard(`touch${p.id}`, false);
    if (owner.kind === 'joystick') {
      this.stick.active = false;
      this.intents.setTouchMove(0, 0);
    }
  }

  reset():void {this.owners.clear();this.stick.active=false;this.intents.clearAll();}

  isGuardHeld(): boolean {
    for (const o of this.owners.values()) if (o.kind === 'guard') return true;
    return false;
  }

  draw(f: Fighter): void {
    const g = this.g;
    g.clear();
    this.setVisible(this.visible);

    // Joystick
    const r = tune.input.joystickRadius;
    const base = this.stick.active ? this.stick : { ox: JOYSTICK_HINT.x, oy: JOYSTICK_HINT.y, x: JOYSTICK_HINT.x, y: JOYSTICK_HINT.y };
    this.stickArt?.setPosition(base.ox, base.oy).setDisplaySize(r * 2, r * 2);
    this.knobArt?.setPosition(base.x, base.y);
    if (this.isShown('stick')) {
      this.disc(base.ox,base.oy,r,0x29496e);
      this.disc(base.x,base.y,22,0x6a9bc4);
    }

    if(this.isShown('jab')||this.isShown('cross'))this.disc(MAIN.x,MAIN.y,MAIN.r,0x174ea9);
    // Main split button
    const jabFlash = (this.flash.get('jab') ?? 0) > 0;
    const crossFlash = (this.flash.get('cross') ?? 0) > 0;
    if (this.isShown('jab')) {
      g.fillStyle(jabFlash ? 0x9fd3ff : 0x3a78c2, jabFlash ? 1 : .94);
      g.slice(MAIN.x, MAIN.y, MAIN.r, Math.PI / 2, (3 * Math.PI) / 2, false);
      g.fillPath();
    }
    if (this.isShown('cross')) {
      g.fillStyle(crossFlash ? 0xffb39f : 0xc2503a, crossFlash ? 1 : .94);
      g.slice(MAIN.x, MAIN.y, MAIN.r, -Math.PI / 2, Math.PI / 2, false);
      g.fillPath();
    }
    if (this.isShown('jab') || this.isShown('cross')) {
      g.lineStyle(4, 0x081225, 1);
      g.strokeCircle(MAIN.x, MAIN.y, MAIN.r);
      g.lineStyle(2,0xffffff,.45).beginPath().arc(MAIN.x,MAIN.y,MAIN.r-4,Math.PI*1.08,Math.PI*1.85).strokePath();
      g.lineStyle(4,0x081225,1);
      g.lineBetween(MAIN.x, MAIN.y - MAIN.r, MAIN.x, MAIN.y + MAIN.r);
    }

    // Fatigue pips under JAB / CROSS / HOOK labels
    if (this.isShown('fatigue')) {
    this.drawFatigue(MAIN.x - MAIN.r / 2, MAIN.y + 12, fatigueLevel(f, 'jab'), punchCfg(f, 'jab').fatigueBars);
    this.drawFatigue(MAIN.x + MAIN.r / 2, MAIN.y + 12, fatigueLevel(f, 'cross'), punchCfg(f, 'cross').fatigueBars);
    const hook = ARC_BUTTONS[0];
    this.drawFatigue(hook.x, hook.y + 12, fatigueLevel(f, 'hook'), punchCfg(f, 'hook').fatigueBars);
    }

    for (const b of ARC_BUTTONS) {
      if (!this.isShown(b.id)) continue;
      const flashing = (this.flash.get(b.id) ?? 0) > 0 || (b.id === 'guard' && this.isGuardHeld());
      if (b.id === 'uppercut') {
        this.drawUppercut(b, f.stars, flashing);
        continue;
      }
      const color = b.id === 'guard' ? 0x3ab0a0 : b.id === 'dodge' ? 0x8a6ad0 : 0xc28a3a;
      g.fillStyle(flashing ? 0xffffff : color, flashing ? 0.7 : 0.45);
      g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(2, 0xffffff, 0.5);
      g.strokeCircle(b.x, b.y, b.r);
    }

    for (const [k, v] of this.flash) this.flash.set(k, v - 1);
  }

  private disc(x:number,y:number,r:number,color:number):void {
    const g=this.g;
    g.fillStyle(0x071226).fillCircle(x,y+4,r+3);
    g.fillStyle(color).fillCircle(x,y,r);
    g.lineStyle(4,0x071226).strokeCircle(x,y,r);
    g.lineStyle(2,0xffffff,.45).beginPath().arc(x,y,r-4,Math.PI*1.08,Math.PI*1.85).strokePath();
    g.lineStyle(2,0x071226,.25).beginPath().arc(x,y,r-5,.08,Math.PI*.85).strokePath();
    g.lineStyle(1,0xffffff,.1).lineBetween(x-r*.55,y+r*.35,x-r*.3,y+r*.15);
  }

  private drawFatigue(x: number, y: number, level: number, max: number): void {
    const w = 6;
    const gap = 2;
    const total = max * w + (max - 1) * gap;
    for (let i = 0; i < max; i++) {
      const on = i < level;
      this.g.fillStyle(on ? 0xff5a3a : 0xffffff, on ? 0.95 : 0.2);
      this.g.fillRect(x - total / 2 + i * (w + gap), y, w, 4);
    }
  }

  // Uppercut button doubles as the Star Power meter: one pip per star,
  // lit gold and pulsing once all stars are banked.
  private drawUppercut(b: ArcButton, stars: number, flashing: boolean): void {
    const g = this.g;
    const max = tune.stars.max;
    const ready = stars >= max;
    const pulse = ready ? 0.6 + 0.3 * Math.sin(this.scene.time.now / 120) : 0.3;
    this.disc(b.x,b.y,b.r,flashing?0xfff0bc:ready?0xffbc32:0x596b87);
    if(ready)g.fillStyle(0xffeaa0,pulse*.25).fillCircle(b.x,b.y,b.r-4);
    g.lineStyle(ready ? 3 : 2, ready ? 0xffe08a : 0xffffff, ready ? 0.95 : 0.4);
    g.strokeCircle(b.x, b.y, b.r);
    for (let i = 0; i < max; i++) {
      const px = b.x + (i - (max - 1) / 2) * 12;
      const py = b.y - 12;
      g.fillStyle(i < stars ? 0xffe03a : 0x222222, 1);
      g.fillCircle(px, py, 4);
    }
    this.labels[this.labels.length - 1].setAlpha(ready ? 1 : 0.5);
  }
}

