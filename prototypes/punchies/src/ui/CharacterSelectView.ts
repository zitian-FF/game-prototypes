import Phaser from 'phaser';
import { artKey } from '../render/art';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { CHARACTER_IDS, CHARACTER_INFO, type CharId } from '../sim/character';
import { tune } from '../sim/tune';
import { reducedMotion } from './presentation';

interface PanelState {
  id: CharId;
  label: string;
  hidden: boolean;
  locked: boolean;
  focused: boolean;
  status: string;
  stats: [string, number][];
}
export interface SelectionState {
  panels: PanelState[];
  step: number;
  steps: string[];
  action: string;
  level: string | null;
  hint: string;
  bestOf: number;
}

// One authored landscape composition, fitted uniformly into every VIEW.
// Presentation owns no picks or readiness state; the scene remains authoritative.
export class CharacterSelectView {
  private root: Phaser.GameObjects.Container;
  private chrome: Phaser.GameObjects.Graphics;
  private content: Phaser.GameObjects.Container[] = [];
  private panelIds: (CharId | null)[] = [null, null];
  private panelKeys = ['', ''];
  private cards: Phaser.GameObjects.Container[] = [];
  private cardFrames: Phaser.GameObjects.Graphics[] = [];
  private progress: Phaser.GameObjects.Text[] = [];
  private status: Phaser.GameObjects.Text[] = [];
  private action: Phaser.GameObjects.Text;
  private level: Phaser.GameObjects.Text;
  private levelButtons: Phaser.GameObjects.Text[];
  private hint: Phaser.GameObjects.Text;
  private previous = '';
  private format: Phaser.GameObjects.Text;
  private portraitBounds = new Map<string, { left: number; top: number; right: number; bottom: number }>();

