import Phaser from 'phaser';
import { t } from '../i18n';
import { skinTexture } from '../render/skins';
import { artKey } from '../render/art';
import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { CHARACTER_IDS, CHARACTER_INFO, type CharId } from '../sim/character';
import { tune } from '../sim/tune';
import { reducedMotion } from './presentation';
import { cartoonPanel, cartoonButton, shadeUi } from './cartoonChrome';

interface PanelState {
  dummy?: boolean;
  id: CharId;
  label: string;
  hidden: boolean;
  locked: boolean;
  focused: boolean;
  cursor: boolean; available: boolean; selected: boolean; skin: string; skinName: string; skinIndex: number; skinCount: number;
  status: string;
  stats: [string, number][];
}
export interface SelectionState {
  training?: boolean;
  panels: PanelState[];
  step: number;
  steps: string[];
  action: string;
  level: string | null;
  hint: string;
  bestOf: number;
}

const DY = 42;                       // card area sits below the roster strip
const STRIP = { x: 8, y: 90, w: 828, h: 52, cy: 116, x0: 44, x1: 800, pitch: 62, scale: .55 };

// One authored landscape composition, fitted uniformly into every VIEW.
// Presentation owns no picks or readiness state; the scene remains authoritative.
export class CharacterSelectView {
  private root: Phaser.GameObjects.Container;
  private chrome: Phaser.GameObjects.Graphics;
  private content: Phaser.GameObjects.Container[] = [];
  private panelHits: Phaser.GameObjects.Rectangle[] = [];
  private panelIds: (CharId | null)[] = [null, null];
  private panelKeys = ['', ''];
  private cards: Phaser.GameObjects.Container[] = [];
  private scroll = 0;
  private drag: { x: number; scroll: number; moved: number } | null = null;
  private focusKey = '';
  private arrows: Phaser.GameObjects.Text[] = [];
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

