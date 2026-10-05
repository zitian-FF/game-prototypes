import Phaser from 'phaser';
import { COLORS, FONT } from '../theme';
import { intents } from '../input/intents';

interface Hit {
  x: number;
  y: number;
  w: number;
  h: number;
  onClick?: (px: number, py: number) => void;
  /** Lets a widget ask whether anything else covers a spot, ignoring itself. */
  tag?: string;
}

interface TextOpts {
  size?: number;
  color?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  alpha?: number;
}

interface Layer {
  g: Phaser.GameObjects.Graphics;
  texts: Phaser.GameObjects.Text[];
  keys: string[];
  used: number;
}

/**
 * A tiny immediate-mode UI drawn in the Phaser canvas: call begin(), draw widgets
 * (which also register their click areas), call end(). Screens are redrawn every
 * frame from state, so there is nothing to keep in sync. Later draws sit on top of
 * earlier ones, and clicks go to the topmost widget under the pointer.
 */
export class Ui {
  private layers: Layer[] = [];
  private cur = 0;
  private hits: Hit[] = [];
  private lastHits: Hit[] = [];

  constructor(
    private scene: Phaser.Scene,
    private dpr: number,
    private baseDepth = 1000,
  ) {}

  /** The buffer's pixel ratio changed: re-render every text at the new resolution. */
  setDpr(dpr: number): void {
    this.dpr = dpr;
    for (const l of this.layers) if (l) for (const t of l.texts) t.setResolution(dpr);
  }

  private layer(): Layer {
    let l = this.layers[this.cur];
    if (!l) {
      const g = this.scene.add.graphics().setDepth(this.baseDepth + this.cur * 2);
      l = { g, texts: [], keys: [], used: 0 };
      this.layers[this.cur] = l;
    }
    return l;
  }

  /** Draw following widgets above those of lower layers (modals, overlays). */
  setLayer(n: number): void {
    this.cur = n;
  }

  begin(): void {
    this.cur = 0;
    this.lastHits = this.hits;
    this.hits = [];
    for (const l of this.layers) {
      if (!l) continue;
      l.g.clear();
      l.used = 0;
    }
  }

  end(): void {
    for (const l of this.layers) {
      if (!l) continue;
      for (let i = l.used; i < l.texts.length; i++) l.texts[i].setVisible(false);
    }
  }

  // ---------------------------------------------------------------- drawing

  rect(x: number, y: number, w: number, h: number, fill: number, alpha = 1, edge?: number, radius = 0): void {
    const g = this.layer().g;
    g.fillStyle(fill, alpha);
    if (radius > 0) g.fillRoundedRect(x, y, w, h, radius);
    else g.fillRect(x, y, w, h);
    if (edge !== undefined) {
      g.lineStyle(1, edge, 1);
      if (radius > 0) g.strokeRoundedRect(x, y, w, h, radius);
      else g.strokeRect(x, y, w, h);
    }
  }

  /** The raw graphics of the current layer, for custom shapes. */
  gfx(): Phaser.GameObjects.Graphics {
    return this.layer().g;
  }

  panel(x: number, y: number, w: number, h: number, alpha = 0.88): void {
    this.rect(x, y, w, h, COLORS.panel, alpha, COLORS.panelEdge, 6);
    this.block(x, y, w, h);
  }

  bar(x: number, y: number, w: number, h: number, frac: number, color: number): void {
    this.rect(x, y, w, h, 0x000000, 0.55);
    this.rect(x, y, Math.max(0, Math.min(1, frac)) * w, h, color, 1);
  }

