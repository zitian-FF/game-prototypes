import type Phaser from 'phaser';

export interface Pt {
  x: number;
  y: number;
}

/**
 * Deterministic jagged crack arms in unit-square coordinates. Each arm starts
 * near the centre and zigzags outward with sharp turns, like a real fracture.
 */
export function crackPaths(seed: number, count: number): Pt[][] {
  const out: Pt[][] = [];
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const clamp = (v: number) => Math.max(0.05, Math.min(0.95, v));
  const base = rnd() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = base + (i / Math.max(count, 1)) * Math.PI * 2 + (rnd() - 0.5) * 0.7;
    let x = 0.5 + (rnd() - 0.5) * 0.08;
    let y = 0.5 + (rnd() - 0.5) * 0.08;
    const path: Pt[] = [{ x, y }];
    const steps = 3 + Math.floor(rnd() * 2);
    let ang = a;
    for (let k = 0; k < steps; k++) {
      ang += (k % 2 === 0 ? 1 : -1) * (0.35 + rnd() * 0.5);
      const len = 0.1 + rnd() * 0.1;
      x = clamp(x + Math.cos(ang) * len);
      y = clamp(y + Math.sin(ang) * len);
      path.push({ x, y });
    }
    out.push(path);
  }
  return out;
}

/**
 * A crack as a recessed groove: wide at the centre, tapering to a point, with
 * a lit lip on the lower edge and a darker core so it reads as depth.
 */
export function drawCrack(g: Phaser.GameObjects.Graphics, pts: Pt[], width: number, color: number): void {
  const n = pts.length - 1;
  const outline = (w: number, dx: number, dy: number): Pt[] => {
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const half = (w * Math.pow(1 - i / (n + 0.6), 0.9)) / 2;
      left.push({ x: pts[i].x + nx * half + dx, y: pts[i].y + ny * half + dy });
      right.push({ x: pts[i].x - nx * half + dx, y: pts[i].y - ny * half + dy });
    }
    return [...left, ...right.reverse()];
  };
  g.fillStyle(0xffffff, 0.5);
  g.fillPoints(outline(width, 0.9, 1.3), true);
  g.fillStyle(color, 1);
  g.fillPoints(outline(width, 0, 0), true);
  g.fillStyle(0x000000, 0.35);
  g.fillPoints(outline(width * 0.45, 0, 0), true);
}