  constructor(private scene: Phaser.Scene, private callbacks: {
    skin(s: number, d: number): void; card(i: number): void; panel(i: number): void; action(): void; back(): void; level(d: number): void; format(): void;
  }) {
    const scale = Math.min(VIEW.width / 844, VIEW.height / 390);
    this.root = scene.add.container(VIEW.cx - 422 * scale, VIEW.cy - 195 * scale).setScale(scale);
    this.chrome = this.graphics(this.root);
    this.text(this.root, 422, 27, t('charselect.choose_your_boxer'), 33).setStroke('#071024', 6);
    this.chrome.lineStyle(5, 0x167cff).lineBetween(260, 51, 422, 51);
    this.chrome.lineStyle(5, 0xef3545).lineBetween(422, 51, 586, 51);
    this.button(46, 29, 80, 30, t('charselect.back'), callbacks.back);
    this.format = this.button(90, 76, 136, 27, t('charselect.best_of_3'), callbacks.format, false, 0x8b57c9);
    [290, 422, 554].forEach((x, i) => {
      this.progress.push(this.text(this.root, x, 76, `${i + 1}`, 11).setStroke('#071024', 0));
      if (i < 2) this.text(this.root, x + 66, 76, '›', 22, '#a8bad5');
    });
    const body = scene.add.container(0, DY);
    this.root.add(body);
    for (let s = 0; s < 2; s++) {
      const x = s === 0 ? 16 : 462;
      const hit = scene.add.rectangle(x + 183, 196, 366, 174, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => callbacks.panel(s));
      this.panelHits.push(hit);
      body.add(hit);
      this.content.push(scene.add.container());
      body.add(this.content[s]);
      this.status.push(this.text(body, s === 0 ? 200 : 644, 288, '', 10, '#b6d5f8'));
    }
    // Painted enamel matchup emblem, distinct from interactive button chrome.
    const top = scene.add.container(422, DY + 209);
    this.root.add(top);
    const burst = this.graphics(top);
    burst.fillStyle(0x050d20,.65).fillCircle(0,5,35);
    burst.fillStyle(0x101b32).fillCircle(0,0,33);
    burst.lineStyle(4,0x2587ff).beginPath().arc(0,0,29,Math.PI/2,Math.PI*1.5).strokePath();
    burst.lineStyle(4,0xec3d52).beginPath().arc(0,0,29,-Math.PI/2,Math.PI/2).strokePath();
    burst.lineStyle(1,0xdceaff,.4).strokeCircle(0,0,25);
    burst.fillStyle(0xffffff,.10).fillEllipse(-5,-15,38,12);
    burst.lineStyle(2,0x2587ff,.6).lineBetween(-36,-7,-30,-7);
    burst.lineStyle(2,0xec3d52,.6).lineBetween(30,7,36,7);
    this.text(top,0,1,'VS',31).setAngle(-7).setStroke('#050c1d',4);
    if (!reducedMotion()) scene.tweens.add({targets:top,scale:tune.view.menu.logoPulseScale,
      duration:tune.view.menu.logoPulseMs,yoyo:true,repeat:-1,ease:'Sine.InOut'});
    scene.events.once('shutdown',()=>scene.tweens.killTweensOf(top));
    const stripHit = scene.add.rectangle((STRIP.x0 + STRIP.x1) / 2, STRIP.cy, STRIP.x1 - STRIP.x0, STRIP.h, 0, 0)
      .setInteractive({ useHandCursor: true });
    stripHit.on('pointerdown', (p: Phaser.Input.Pointer) => this.startDrag(p));
    this.root.add(stripHit);
    scene.input.on('pointermove', this.onDrag, this);
    scene.input.on('pointerup', this.endDrag, this);
    scene.events.once('shutdown', () => {
      scene.input.off('pointermove', this.onDrag, this);
      scene.input.off('pointerup', this.endDrag, this);
    });
    CHARACTER_IDS.forEach((id, i) => {
      const card = scene.add.container(0, STRIP.cy + 2);
      card.setScale(STRIP.scale);
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
      footer.fillStyle(0x17243e).fillRoundedRect(-48, 12, 96, 23, { tl: 0, tr: 0, bl: 9, br: 9 });
      this.text(card, 0, 23, id.toUpperCase(), 13);
      const hit = scene.add.rectangle(0, -4, 100, 84, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => this.startDrag(p));
      hit.on('pointerup', () => { if (!this.drag || this.drag.moved < 8) callbacks.card(i); });
      card.add(hit);
      card.setData('hit', hit);
    });
    this.arrows = [-1, 1].map((d) => {
      const a = this.button(d < 0 ? 22 : 822, STRIP.cy, 26, 44, d < 0 ? '‹' : '›', () => this.page(d), false, 0xc9962b);
      a.setFontSize(24);
      return a;
    });
    this.layoutStrip();
    this.action = this.button(716, 355, 205, 48, t('common.confirm_boxer'), callbacks.action, true);
    this.level = this.button(744, 65, 105, 27, '', () => callbacks.level(1));
    this.levelButtons = [this.level,
      this.button(672, 65, 27, 27, '‹', () => callbacks.level(-1)),
      this.button(816, 65, 27, 27, '›', () => callbacks.level(1))];
    this.hint = this.text(this.root, 120, 350, '', 10, '#a8bad5').setWordWrapWidth(220).setAlign('center');
  }

  private maxScroll(): number {
    return Math.max(0, CHARACTER_IDS.length * STRIP.pitch - (STRIP.x1 - STRIP.x0));
  }

  private setScroll(v: number, animate = false): void {
    const target = Phaser.Math.Clamp(v, 0, this.maxScroll());
    this.scene.tweens.killTweensOf(this);
    if (!animate || reducedMotion()) { this.scroll = target; this.layoutStrip(); return; }
    this.scene.tweens.add({ targets: this, scroll: target, duration: 180, ease: 'Sine.easeOut',
      onUpdate: () => this.layoutStrip(), onComplete: () => this.layoutStrip() });
  }