  /** Draw text and return its width. */
  text(str: string, x: number, y: number, o: TextOpts = {}): number {
    const l = this.layer();
    const size = o.size ?? 13;
    const color = o.color ?? COLORS.text;
    const align = o.align ?? 'left';
    const key = `${str}|${size}|${color}|${o.bold ? 1 : 0}`;
    let t = l.texts[l.used];
    if (!t) {
      t = this.scene.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#fff', resolution: this.dpr })
        .setDepth(this.baseDepth + this.cur * 2 + 1);
      l.texts[l.used] = t;
      l.keys[l.used] = '';
    }
    if (l.keys[l.used] !== key) {
      t.setText(str);
      t.setFontSize(size);
      t.setColor(color);
      t.setFontStyle(o.bold ? 'bold' : 'normal');
      l.keys[l.used] = key;
    }
    // Snap the text's top-left corner to a whole device pixel: a centred or right-aligned origin lands on
    // half pixels and the glyphs get resampled (soft, uneven letter spacing).
    const snap = (v: number) => Math.round(v * this.dpr) / this.dpr;
    const left = align === 'left' ? x : align === 'center' ? x - t.width / 2 : x - t.width;
    t.setOrigin(0, 0);
    t.setPosition(snap(left), snap(y));
    t.setAlpha(o.alpha ?? 1);
    t.setVisible(true);
    l.used++;
    return t.width;
  }

  // ------------------------------------------------------------ interaction

  /** Swallow clicks in this rectangle so they do not reach what is underneath. */
  block(x: number, y: number, w: number, h: number): void {
    this.hits.push({ x, y, w, h });
  }

  region(x: number, y: number, w: number, h: number, onClick: (px: number, py: number) => void, tag?: string): void {
    this.hits.push({ x, y, w, h, onClick, tag });
  }

  button(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    o: { onClick?: () => void; enabled?: boolean; accent?: number; active?: boolean; size?: number } = {},
  ): void {
    const enabled = o.enabled !== false;
    const hover = enabled && this.isOver(x, y, w, h);
    const accent = o.accent ?? COLORS.mine;
    const fill = o.active ? accent : hover ? 0x26303d : 0x1a212b;
    this.rect(x, y, w, h, fill, enabled ? 1 : 0.5, hover || o.active ? accent : COLORS.panelEdge, 5);
    this.text(label, x + w / 2, y + h / 2 - (o.size ?? 13) * 0.62, {
      size: o.size ?? 13,
      align: 'center',
      color: enabled ? (o.active ? '#08111a' : COLORS.text) : COLORS.dim,
      bold: true,
    });
    if (enabled && o.onClick) this.hits.push({ x, y, w, h, onClick: o.onClick });
    else this.hits.push({ x, y, w, h });
  }

  isOver(x: number, y: number, w: number, h: number): boolean {
    const p = intents.pointer;
    return intents.inside && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  /** True if the point is over any widget from the last frame, and handles the click if so. */
  click(px: number, py: number): boolean {
    for (let i = this.lastHits.length - 1; i >= 0; i--) {
      const h = this.lastHits[i];
      if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) {
        h.onClick?.(px, py);
        return true;
      }
    }
    return false;
  }

  /** Is the point over any widget from the last frame (other than regions tagged `except`)? */
  covers(px: number, py: number, except?: string): boolean {
    return this.lastHits.some((h) => (except === undefined || h.tag !== except) && px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h);
  }
}

/** A single-line text field's state; drawn with Ui and fed by the text intents. */
export class TextField {
  constructor(
    public value: string,
    public maxLength: number,
    public filter: (s: string) => string = (s) => s,
  ) {}

  type(char: string): void {
    if (this.value.length < this.maxLength) this.value = this.filter(this.value + char);
  }

  backspace(): void {
    this.value = this.value.slice(0, -1);
  }
}

export function drawField(ui: Ui, f: TextField, x: number, y: number, w: number, h: number, focused: boolean, placeholder: string, onFocus: () => void): void {
  ui.rect(x, y, w, h, 0x0b0f14, 1, focused ? COLORS.mine : COLORS.panelEdge, 5);
  const caret = focused && Math.floor(Date.now() / 500) % 2 === 0 ? '|' : '';
  if (f.value || focused) ui.text(f.value + caret, x + 10, y + h / 2 - 9, { size: 16 });
  else ui.text(placeholder, x + 10, y + h / 2 - 9, { size: 16, color: COLORS.dim });
  ui.region(x, y, w, h, onFocus);
}
