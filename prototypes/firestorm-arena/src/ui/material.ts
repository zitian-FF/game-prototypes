import type Phaser from 'phaser';
import { FONT } from '../theme';

/*
 * "Forged steel" interface material. Panels are a steel plate baked once into a nine-slice texture (bevel, corner
 * rivets, a soft shadow and very faint brushing), so a panel is one cheap quad set however big it is. Buttons and
 * fields are drawn as chamfered gradients in the UI graphics, so they keep their place in the drawing order.
 */

export const STEEL_KEY = 'ui:steel';
/** Shadow margin baked around the plate, in logical pixels: the slice is drawn this much bigger on every side. */
export const STEEL_PAD = 10;
/** Corner slice size (logical): holds the chamfer, a rivet and the start of the amber edge. */
export const STEEL_SLICE = 22;
/** Primary (call to action) amber: warm and yellow, well away from the enemy orange. */
export const AMBER = 0xf2a93b;

const PLATE = 72;
const CHAMFER = 10;

function chamfer(ctx: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, k: number): void {
  ctx.beginPath();
  ctx.moveTo(a + k, b);
  ctx.lineTo(a + w - k, b);
  ctx.lineTo(a + w, b + k);
  ctx.lineTo(a + w, b + h - k);
  ctx.lineTo(a + w - k, b + h);
  ctx.lineTo(a + k, b + h);
  ctx.lineTo(a, b + h - k);
  ctx.lineTo(a, b + k);
  ctx.closePath();
}

