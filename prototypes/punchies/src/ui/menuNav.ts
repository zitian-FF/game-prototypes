import Phaser from 'phaser';
import { sfx } from '../audio/sfx';

// Keyboard / controller navigation for in-canvas buttons. UI chrome only,
// never read by the sim.
//
// Every button registers here. Arrows / WASD / D-pad / left stick move a
// highlight to the nearest button in that direction; Enter / Space / A
// presses it. When a modal (popup, keypad, end screen) is open, only its
// buttons are reachable (highest depth wins).
//
// Menu-style scenes: always on. Fight scenes: off while fighting (the same
// keys move and punch); Esc / Start toggles it, and it switches on by
// itself when a modal or the result screen is up.

interface Item {
  bg: Phaser.GameObjects.Rectangle;
  onTap: () => void;
}

const FIGHT_BUTTON_DEPTH = 130; // makeButton's depth; anything above is a modal
// The always-present pause button sits above that depth but is not a modal: it must not
// take keyboard / controller control away from the fighter.
export const PAUSE_BUTTON_DEPTH = 220;
const STICK = 0.6;
const REPEAT_MS = 220;

export class MenuNav {
  private items: Item[] = [];
  private focus: Item | null = null;
  private modals: { anchor: Phaser.GameObjects.Rectangle; back: () => void }[] = [];
  private g: Phaser.GameObjects.Graphics;
  private highlight = false;
  private prevPad: boolean[] = [];
  private stickAt = 0;
  // Fight scenes: nav off until toggled or a modal / result appears.
  fightMode = false;
  private engaged = false;
  // Text entry modal (join keypad) handles letters / Enter itself.
  textEntry = false;
  private bindingOwners = 0;
  ownBindings(): () => void {
    this.bindingOwners++;
    let released = false;
    return () => { if (!released) { released = true; this.bindingOwners--; } };
  }

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(1000);
    const update = () => this.update();
    const pointer = () => {
      this.highlight = false;
    };
    // Window-level like input/devices.ts, so no key is lost before the
    // canvas has focus.
    const key = (e: KeyboardEvent) => {
      if (!scene.registry.get('gameMenu:'+scene.scene.key) && scene.scene.isActive() && (!e.repeat || e.key.startsWith('Arrow'))) this.onKey(e);
    };
    scene.events.on('update', update);
    scene.input.on('pointerdown', pointer);
    window.addEventListener('keydown', key);
    scene.events.once('shutdown', () => {
      scene.events.off('update', update);
      scene.input.off('pointerdown', pointer);
      window.removeEventListener('keydown', key);
    });
  }

  add(bg: Phaser.GameObjects.Rectangle, onTap: () => void): void {
    this.items.push({ bg, onTap });
  }

  // Explicit Back ownership: closing a nested panel restores its previous focus.
  modalBack(anchor: Phaser.GameObjects.Rectangle, back: () => void): void {
    const previous = this.focus;
    const modal = { anchor, back };
    this.modals.push(modal);
    anchor.once('destroy', () => {
      this.modals = this.modals.filter(m => m !== modal);
      this.focus = previous;
    });
  }

  private back(): boolean {
    const modal = this.modals.filter(m => m.anchor.active && m.anchor.visible)
      .sort((a, b) => b.anchor.depth - a.anchor.depth)[0];
    const top = this.live()[0]?.bg.depth ?? -Infinity;
    // A deeper panel without a Back handler must never dismiss one underneath.
    if (!modal || top > modal.anchor.depth + 2) return false;
    sfx.uiBack();
    modal.back();
    return true;
  }

  // Scenes show their result screen with this so the buttons are reachable.
  engage(): void {
    this.engaged = true;
  }

  // While true, a fight scene must ignore keyboard / controller fight input.
  get capturing(): boolean {
    return !this.fightMode || this.engaged || this.hasModal();
  }

  private live(): Item[] {
    const all = this.items.filter((i) => i.bg.active && i.bg.visible && i.bg.input?.enabled && i.bg.depth !== PAUSE_BUTTON_DEPTH);
    const top = Math.max(-Infinity, ...all.map((i) => i.bg.depth));
    return all.filter((i) => i.bg.depth === top);
  }

  private hasModal(): boolean {
    return this.items.some((i) => i.bg.active && i.bg.visible && i.bg.depth > FIGHT_BUTTON_DEPTH && i.bg.depth !== PAUSE_BUTTON_DEPTH);
  }

  private move(dx: number, dy: number): void {
    this.highlight = true;
    const live = this.live();
    if (!this.focus || !live.includes(this.focus)) {
      this.focus = live[0] ?? null;
      if (this.focus) sfx.uiSelect();
      return;
    }
    const f = this.focus.bg;
    let best: Item | null = null;
    let bestScore = Infinity;
    for (const c of live) {
      if (c === this.focus) continue;
      const vx = c.bg.x - f.x;
      const vy = c.bg.y - f.y;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const score = along + Math.abs(vx * dy - vy * dx) * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) { this.focus = best; sfx.uiSelect(); }
  }

  private press(): void {
    const live = this.live();
    if (!this.highlight || !this.focus || !live.includes(this.focus)) {
      this.move(0, 0);
      return;
    }
    const item = this.focus;
    item.onTap();
    // In a fight, pressing a top-bar button (RESET, stance...) hands
    // control back to the fighter.
    if (this.fightMode && !this.hasModal()) this.engaged = false;
  }

  private toggle(): void {
    if (!this.fightMode) return;
    this.engaged = !this.engaged;
    this.highlight = this.engaged;
    if (this.engaged) this.move(0, 0);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.bindingOwners) return;
    if (this.scene.input.enabled === false) {
      this.highlight = false;
      this.g.clear();
      return;
    }
    if (e.key === 'Escape' && !this.textEntry) {
      if (!this.back() && !this.hasModal()) this.toggle();
      return;
    }
    if (!this.capturing) return;
    const k = e.key;
    const letters = !this.textEntry;
    if (k === 'ArrowUp' || (letters && (k === 'w' || k === 'W'))) this.move(0, -1);
    else if (k === 'ArrowDown' || (letters && (k === 's' || k === 'S'))) this.move(0, 1);
    else if (k === 'ArrowLeft' || (letters && (k === 'a' || k === 'A'))) this.move(-1, 0);
    else if (k === 'ArrowRight' || (letters && (k === 'd' || k === 'D'))) this.move(1, 0);
    else if ((k === 'Enter' || k === ' ') && !this.textEntry) this.press();
  }

  private update(): void {
    const blocked = this.scene.input.enabled === false || this.scene.registry.get('gameMenu:' + this.scene.scene.key) || !this.scene.scene.isActive();
    this.pollPads(!blocked && !this.bindingOwners);
    const g = this.g;
    g.clear();
    if (blocked || this.scene.input.enabled === false) {
      this.highlight = false;
      return;
    }
    if (this.bindingOwners || !this.capturing || !this.highlight) return;
    const live = this.live();
    if (!this.focus || !live.includes(this.focus)) this.focus = live[0] ?? null;
    if (!this.focus) return;
    const b = this.focus.bg.getBounds();
    const a = 0.65 + 0.35 * Math.sin(this.scene.time.now / 140);
    g.setDepth(this.focus.bg.depth + 5);
    g.lineStyle(3, 0xffd24a, a);
    g.strokeRect(b.x - 3, b.y - 3, b.width + 6, b.height + 6);
  }

  // Controller: D-pad / left stick to move (with repeat), A press,
  // B closes an explicitly owned modal; Start toggles navigation in fights.
  private pollPads(allowActions = true): void {
    let pads: (Gamepad | null)[] = [];
    try {
      pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    } catch {
      return;
    }
    const now = this.scene.time.now;
    // Snapshot all pads before actions: one Back dismisses at most one panel,
    // even if two controllers press it together.
    const edgesByPad = pads.map((p, i) => p?.buttons.map((button, n) => {
      const key = i * 32 + n, was = this.prevPad[key];
      this.prevPad[key] = button.pressed;
      return button.pressed && !was;
    }) ?? []);
    // Keep consuming edges during ads / overlays so held buttons cannot fire
    // against the restored scene. Pointer suppression also owns global input.
    if (!allowActions || this.scene.input.enabled === false) {
      this.stickAt = now;
      return;
    }
    for (const [i, p] of pads.entries()) {
      if (!p) continue;
      const edge = (n: number) => !!edgesByPad[i][n];
      if (edge(1) && this.back()) return;
      if (edge(9) && !this.hasModal()) this.toggle();
      if (!this.capturing) continue;
      if (edge(12)) this.move(0, -1);
      if (edge(13)) this.move(0, 1);
      if (edge(14)) this.move(-1, 0);
      if (edge(15)) this.move(1, 0);
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      if ((Math.abs(ax) > STICK || Math.abs(ay) > STICK) && now - this.stickAt > REPEAT_MS) {
        this.stickAt = now;
        if (Math.abs(ax) > Math.abs(ay)) this.move(Math.sign(ax), 0);
        else this.move(0, Math.sign(ay));
      }
      if (edge(0)) { this.press(); return; }
    }
  }
}

const navs = new WeakMap<Phaser.Scene, MenuNav>();

export function getNav(scene: Phaser.Scene): MenuNav {
  let n = navs.get(scene);
  if (!n) {
    n = new MenuNav(scene);
    navs.set(scene, n);
    scene.events.once('shutdown', () => navs.delete(scene));
  }
  return n;
}

export function navRegister(scene: Phaser.Scene, bg: Phaser.GameObjects.Rectangle, onTap: () => void, cue: 'confirm' | 'back' = 'confirm'): void {
  const sound = () => cue === 'back' ? sfx.uiBack() : sfx.uiConfirm();
  bg.on('pointerdown', sound).on('pointerover', sfx.uiSelect);
  getNav(scene).add(bg, () => { sound(); onTap(); });
}