  constructor(private scene: Phaser.Scene, callbacks: {
    card(i: number): void; panel(i: number): void; action(): void; back(): void; level(d: number): void; format(): void;
  }) {
    const scale = Math.min(VIEW.width / 844, VIEW.height / 390);
    this.root = scene.add.container(VIEW.cx - 422 * scale, VIEW.cy - 195 * scale).setScale(scale);
    this.chrome = this.graphics(this.root);
    this.text(this.root, 422, 27, 'CHOOSE YOUR BOXER', 33).setStroke('#071024', 6);
    this.chrome.lineStyle(5, 0x167cff).lineBetween(260, 51, 422, 51);
    this.chrome.lineStyle(5, 0xef3545).lineBetween(422, 51, 586, 51);
    this.button(46, 29, 80, 30, '‹  BACK', callbacks.back);
    this.format = this.button(90, 76, 136, 27, 'BEST OF 3', callbacks.format);
    [290, 422, 554].forEach((x, i) => {
      this.progress.push(this.text(this.root, x, 76, `${i + 1}`, 11));
      if (i < 2) this.text(this.root, x + 66, 76, '›', 22, '#a8bad5');
    });
    for (let s = 0; s < 2; s++) {
      const x = s === 0 ? 16 : 462;
      const hit = scene.add.rectangle(x + 183, 196, 366, 174, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => callbacks.panel(s));
      this.root.add(hit);
      this.content.push(scene.add.container());
      this.root.add(this.content[s]);
      this.status.push(this.text(this.root, s === 0 ? 200 : 644, 288, '', 10, '#b6d5f8'));
    }
    const burst = this.graphics(this.root);
    burst.fillStyle(0x075acd).fillPoints([
      {x: 389, y: 148}, {x: 409, y: 169}, {x: 413, y: 141}, {x: 430, y: 175},
      {x: 454, y: 157}, {x: 444, y: 190}, {x: 463, y: 201}, {x: 440, y: 221},
      {x: 451, y: 256}, {x: 424, y: 240}, {x: 409, y: 267}, {x: 403, y: 241},
      {x: 380, y: 251}, {x: 396, y: 219}, {x: 382, y: 201}, {x: 401, y: 186},
    ], true);
    burst.fillStyle(0xd92843).fillPoints([
      {x: 429, y: 147}, {x: 431, y: 184}, {x: 457, y: 175}, {x: 444, y: 205},
      {x: 463, y: 229}, {x: 435, y: 224}, {x: 443, y: 264}, {x: 420, y: 243},
      {x: 396, y: 252}, {x: 405, y: 218}, {x: 393, y: 181}, {x: 418, y: 193},
    ], true);
    this.text(this.root, 422, 209, 'VS', 48).setAngle(-9).setStroke('#050c1d', 7);
    CHARACTER_IDS.forEach((id, i) => {
      const card = scene.add.container(307 + i * 113, 339);
      this.cards.push(card);
      this.root.add(card);
      this.cardFrames.push(this.graphics(card));
      const key = artKey(scene, `portrait_${id}`);
      if (key) {
        // Portrait-only viewport: source PNGs and their registration stay intact.
        const texture = scene.textures.get(key);
        const source = texture.getSourceImage();
        const frame = 'selection-card';
        if (!texture.has(frame)) {
          const defaultFrame = texture.firstFrame;
          texture.add(frame, 0, 0, Math.round(source.height * 0.12),
            source.width, Math.round(source.height * 0.65));
          texture.firstFrame = defaultFrame;
        }
        const portrait = scene.add.image(0, -15, key, frame).setDisplaySize(92, 60);
        card.add(portrait);
      }
      const footer = this.graphics(card);
      footer.fillStyle(0x101b32).fillRoundedRect(-48, 12, 96, 23, { tl: 0, tr: 0, bl: 9, br: 9 });
      this.text(card, 0, 23, id.toUpperCase(), 13);
      const hit = scene.add.rectangle(0, -4, 100, 84, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => callbacks.card(i));
      card.add(hit);
    });
    this.action = this.button(716, 347, 205, 48, 'CONFIRM BOXER  ›', callbacks.action, true);
    this.level = this.button(744, 65, 105, 27, '', () => callbacks.level(1));
    this.levelButtons = [this.level,
      this.button(672, 65, 27, 27, '‹', () => callbacks.level(-1)),
      this.button(816, 65, 27, 27, '›', () => callbacks.level(1))];
    this.hint = this.text(this.root, 120, 342, '', 10, '#a8bad5').setWordWrapWidth(220).setAlign('center');
  }

