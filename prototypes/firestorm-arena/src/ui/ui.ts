import Phaser from 'phaser';
import { COLORS, FONT } from '../theme';
import { intents } from '../input/intents';
import { AMBER, STEEL_PAD, STEEL_SLICE, bakeSteel, chamferPoints, gradientPlate, mix, steelKey } from './material';

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
  /** Pooled images (baked art), between the layer's graphics and its texts. */
  imgs: Phaser.GameObjects.Image[];
  imgUsed: number;
  /** Pooled steel panels (nine-slice), under the layer's graphics. */
  slices: Phaser.GameObjects.NineSlice[];
  sliceUsed: number;
  /** Screen shades and backgrounds for this layer, under its steel panels. */
  under: Phaser.GameObjects.Graphics | null;
}

/**
 * A tiny immediate-mode UI drawn in the Phaser canvas: call begin(), draw widgets
 * (which also register their click areas), call end(). Screens are redrawn every
 * frame from state, so there is nothing to keep in sync. Later draws sit on top of
 * earlier ones, and clicks go to the topmost widget under the pointer.
 */
export class Ui {
  private layers: Layer[] = [];
  /** Full-screen backgrounds, below every layer (and so below the steel panels). */
  private back: Phaser.GameObjects.Graphics | null = null;
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
      l = { g, texts: [], keys: [], used: 0, imgs: [], imgUsed: 0, slices: [], sliceUsed: 0, under: null };
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
    this.back?.clear();
    this.lastHits = this.hits;
    this.hits = [];
    for (const l of this.layers) {
      if (!l) continue;
      l.g.clear();
      l.under?.clear();
      l.used = 0;
      l.imgUsed = 0;
      l.sliceUsed = 0;
    }
  }

  end(): void {
    for (const l of this.layers) {
      if (!l) continue;
      for (let i = l.used; i < l.texts.length; i++) l.texts[i].setVisible(false);
      for (let i = l.imgUsed; i < l.imgs.length; i++) l.imgs[i].setVisible(false);
      for (let i = l.sliceUsed; i < l.slices.length; i++) l.slices[i].setVisible(false);
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

  /**
   * A texture (usually pre-rendered vector art) drawn above this layer's shapes and below its texts. Much cheaper
   * than redrawing detailed vector art into the layer's graphics every frame.
   */
  image(key: string, x: number, y: number, scale: number, originX = 0.5, originY = 0.5): void {
    const l = this.layer();
    let img = l.imgs[l.imgUsed];
    if (!img) {
      img = this.scene.add.image(0, 0, key).setDepth(this.baseDepth + this.cur * 2 + 0.5);
      l.imgs[l.imgUsed] = img;
    }
    l.imgUsed++;
    if (img.texture.key !== key) img.setTexture(key);
    img.setOrigin(originX, originY).setScale(scale).setPosition(x, y).setVisible(true);
  }

  /** A screen background rectangle, drawn under everything this Ui draws (panels included). */
  backdrop(x: number, y: number, w: number, h: number, fill: number, alpha = 1): void {
    this.back ??= this.scene.add.graphics().setDepth(this.baseDepth - 1);
    this.back.fillStyle(fill, alpha).fillRect(x, y, w, h);
  }

  /** A background or dimming rectangle for the current layer: above lower layers, under this layer's panels. */
  shade(x: number, y: number, w: number, h: number, fill: number, alpha = 1): void {
    const l = this.layer();
    l.under ??= this.scene.add.graphics().setDepth(this.baseDepth + this.cur * 2 - 0.75);
    l.under.fillStyle(fill, alpha).fillRect(x, y, w, h);
  }

  /** The raw graphics of the current layer, for custom shapes. */
  gfx(): Phaser.GameObjects.Graphics {
    return this.layer().g;
  }

  /**
   * A forged-steel panel: the baked plate as a nine-slice, under everything else drawn in this layer (panels are
   * backgrounds). Swallows clicks like any panel.
   */
  panel(x: number, y: number, w: number, h: number, alpha = 0.88): void {
    const l = this.layer();
    const res = this.dpr;
    bakeSteel(this.scene, res);
    const key = steelKey(res);
    let sl = l.slices[l.sliceUsed];
    const slice = STEEL_SLICE * res;
    if (!sl) {
      sl = this.scene.add.nineslice(0, 0, key, undefined, 64, 64, slice, slice, slice, slice).setOrigin(0, 0).setDepth(this.baseDepth + this.cur * 2 - 0.5);
      l.slices[l.sliceUsed] = sl;
    }
    l.sliceUsed++;
    if (sl.texture.key !== key) sl.setTexture(key).setSlices(64, 64, slice, slice, slice, slice);
    const pw = Math.max(STEEL_SLICE * 2, w + STEEL_PAD * 2);
    const ph = Math.max(STEEL_SLICE * 2, h + STEEL_PAD * 2);
    sl.setSize(pw * res, ph * res)
      .setScale(1 / res)
      .setPosition(x - STEEL_PAD, y - STEEL_PAD)
      .setAlpha(Math.min(1, alpha + 0.1))
      .setVisible(true);
    this.block(x, y, w, h);
  }

  /** A chamfered steel plate drawn into the layer's graphics: for buttons and small tiles that must keep their order. */
  plate(x: number, y: number, w: number, h: number, top: number, bottom: number, opts: { edge?: number; shadow?: boolean; k?: number; alpha?: number } = {}): void {
    const g = this.layer().g;
    const k = Math.min(opts.k ?? 7, w / 3, h / 3);
    const a = opts.alpha ?? 1;
    if (opts.shadow !== false) g.fillStyle(0x000000, 0.45 * a).fillPoints(chamferPoints(x + 1, y + 3, w, h, k), true);
    gradientPlate(g, x, y, w, h, k, top, bottom, a);
    g.lineStyle(1, 0xffffff, 0.16 * a).strokePoints(chamferPoints(x + 1.5, y + 1.5, w - 3, h - 3, Math.max(1, k - 1)), true);
    g.lineStyle(1.5, opts.edge ?? 0x08090b, a).strokePoints(chamferPoints(x, y, w, h, k), true);
  }

  bar(x: number, y: number, w: number, h: number, frac: number, color: number): void {
    this.rect(x, y, w, h, 0x000000, 0.55);
    this.rect(x, y, Math.max(0, Math.min(1, frac)) * w, h, color, 1);
  }

  private measureCtx: CanvasRenderingContext2D | null = null;

  /** Width of a string as `text()` would draw it, without drawing. */
  measure(str: string, size: number, bold = false): number {
    this.measureCtx ??= document.createElement('canvas').getContext('2d');
    const c = this.measureCtx;
    if (!c) return str.length * size * 0.55;
    c.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    return c.measureText(str).width;
  }

  /** Break a string into lines no wider than `maxW` pixels (a single over-long word stays whole). */
  wrap(text: string, size: number, maxW: number, bold = false): string[] {
    const out: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && this.measure(next, size, bold) > maxW) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
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
    // Forged steel: a primary (active) button is amber, an accented one (danger, boost) gets a coloured lip, the
    // rest are plain steel. Hover lifts the whole plate a little.
    const primary = !!o.active;
    const tint = primary ? (o.accent !== undefined && o.accent !== COLORS.accent ? o.accent : AMBER) : null;
    const lift = hover ? 0.14 : 0;
    const top = tint !== null ? mix(tint, 0xffffff, 0.35 + lift) : mix(0x4a4f57, 0xffffff, lift);
    const bottom = tint !== null ? mix(tint, 0x000000, 0.32) : mix(0x24272c, 0xffffff, lift * 0.5);
    this.plate(x, y, w, h, top, bottom, { edge: tint !== null ? mix(tint, 0x000000, 0.65) : hover && o.accent !== undefined ? o.accent : 0x08090b, alpha: enabled ? 1 : 0.5 });
    if (!primary && o.accent !== undefined && enabled) {
      const g = this.layer().g;
      g.lineStyle(2, o.accent, hover ? 1 : 0.75).lineBetween(x + 6, y + h - 2, x + w - 6, y + h - 2);
    }
    const size = o.size ?? 13;
    this.text(label, x + w / 2, y + h / 2 - size * 0.62, {
      size,
      align: 'center',
      color: enabled ? (primary ? '#1c1004' : COLORS.text) : COLORS.dim,
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
  // An inset steel well: dark, with a shadow along the top inside edge.
  ui.plate(x, y, w, h, 0x07080a, 0x101216, { edge: focused ? COLORS.accent : 0x3a3e45, shadow: false, k: 6 });
  ui.rect(x + 6, y + 2, w - 12, 2, 0x000000, 0.5);
  const caret = focused && Math.floor(Date.now() / 500) % 2 === 0 ? '|' : '';
  if (f.value || focused) ui.text(f.value + caret, x + 10, y + h / 2 - 9, { size: 16 });
  else ui.text(placeholder, x + 10, y + h / 2 - 9, { size: 16, color: COLORS.dim });
  ui.region(x, y, w, h, onFocus);
}
