import type { Ui } from '../ui/ui';
import { COLORS } from '../theme';
import { drawUnit } from '../render/icons';
import { TABS, handbook } from '../handbookContent';
import type { Item, Tab } from '../handbookContent';
import type { IntentEvent } from '../input/intents';

const TRI_H = 150;

interface Line {
  text: string;
  size: number;
  color: string;
  bold: boolean;
  x: number;
  h: number;
  bullet?: boolean;
  tri?: boolean;
}

/** The handbook: tabbed, scrollable text drawn in the canvas. Owned by the main menu. */
export class HandbookView {
  tab: Tab = TABS[0];
  private scroll = 0;
  private content = handbook();
  private cache = new Map<string, Line[]>();
  private maxScroll = 0;

  reset(): void {
    this.tab = TABS[0];
    this.scroll = 0;
  }

  private lines(ui: Ui, tab: Tab, width: number, small: boolean): Line[] {
    const key = `${tab}|${Math.round(width)}|${small ? 1 : 0}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const body = small ? 12 : 13;
    const out: Line[] = [];
    const gap = (h: number) => out.push({ text: '', size: 0, color: '', bold: false, x: 0, h });
    for (const it of this.content[tab] as Item[]) {
      if (it.k === 'tri') {
        out.push({ text: '', size: 0, color: '', bold: false, x: 0, h: TRI_H, tri: true });
        continue;
      }
      if (it.k === 'h') {
        gap(out.length ? 8 : 0);
        for (const l of ui.wrap(it.t ?? '', body + 2, width, true)) out.push({ text: l, size: body + 2, color: '#ffb066', bold: true, x: 0, h: body + 8 });
        continue;
      }
      const indent = it.k === 'b' ? 14 : 0;
      ui.wrap(it.t ?? '', body, width - indent).forEach((l, i) =>
        out.push({ text: l, size: body, color: it.color ?? COLORS.text, bold: false, x: indent, h: body + 5, bullet: it.k === 'b' && i === 0 }),
      );
      gap(4);
    }
    this.cache.set(key, out);
    return out;
  }

  /** Handle scrolling input; returns true if the player asked to close. */
  input(e: IntentEvent, area: { x: number; y: number; w: number; h: number } | null): boolean {
    if (e.type === 'pause') return true;
    if (!area) return false;
    if (e.type === 'zoom') this.scroll -= e.steps * 60;
    else if (e.type === 'drag' && e.startX >= area.x && e.startX <= area.x + area.w && e.startY >= area.y && e.startY <= area.y + area.h) this.scroll -= e.dy;
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll));
    return false;
  }

  area: { x: number; y: number; w: number; h: number } | null = null;

  draw(ui: Ui, w: number, h: number, time: number, onClose: () => void): void {
    const small = h < 480;
    const m = small ? 6 : 14;
    const pw = Math.min(800, w - 2 * m);
    const px = (w - pw) / 2;
    const py = m;
    const ph = h - 2 * m;
    ui.rect(0, 0, w, h, 0x0b0709, 0.96);
    ui.block(0, 0, w, h);
    ui.panel(px, py, pw, ph, 0.96);
    ui.text('Handbook', px + 14, py + 10, { size: small ? 15 : 18, bold: true, color: '#ff8a3d' });
    ui.button(px + pw - 84, py + 6, 74, 28, 'Close', { onClick: onClose, size: 12 });

    // Tabs
    const ty = py + (small ? 36 : 44);
    const tw = (pw - 28 - 6 * (TABS.length - 1)) / TABS.length;
    TABS.forEach((t, i) => {
      ui.button(px + 14 + i * (tw + 6), ty, tw, 28, t, {
        onClick: () => {
          this.tab = t;
          this.scroll = 0;
        },
        active: this.tab === t,
        size: small ? 11 : 12,
      });
    });

    const cx = px + 18;
    const cy = ty + 38;
    const cw = pw - 36 - 8;
    const ch = py + ph - cy - 10;
    this.area = { x: px, y: cy, w: pw, h: ch };
    const lines = this.lines(ui, this.tab, cw, small);
    const total = lines.reduce((a, l) => a + l.h, 0);
    this.maxScroll = Math.max(0, total - ch);
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll));

    let y = cy - this.scroll;
    for (const l of lines) {
      const top = y;
      y += l.h;
      if (top < cy || y > cy + ch + 2) continue; // only whole lines inside the area
      if (l.tri) {
        this.drawTriangle(ui, cx, top, cw, time);
        continue;
      }
      if (!l.text) continue;
      if (l.bullet) ui.rect(cx + 3, top + l.size / 2 - 1, 4, 4, 0xffb066, 1);
      ui.text(l.text, cx + l.x, top, { size: l.size, color: l.color, bold: l.bold });
    }
    // Scroll bar, and a hint while there is more to read.
    if (this.maxScroll > 0) {
      const bh = Math.max(24, (ch * ch) / total);
      const by = cy + (this.scroll / this.maxScroll) * (ch - bh);
      ui.rect(px + pw - 10, cy, 4, ch, 0x000000, 0.4, undefined, 2);
      ui.rect(px + pw - 10, by, 4, bh, COLORS.accent, 0.9, undefined, 2);
      if (this.scroll < this.maxScroll - 4) ui.text('scroll for more', px + pw - 24, py + ph - 22, { size: 10, align: 'right', color: COLORS.dim });
    }
  }

  /** Aircraft > Tank > Missile > Aircraft, as three units on a triangle with arrows from winner to loser. */
  private drawTriangle(ui: Ui, x: number, y: number, w: number, time: number): void {
    const g = ui.gfx();
    const mid = x + Math.min(w, 520) / 2;
    const pts = {
      aircraft: { x: mid, y: y + 34 },
      tank: { x: mid + 130, y: y + 112 },
      missile: { x: mid - 130, y: y + 112 },
    } as const;
    const arrow = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const sx = a.x + ux * 46;
      const sy = a.y + uy * 30;
      const ex = b.x - ux * 46;
      const ey = b.y - uy * 30;
      g.lineStyle(2, 0xffb066, 1).lineBetween(sx, sy, ex, ey);
      g.fillStyle(0xffb066, 1).fillTriangle(ex, ey, ex - ux * 9 - uy * 5, ey - uy * 9 + ux * 5, ex - ux * 9 + uy * 5, ey - uy * 9 - ux * 5);
    };
    arrow(pts.aircraft, pts.tank);
    arrow(pts.tank, pts.missile);
    arrow(pts.missile, pts.aircraft);
    for (const [type, p] of Object.entries(pts) as [keyof typeof pts, { x: number; y: number }][]) {
      drawUnit(g, type, p.x, p.y, 1, COLORS.mine, time, 1, { shadow: false, moving: false, scale: 1 });
      const label = type === 'aircraft' ? 'Aircraft' : type === 'tank' ? 'Tank' : 'Missile';
      ui.text(label, p.x, p.y + 22, { size: 11, bold: true, align: 'center' });
    }
  }
}