/** Bake the steel plate texture at `res` texture pixels per logical pixel (the device pixel ratio). */
export function bakeSteel(scene: Phaser.Scene, res: number): void {
  const key = `${STEEL_KEY}@${res}`;
  if (scene.textures.exists(key)) return;
  const size = PLATE + STEEL_PAD * 2;
  const tex = scene.textures.createCanvas(key, Math.ceil(size * res), Math.ceil(size * res))!;
  const ctx = tex.getContext();
  ctx.scale(res, res);
  const a = STEEL_PAD;
  const b = STEEL_PAD;
  const w = PLATE;
  const h = PLATE;
  // Soft drop shadow, mostly below.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  chamfer(ctx, a, b, w, h, CHAMFER);
  ctx.fillStyle = '#16181c';
  ctx.fill();
  ctx.restore();
  // Plate: a cool steel gradient, lighter along the top lip.
  const g = ctx.createLinearGradient(0, b, 0, b + h);
  g.addColorStop(0, '#3a3e45');
  g.addColorStop(0.12, '#2b2e34');
  g.addColorStop(1, '#1a1c20');
  chamfer(ctx, a, b, w, h, CHAMFER);
  ctx.fillStyle = g;
  ctx.fill();
  // Brushing: a few very faint horizontal streaks, barely there.
  ctx.save();
  chamfer(ctx, a, b, w, h, CHAMFER);
  ctx.clip();
  for (let y = b + 3; y < b + h; y += 4) {
    ctx.fillStyle = (y * 7) % 3 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.03)';
    ctx.fillRect(a, y, w, 1);
  }
  ctx.restore();
  // Bevel: a light inner edge and a dark outer one.
  chamfer(ctx, a + 1, b + 1, w - 2, h - 2, CHAMFER - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1;
  ctx.stroke();
  chamfer(ctx, a, b, w, h, CHAMFER);
  ctx.strokeStyle = '#08090b';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Amber edge along the start of the top lip (it lives in the corner slice, so it never stretches).
  ctx.strokeStyle = '#f2a93b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(a + CHAMFER + 2, b + 1);
  ctx.lineTo(a + STEEL_SLICE - STEEL_PAD + 6, b + 1);
  ctx.stroke();
  // Corner rivets.
  const r = 2.2;
  for (const [rx, ry] of [
    [a + 7, b + 7],
    [a + w - 7, b + 7],
    [a + 7, b + h - 7],
    [a + w - 7, b + h - 7],
  ]) {
    const rg = ctx.createRadialGradient(rx - 0.8, ry - 0.8, 0, rx, ry, r);
    rg.addColorStop(0, '#a2a8b0');
    rg.addColorStop(1, '#2a2d33');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.refresh();
}

export function steelKey(res: number): string {
  return `${STEEL_KEY}@${res}`;
}

export const LOGO_KEY = 'ui:logo';
/** The baked logo's logical size. */
export const LOGO_W = 520;
export const LOGO_H = 250;

/** Bake the game logo: a steel shield with a flame, the FIRESTORM wordmark in fire and ARENA on a riveted strip. */
export function bakeLogo(scene: Phaser.Scene, res: number): string {
  const key = `${LOGO_KEY}@${res}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, Math.ceil(LOGO_W * res), Math.ceil(LOGO_H * res))!;
  const x = tex.getContext();
  x.scale(res, res);
  const cx = LOGO_W / 2;
  // Shield emblem.
  const sw = 84;
  const sh = 96;
  const sx = cx - sw / 2;
  const sy = 6;
  x.save();
  x.shadowColor = 'rgba(255,120,30,0.45)';
  x.shadowBlur = 30;
  chamfer(x, sx, sy, sw, sh, 20);
  x.fillStyle = '#25282d';
  x.fill();
  x.restore();
  const sg = x.createLinearGradient(0, sy, 0, sy + sh);
  sg.addColorStop(0, '#5b616b');
  sg.addColorStop(1, '#1d2024');
  chamfer(x, sx, sy, sw, sh, 20);
  x.fillStyle = sg;
  x.fill();
  x.strokeStyle = '#0a0b0d';
  x.lineWidth = 3;
  x.stroke();
  chamfer(x, sx + 5, sy + 5, sw - 10, sh - 10, 16);
  x.strokeStyle = '#f2a93b';
  x.lineWidth = 2;
  x.stroke();
  const flame = (fx: number, fy: number, s: number) => {
    x.beginPath();
    x.moveTo(fx, fy - 60 * s);
    x.bezierCurveTo(fx + 18 * s, fy - 30 * s, fx + 40 * s, fy - 20 * s, fx + 34 * s, fy + 10 * s);
    x.bezierCurveTo(fx + 30 * s, fy + 34 * s, fx + 10 * s, fy + 44 * s, fx, fy + 44 * s);
    x.bezierCurveTo(fx - 22 * s, fy + 44 * s, fx - 38 * s, fy + 28 * s, fx - 36 * s, fy + 6 * s);
    x.bezierCurveTo(fx - 34 * s, fy - 14 * s, fx - 20 * s, fy - 18 * s, fx - 16 * s, fy - 36 * s);
    x.bezierCurveTo(fx - 6 * s, fy - 24 * s, fx - 4 * s, fy - 40 * s, fx, fy - 60 * s);
    x.closePath();
  };
  const fg = x.createLinearGradient(0, sy + 14, 0, sy + 84);
  fg.addColorStop(0, '#ffe08a');
  fg.addColorStop(0.5, '#ff7a2a');
  fg.addColorStop(1, '#c2280c');
  flame(cx, sy + 56, 0.56);
  x.fillStyle = fg;
  x.fill();
  x.strokeStyle = '#3a0e02';
  x.lineWidth = 2;
  x.stroke();
  flame(cx, sy + 64, 0.27);
  x.fillStyle = '#fff3c4';
  x.fill();
  // Wordmark: heavy letters, a stepped dark extrusion, a fire face and a fine top highlight.
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  const wy = sy + sh + 66;
  x.font = `900 70px Impact, "Arial Black", ${FONT}`;
  while (x.measureText('FIRESTORM').width > LOGO_W - 20) x.font = `900 ${parseInt(x.font, 10) - 2}px Impact, "Arial Black", ${FONT}`;
  for (let d = 6; d > 0; d--) {
    x.fillStyle = d > 3 ? '#0a0b0d' : '#3a3e45';
    x.fillText('FIRESTORM', cx + d * 0.6, wy + d);
  }
  const tg = x.createLinearGradient(0, wy - 60, 0, wy + 4);
  tg.addColorStop(0, '#fff1c8');
  tg.addColorStop(0.35, '#ffb347');
  tg.addColorStop(0.7, '#ff5a1a');
  tg.addColorStop(1, '#a3220a');
  x.fillStyle = tg;
  x.fillText('FIRESTORM', cx, wy);
  x.lineWidth = 1.2;
  x.strokeStyle = 'rgba(255,255,255,0.3)';
  x.strokeText('FIRESTORM', cx, wy - 1);
  // ARENA on a small steel strip.
  const ay = wy + 12;
  const aw = 220;
  const ah = 36;
  const ag = x.createLinearGradient(0, ay, 0, ay + ah);
  ag.addColorStop(0, '#3a3e45');
  ag.addColorStop(1, '#1a1c20');
  x.save();
  x.shadowColor = 'rgba(0,0,0,0.6)';
  x.shadowBlur = 8;
  x.shadowOffsetY = 3;
  chamfer(x, cx - aw / 2, ay, aw, ah, 8);
  x.fillStyle = ag;
  x.fill();
  x.restore();
  chamfer(x, cx - aw / 2 + 1, ay + 1, aw - 2, ah - 2, 7);
  x.strokeStyle = 'rgba(255,255,255,0.13)';
  x.lineWidth = 1;
  x.stroke();
  for (const rx of [cx - aw / 2 + 8, cx + aw / 2 - 8]) {
    x.fillStyle = '#8a9099';
    x.beginPath();
    x.arc(rx, ay + ah / 2, 2.2, 0, Math.PI * 2);
    x.fill();
  }
  x.font = `800 23px ${FONT}`;
  x.fillStyle = '#0a0b0d';
  x.fillText('A R E N A', cx, ay + 27);
  x.fillStyle = '#d9dde3';
  x.fillText('A R E N A', cx, ay + 25);
  tex.refresh();
  return key;
}

/** Linear blend of two colours (0 = a, 1 = b). */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * A chamfered plate filled with a vertical gradient from `top` to `bottom`, out of rectangles and corner triangles
 * (the WebGL graphics pipeline only does gradients on those).
 */
export function gradientPlate(g: Phaser.GameObjects.Graphics, a: number, b: number, w: number, h: number, k: number, top: number, bottom: number, alpha = 1): void {
  const at = (y: number) => mix(top, bottom, Math.max(0, Math.min(1, (y - b) / h)));
  const c0 = at(b);
  const ck = at(b + k);
  const chk = at(b + h - k);
  const c1 = at(b + h);
  g.fillGradientStyle(c0, c0, c1, c1, alpha).fillRect(a + k, b, w - 2 * k, h);
  g.fillGradientStyle(ck, ck, chk, chk, alpha).fillRect(a, b + k, k, h - 2 * k).fillRect(a + w - k, b + k, k, h - 2 * k);
  g.fillStyle(at(b + k * 0.6), alpha).fillTriangle(a, b + k, a + k, b, a + k, b + k).fillTriangle(a + w, b + k, a + w - k, b, a + w - k, b + k);
  g.fillStyle(at(b + h - k * 0.6), alpha).fillTriangle(a, b + h - k, a + k, b + h, a + k, b + h - k).fillTriangle(a + w, b + h - k, a + w - k, b + h, a + w - k, b + h - k);
}

/** The outline of a chamfered plate (for bevels and edges). */
export function chamferPoints(a: number, b: number, w: number, h: number, k: number): { x: number; y: number }[] {
  return [
    { x: a + k, y: b },
    { x: a + w - k, y: b },
    { x: a + w, y: b + k },
    { x: a + w, y: b + h - k },
    { x: a + w - k, y: b + h },
    { x: a + k, y: b + h },
    { x: a, y: b + h - k },
    { x: a, y: b + k },
  ];
}