  private page(d: number): void { this.setScroll(this.scroll + d * STRIP.pitch * 4, true); }

  private startDrag(p: Phaser.Input.Pointer): void {
    this.scene.tweens.killTweensOf(this);
    this.drag = { x: p.worldX, scroll: this.scroll, moved: 0 };
  }

  private onDrag(p: Phaser.Input.Pointer): void {
    if (!this.drag || !p.isDown) return;
    const dx = (p.worldX - this.drag.x) / this.root.scaleX;
    this.drag.moved = Math.max(this.drag.moved, Math.abs(dx));
    if (this.drag.moved >= 8) { this.scroll = Phaser.Math.Clamp(this.drag.scroll - dx, 0, this.maxScroll()); this.layoutStrip(); }
  }

  private endDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (d && d.moved >= 8) this.setScroll(Math.round(this.scroll / STRIP.pitch) * STRIP.pitch, true);
  }

  private layoutStrip(): void {
    const max = this.maxScroll();
    const width = STRIP.x1 - STRIP.x0;
    const offset = max === 0 ? (width - CHARACTER_IDS.length * STRIP.pitch) / 2 : -this.scroll;
    this.cards.forEach((card, i) => {
      card.x = STRIP.x0 + offset + STRIP.pitch * (i + .5);
      const edge = Math.min(card.x - STRIP.x0, STRIP.x1 - card.x);
      const alpha = Phaser.Math.Clamp((edge + STRIP.pitch * .25) / (STRIP.pitch * .5), 0, 1);
      card.setAlpha(alpha).setVisible(alpha > 0);
      (card.getData('hit') as Phaser.GameObjects.Rectangle).input!.enabled = alpha > .6;
    });
    this.arrows.forEach((a, k) => {
      const more = max > 0 && (k === 0 ? this.scroll > 1 : this.scroll < max - 1);
      const show = max > 0;
      a.setVisible(show).setAlpha(more ? 1 : .35);
      (a.getData('chrome') as Phaser.GameObjects.Graphics).setVisible(show).setAlpha(more ? 1 : .35);
      (a.getData('hit') as Phaser.GameObjects.Rectangle).setVisible(show).input!.enabled = show && more;
      this.scene.tweens.killTweensOf(a);
      a.setScale(1);
      if (more && !reducedMotion()) this.scene.tweens.add({ targets: a, scale: 1.3, duration: 520, yoyo: true, repeat: -1 });
    });
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
    cartoonPanel(g,x,y,w,h,primary?0x237deb:shadeUi(color,.55),10);
    g.lineStyle(2,color).strokeRoundedRect(x,y,w,h,10);
  }

  private button(x: number, y: number, w: number, h: number, label: string, tap: () => void, primary = false, tint = 0x397dc2): Phaser.GameObjects.Text {
    const g = this.graphics(this.root);
    cartoonButton(g,x-w/2,y-h/2,w,h,primary?0xf3bc35:tint,8);
    const hit = this.scene.add.rectangle(x, y, w, h, 0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', tap);
    this.root.add(hit);
    const text = this.text(this.root, x, y, label, primary ? 19 : 12);
    text.setStroke('#23415a',0).setShadow(0,2,'#23415a',1,true,true);
    text.setData('chrome', g).setData('hit', hit);
    return text;
  }

  render(state: SelectionState): void {
    const signature = JSON.stringify(state);
    if (signature === this.previous) return;
    this.previous = signature;
    this.format.setText(t('charselect.best_of', { n: state.bestOf }));
    this.format.setVisible(!state.training);
    (this.format.getData('chrome') as Phaser.GameObjects.Graphics).setVisible(!state.training);
    (this.format.getData('hit') as Phaser.GameObjects.Rectangle).setVisible(!state.training).input!.enabled=!state.training;
    const g = this.chrome;
    g.clear();
    g.lineStyle(5, 0x167cff).lineBetween(260, 51, 422, 51);
    g.lineStyle(5, 0xef3545).lineBetween(422, 51, 586, 51);
    this.progress.forEach((t, i) => {
      const active = state.step === i;
      const complete = i < state.step;
      g.lineStyle(active ? 3 : 1, active ? 0x5bd8ff : complete ? 0x6bcba5 : 0x526078, active ? 1 : .65)
        .lineBetween(242 + i * 132, 89, 338 + i * 132, 89);
      t.setText(`${complete ? '✓' : i + 1}  ${state.steps[i]}`).setColor(active ? '#77ddff' : complete ? '#9dddc3' : '#9fb0ca');
    });
    state.panels.forEach((p, s) => {
      this.panelHits[s].input!.enabled=!p.dummy;
      const x = s === 0 ? 16 : 462;
      const color = s === 0 ? 0x2587ff : 0xec3d52;
      this.frame(g, x, 109 + DY, 366, 174, p.focused ? color : 0x2f3b55);
      this.status[s].setText(p.status);
      const key = JSON.stringify([p.dummy,p.id, p.hidden, p.stats, p.skin, p.selected, p.skinIndex, p.skinCount]);
      if (key !== this.panelKeys[s]) {
        const changed = this.panelIds[s] !== null && (this.panelIds[s] !== p.id || this.panelKeys[s] !== key);
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
    // Recessed roster shelf hugs short rosters; longer rosters retain the scrolling row.
    const shelfWidth=Math.min(STRIP.w,CHARACTER_IDS.length*STRIP.pitch+28);
    const shelfX=422-shelfWidth/2;
    g.fillStyle(0x050d20,.7).fillRoundedRect(shelfX-2,STRIP.y+4,shelfWidth+4,STRIP.h,12);
    g.fillStyle(0x111d34,.94).fillRoundedRect(shelfX,STRIP.y,shelfWidth,STRIP.h,10);
    g.lineStyle(2,0x435c7c).strokeRoundedRect(shelfX,STRIP.y,shelfWidth,STRIP.h,10);
    g.lineStyle(1,0x9eb6d7,.25).lineBetween(shelfX+12,STRIP.y+3,shelfX+shelfWidth-12,STRIP.y+3);
    g.fillStyle(0x2587ff,.6).fillRoundedRect(shelfX+4,STRIP.y+15,3,22,1);
    g.fillStyle(0xec3d52,.6).fillRoundedRect(shelfX+shelfWidth-7,STRIP.y+15,3,22,1);
    const focused = state.panels.map((p) => (p.hidden || p.dummy ? '' : p.id)).join('|');
    if (focused !== this.focusKey) {
      const first = this.focusKey === '';
      this.focusKey = focused;
      const f = state.panels.find((p) => p.focused && !p.hidden) ?? state.panels.find((p) => !p.hidden);
      if (f && this.maxScroll() > 0) {
        const i = CHARACTER_IDS.indexOf(f.id);
        this.setScroll((i + .5) * STRIP.pitch - (STRIP.x1 - STRIP.x0) / 2, !first);
      }
    }
    this.cards.forEach((card, i) => {
      const selected = state.panels.findIndex((p) => !p.dummy && !p.hidden && CHARACTER_IDS[i] === p.id && p.focused);
      const frame = this.cardFrames[i];
      frame.clear();
      this.frame(frame, -50, -46, 100, 84, selected < 0 ? 0x617ba2 : selected === 0 ? 0x65d9ff : 0xff8593);
      if (selected >= 0) {
        frame.lineStyle(5,selected===0?0x65d9ff:0xff8593).strokeRoundedRect(-52,-48,104,88,12);
        frame.lineStyle(1,0xffffff,.7).strokeRoundedRect(-49,-45,98,82,10);
      }
      state.panels.forEach((p, side) => {
        if (p.dummy || !p.cursor || p.id !== CHARACTER_IDS[i]) return;
        const cx = side === 0 ? -39 : 39;
        frame.fillStyle(side === 0 ? 0x2389ff : 0xf04b63).fillCircle(cx, -38, 12);
        frame.lineStyle(2, 0xffffff);
        if (!p.available) {
          frame.strokeRoundedRect(cx-4,-44,8,8,4);
          frame.fillStyle(0xffffff).fillRoundedRect(cx-6,-39,12,9,2);
          frame.fillStyle(0x17233e).fillCircle(cx,-35,1.5);
        } else {
          frame.beginPath().moveTo(cx-5,-38).lineTo(cx-1,-34).lineTo(cx+6,-42).strokePath();
        }
      });
    });
    this.action.setText(state.action);
    this.action.setScale(Math.min(1, 185 / this.action.width));
    this.level.setText(state.level ?? t('common.versus'));
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
    if (p.dummy) {
      this.text(parent,x+183,133,t('common.dummy'),23);
      this.text(parent,x+183,155,t('training.practice_target'),11,'#b9cbe7');
      const key=artKey(this.scene,'portrait_training_dummy');
      if(key){
        const portrait=this.scene.add.image(x+183,289,key).setOrigin(.5,1);
        portrait.setScale(Math.min(210/portrait.width,145/portrait.height));
        parent.add(portrait);
      }
      return;
    }
    if (p.hidden) {
      this.text(parent, x + 183, 167, p.label, 25);
      this.text(parent, x + 183, 214, p.status, 14, '#9fb0ca');
      return;
    }
    const info = CHARACTER_INFO[p.id];
    const tx = s === 0 ? 215 : 480;
    const textureKey = skinTexture(this.scene, p.id, p.skin, `portrait_${p.id}`);
    const key = this.scene.textures.exists(textureKey) ? textureKey : null;
    if (key) {
      const portrait = this.scene.add.image(s === 0 ? 108 : 738, 289, key, '__BASE').setOrigin(0.5, 1);
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
      const visibleHeight = { bruno: 189, marco: 174, mia: 159, tee: 159, tyke: 198, dragon: 174 }[p.id];
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
    this.text(parent, tx + 65, 156, t(`char.${p.id}.nick`), 12, '#b9cbe7');
    this.text(parent, tx + 65, 174, p.label, 9, s === 0 ? '#76caff' : '#ff8b99');
    const bars = this.graphics(parent);
    const colors = [0xf451b8, 0x5ce38b, 0x37d4ee, 0xffc449, 0xb583f5];
    p.stats.forEach(([label, value], i) => {
      const barWidth = 100;
      const bx = tx + 60;
      const by = 188 + i * 16;
      this.text(parent, tx - 12, by + 5.5, label, 9).setOrigin(0, 0.5);
      bars.fillStyle(0x050a18).fillRoundedRect(bx - 1, by - 1, barWidth + 2, 13, 4);
      const width = Math.max(0, Math.min(1, value * 0.8)) * (barWidth - 2);
      if (width > 0) {
        bars.fillStyle(colors[i]).fillRoundedRect(bx + 1, by + 1, width, 9, Math.min(3, width / 2));
        bars.fillStyle(0xffffff, 0.25).fillRoundedRect(bx + 2, by + 2, Math.max(0, width - 2), 3, 1);
      }
      bars.lineStyle(1, 0x8ba0c8).strokeRoundedRect(bx, by, barWidth, 11, 4);
    });
    if (p.selected && p.available) {
      this.text(parent, tx+65, 273, p.skinName+'  '+p.skinIndex+'/'+p.skinCount, 9, '#fff1a8');
      [-1, 1].forEach(d => {
        const arrow=this.text(parent, tx+65+d*76, 273, d<0?'‹':'›', 20);
        arrow.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.callbacks.skin(s,d));
      });
    }

  }
}