  private graphics(parent: Phaser.GameObjects.Container): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    parent.add(g);
    return g;
  }

  private text(parent: Phaser.GameObjects.Container, x: number, y: number, value: string, size: number, color = '#fff7e6'): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, value, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`,
      fontStyle: 'bold', color, stroke: '#0b1731', strokeThickness: 2, resolution: PIXEL_RATIO }).setOrigin(0.5);
    parent.add(t);
    return t;
  }

  private frame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, primary = false): void {
    g.fillStyle(0x030b1c, 0.85).fillRoundedRect(x - 3, y + 3, w + 6, h + 4, 14);
    g.fillStyle(primary ? 0x116cf0 : 0x14233e).fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(3, color).strokeRoundedRect(x, y, w, h, 12);
    g.lineStyle(1, 0xe1f2ff, 0.35).lineBetween(x + 14, y + 4, x + w - 14, y + 4);
  }

  private button(x: number, y: number, w: number, h: number, label: string, tap: () => void, primary = false): Phaser.GameObjects.Text {
    const g = this.graphics(this.root);
    this.frame(g, x - w / 2, y - h / 2, w, h, primary ? 0x67d9ff : 0x758caf, primary);
    const hit = this.scene.add.rectangle(x, y, w, h, 0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', tap);
    this.root.add(hit);
    const text = this.text(this.root, x, y, label, primary ? 19 : 12);
    text.setData('chrome', g).setData('hit', hit);
    return text;
  }

  render(state: SelectionState): void {
    const signature = JSON.stringify(state);
    if (signature === this.previous) return;
    this.previous = signature;
    this.format.setText(`BEST OF ${state.bestOf}`);
    const g = this.chrome;
    g.clear();
    g.lineStyle(5, 0x167cff).lineBetween(260, 51, 422, 51);
    g.lineStyle(5, 0xef3545).lineBetween(422, 51, 586, 51);
    this.progress.forEach((t, i) => {
      const active = state.step === i;
      this.frame(g, 232 + i * 132, 63, 116, 27, active ? 0x5bd8ff : 0x425879, active);
      t.setText(`${i + 1}  ${state.steps[i]}`).setColor(active ? '#fff7e6' : '#9fb0ca');
    });
    state.panels.forEach((p, s) => {
      const x = s === 0 ? 16 : 462;
      const color = s === 0 ? 0x2587ff : 0xec3d52;
      this.frame(g, x, 109, 366, 174, p.focused ? color : (s === 0 ? 0x345d94 : 0x88434f));
      this.status[s].setText(p.status);
      const key = JSON.stringify([p.id, p.hidden, p.stats]);
      if (key !== this.panelKeys[s]) {
        const changed = this.panelIds[s] !== null && this.panelIds[s] !== p.id;
        const direction = CHARACTER_IDS.indexOf(p.id) >= CHARACTER_IDS.indexOf(this.panelIds[s] ?? p.id) ? 1 : -1;
        this.panelIds[s] = p.id;
        this.panelKeys[s] = key;
        this.buildPanel(s, p);
        const c = this.content[s];
        this.scene.tweens.killTweensOf(c);
        c.setPosition(0, 0).setAlpha(1);
        if (changed && !reducedMotion()) {
          c.setPosition(direction * tune.view.menu.characterSlideDistance, 0).setAlpha(0);
          this.scene.tweens.add({ targets: c, x: 0, alpha: 1, duration: tune.view.menu.characterSlideMs,
            ease: tune.view.menu.characterSlideEase });
        }
      }
    });
    this.cards.forEach((card, i) => {
      const selected = state.panels.findIndex((p) => !p.hidden && CHARACTER_IDS[i] === p.id && p.focused);
      const frame = this.cardFrames[i];
      frame.clear();
      this.frame(frame, -50, -46, 100, 84, selected < 0 ? 0x617ba2 : selected === 0 ? 0x65d9ff : 0xff8593);
      if (selected >= 0) {
        frame.fillStyle(selected === 0 ? 0x2389ff : 0xf04b63).fillCircle(43, -38, 10);
        frame.lineStyle(3, 0xffffff).beginPath().moveTo(38, -38).lineTo(42, -34).lineTo(49, -42).strokePath();
      }
      const lifted = selected >= 0 ? 333 : 339;
      if (card.y !== lifted) {
        this.scene.tweens.killTweensOf(card);
        if (reducedMotion()) card.y = lifted;
        else this.scene.tweens.add({ targets: card, y: lifted, duration: tune.view.menu.characterSlideMs,
          ease: tune.view.menu.characterSlideEase });
      }
    });
    this.action.setText(state.action);
    this.action.setScale(Math.min(1, 185 / this.action.width));
    this.level.setText(state.level ?? 'VERSUS');
    const showLevel = state.level !== null;
    this.levelButtons.forEach((button) => {
      button.setVisible(showLevel);
      (button.getData('chrome') as Phaser.GameObjects.Graphics).setVisible(showLevel);
      (button.getData('hit') as Phaser.GameObjects.Rectangle).setVisible(showLevel).input!.enabled = showLevel;
    });
    this.hint.setText(state.hint);
  }

  private buildPanel(s: number, p: PanelState): void {
    const parent = this.content[s];
    parent.removeAll(true);
    const x = s === 0 ? 16 : 462;
    if (p.hidden) {
      this.text(parent, x + 183, 167, p.label, 25);
      this.text(parent, x + 183, 214, p.status, 14, '#9fb0ca');
      return;
    }
    const info = CHARACTER_INFO[p.id];
    const tx = s === 0 ? 215 : 480;
    const key = artKey(this.scene, `portrait_${p.id}`);
    if (key) {
      const portrait = this.scene.add.image(s === 0 ? 108 : 738, 279, key, '__BASE').setOrigin(0.5, 1);
      // Align visible artwork rather than differing transparent PNG margins.
      let bounds = this.portraitBounds.get(key);
      if (!bounds) {
        const canvas = document.createElement('canvas');
        canvas.width = portrait.width;
        canvas.height = portrait.height;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(this.scene.textures.get(key).getSourceImage() as HTMLImageElement, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        bounds = { left: portrait.width, top: portrait.height, right: 0, bottom: 0 };
        for (let y = 0; y < portrait.height; y++) {
          for (let px = 0; px < portrait.width; px++) {
            if (pixels[(y * canvas.width + px) * 4 + 3] < 16) continue;
            bounds.left = Math.min(bounds.left, px);
            bounds.top = Math.min(bounds.top, y);
            bounds.right = Math.max(bounds.right, px + 1);
            bounds.bottom = Math.max(bounds.bottom, y + 1);
          }
        }
        if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) {
          bounds = { left: 0, top: 0, right: portrait.width, bottom: portrait.height };
        }
        this.portraitBounds.set(key, bounds);
      }
      // Preserve the cast's body-size hierarchy on either side of the matchup.
      const visibleHeight = { bruno: 189, marco: 174, mia: 159 }[p.id];
      const scale = Math.min(visibleHeight / (bounds.bottom - bounds.top), 190 / (bounds.right - bounds.left));
      portrait.setScale(scale);
      const centreOffset = ((bounds.left + bounds.right) / 2 - portrait.width / 2) * scale;
      portrait.x -= (s === 1 ? -1 : 1) * centreOffset;
      portrait.y += (portrait.height - bounds.bottom) * scale;
      // Mirror only the right presentation to face the matchup centre.
      portrait.setFlipX(s === 1);
      parent.add(portrait);
    } else {
      this.text(parent, s === 0 ? 108 : 738, 207, p.id.toUpperCase(), 22);
    }
    const name = this.text(parent, tx + 65, 133, info.name.toUpperCase(), 23);
    if (name.width > 156) name.setScale(156 / name.width);
    this.text(parent, tx + 65, 156, `“${info.nick}”`, 12, '#b9cbe7');
    this.text(parent, tx + 65, 174, p.label, 9, s === 0 ? '#76caff' : '#ff8b99');
    const bars = this.graphics(parent);
    const order = [0, 3, 1, 4, 2, 5];
    order.forEach((index, i) => {
      const [label, value] = p.stats[index];
      const barWidth = 74;
      const bx = tx - 12 + (i % 2) * 82;
      const by = 198 + Math.floor(i / 2) * 29;
      this.text(parent, bx, by - 8, label, 8).setOrigin(0, 0.5);
      bars.fillStyle(0x071326).fillRoundedRect(bx, by, barWidth, 11, 5);
      const width = Math.max(0, Math.min(1, value * 0.8)) * (barWidth - 2);
      if (width > 0) {
        bars.fillStyle(s === 0 ? 0x27bfff : 0xfa4b67).fillRoundedRect(bx + 1, by + 1, width, 9, Math.min(4, width / 2));
        bars.fillStyle(0xffffff, 0.25).fillRoundedRect(bx + 2, by + 2, Math.max(0, width - 2), 3, 1);
      }
      bars.lineStyle(1, 0x738bad).strokeRoundedRect(bx, by, barWidth, 11, 5);
      // Continuous real stats; subdivisions are presentation, not ratings.
      bars.lineStyle(1, 0x071326, 0.8);
      for (let n = 1; n < 6; n++) bars.lineBetween(bx + n * barWidth / 6, by + 1, bx + n * barWidth / 6, by + 10);
    });
  }
}
