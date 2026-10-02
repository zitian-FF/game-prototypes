import type Phaser from 'phaser';
import type { NodeKind, SquadType } from 'arena-sim';
import { cube, diamond, poly } from './iso';
import { clientTune } from '../clientTune';
import { shade } from '../theme';

type G = Phaser.GameObjects.Graphics;

const DARK = 0x0c1016;

/** Team-colour outline over a dark fill, facing `f` (1 right, -1 left). */
export function drawUnit(g: G, type: SquadType | 'scout', x: number, y: number, f: number, color: number, t: number, alpha = 1): void {
  g.lineStyle(2, color, alpha);
  g.fillStyle(DARK, 0.9 * alpha);
  const X = (dx: number) => x + dx * f;
  switch (type) {
    case 'tank': {
      // tracks, hull, turret, barrel
      g.fillRoundedRect(x - 14, y - 4, 28, 9, 3);
      g.strokeRoundedRect(x - 14, y - 4, 28, 9, 3);
      g.fillRect(x - 9, y - 11, 18, 8);
      g.strokeRect(x - 9, y - 11, 18, 8);
      g.beginPath();
      g.moveTo(X(7), y - 7);
      g.lineTo(X(20), y - 8);
      g.strokePath();
      for (let i = -2; i <= 2; i++) g.fillStyle(color, 0.8 * alpha).fillCircle(x + i * 5.5, y + 1, 1.4);
      break;
    }
    case 'aircraft': {
      // helicopter: body, tail boom, rotor, skid
      g.fillEllipse(x, y - 8, 20, 12);
      g.strokeEllipse(x, y - 8, 20, 12);
      g.beginPath();
      g.moveTo(X(9), y - 9);
      g.lineTo(X(24), y - 12);
      g.moveTo(X(24), y - 17);
      g.lineTo(X(24), y - 7);
      g.moveTo(X(-9), y - 1);
      g.lineTo(X(9), y - 1);
      g.moveTo(X(-5), y - 1);
      g.lineTo(X(-5), y - 3);
      g.moveTo(X(5), y - 1);
      g.lineTo(X(5), y - 3);
      g.strokePath();
      const spin = Math.cos(t * 28);
      g.lineStyle(2, color, 0.8 * alpha);
      g.beginPath();
      g.moveTo(x - 20 * spin, y - 16);
      g.lineTo(x + 20 * spin, y - 16);
      g.strokePath();
      g.beginPath();
      g.moveTo(x, y - 14);
      g.lineTo(x, y - 16);
      g.strokePath();
      break;
    }
    case 'missile': {
      // MLRS: chassis, cab, angled rocket pod, wheels
      g.fillRect(x - 15, y - 5, 30, 6);
      g.strokeRect(x - 15, y - 5, 30, 6);
      g.fillRect(X(9) - (f < 0 ? 7 : 0), y - 11, 7, 6);
      g.strokeRect(X(9) - (f < 0 ? 7 : 0), y - 11, 7, 6);
      poly(g, [[X(-13), y - 5], [X(5), y - 5], [X(5), y - 10], [X(-9), y - 17]], DARK, 0.9 * alpha, color, 2);
      for (const wx of [-9, 0, 9]) g.fillStyle(color, alpha).fillCircle(X(wx), y + 3, 2.4);
      break;
    }
    case 'scout': {
      // fixed wing: fuselage, swept wings, tailplane
      g.beginPath();
      g.moveTo(X(-14), y);
      g.lineTo(X(14), y - 2);
      g.strokePath();
      poly(g, [[X(-2), y - 1], [X(-8), y - 9], [X(-4), y - 9], [X(5), y - 1]], DARK, 0.9 * alpha, color, 2);
      poly(g, [[X(-2), y - 1], [X(-8), y + 7], [X(-4), y + 7], [X(5), y - 1]], DARK, 0.9 * alpha, color, 2);
      poly(g, [[X(-13), y], [X(-16), y - 4], [X(-13), y - 4]], DARK, 0.9 * alpha, color, 2);
      break;
    }
  }
}

/** Flickering flames rising from (x, y). `size` ~ 1 for a unit, 2 for an HQ. */
export function drawFlames(g: G, x: number, y: number, t: number, size = 1, seed = 0): void {
  for (let i = 0; i < 4; i++) {
    const ph = t * 9 + i * 1.7 + seed;
    const fx = x + (i - 1.5) * 5 * size + Math.sin(ph) * 1.5;
    const h = (9 + Math.sin(ph * 1.3) * 3.5 + i * 0.6) * size;
    g.fillStyle(0xff4a1c, 0.85);
    g.fillTriangle(fx - 3.5 * size, y, fx + 3.5 * size, y, fx + Math.sin(ph) * 2, y - h);
    g.fillStyle(0xffc233, 0.9);
    g.fillTriangle(fx - 2 * size, y, fx + 2 * size, y, fx + Math.sin(ph) * 1.2, y - h * 0.62);
  }
}

/** Icon floating above a node's cube stack, in white with a dark outline. */
export function drawNodeIcon(g: G, kind: NodeKind, x: number, y: number, s = 1): void {
  const line = (w: number, c: number) => g.lineStyle(w * s, c, 1);
  const stroke = (draw: () => void) => {
    line(4, 0x000000);
    draw();
    line(2, 0xffffff);
    draw();
  };
  switch (kind) {
    case 'points':
      stroke(() => {
        g.beginPath();
        g.moveTo(x, y - 8 * s);
        g.lineTo(x + 7 * s, y);
        g.lineTo(x, y + 8 * s);
        g.lineTo(x - 7 * s, y);
        g.closePath();
        g.strokePath();
      });
      g.fillStyle(0xffd54a, 1).fillCircle(x, y, 3 * s);
      break;
    case 'attackBoost': // sword
      stroke(() => {
        g.beginPath();
        g.moveTo(x - 6 * s, y + 7 * s);
        g.lineTo(x + 6 * s, y - 7 * s);
        g.moveTo(x - 6 * s, y - 1 * s);
        g.lineTo(x + 1 * s, y + 6 * s);
        g.strokePath();
      });
      break;
    case 'defenseBoost': // shield
      stroke(() => {
        g.beginPath();
        g.moveTo(x - 6 * s, y - 6 * s);
        g.lineTo(x + 6 * s, y - 6 * s);
        g.lineTo(x + 6 * s, y + 1 * s);
        g.lineTo(x, y + 8 * s);
        g.lineTo(x - 6 * s, y + 1 * s);
        g.closePath();
        g.strokePath();
      });
      break;
    case 'speedBoost': // double chevron
      stroke(() => {
        g.beginPath();
        g.moveTo(x - 7 * s, y - 6 * s);
        g.lineTo(x - 1 * s, y);
        g.lineTo(x - 7 * s, y + 6 * s);
        g.moveTo(x + 1 * s, y - 6 * s);
        g.lineTo(x + 7 * s, y);
        g.lineTo(x + 1 * s, y + 6 * s);
        g.strokePath();
      });
      break;
    case 'teleportCooldown': // clock
      stroke(() => {
        g.strokeCircle(x, y, 7 * s);
        g.beginPath();
        g.moveTo(x, y - 5 * s);
        g.lineTo(x, y);
        g.lineTo(x + 4 * s, y + 2 * s);
        g.strokePath();
      });
      break;
    case 'largeVision': // eye
      stroke(() => {
        g.beginPath();
        g.moveTo(x - 9 * s, y);
        g.lineTo(x - 4 * s, y - 5 * s);
        g.lineTo(x + 4 * s, y - 5 * s);
        g.lineTo(x + 9 * s, y);
        g.lineTo(x + 4 * s, y + 5 * s);
        g.lineTo(x - 4 * s, y + 5 * s);
        g.closePath();
        g.strokePath();
        g.strokeCircle(x, y, 2.4 * s);
      });
      break;
    case 'turret': // cannon
      stroke(() => {
        g.strokeCircle(x - 2 * s, y + 2 * s, 5 * s);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 9 * s, y - 6 * s);
        g.strokePath();
      });
      break;
  }
}

/** A node: a stack of `tier` cubes, each a step smaller than the last. */
export function drawNodeStack(g: G, cx: number, cy: number, tier: number, color: number, hw: number, alpha = 1): number {
  const ch = clientTune.iso.cubeHeight;
  let lift = 0;
  for (let i = 0; i < tier; i++) {
    const w = hw * (1 - i * 0.16);
    cube(g, cx, cy, w, ch, lift, i % 2 === 0 ? color : shade(color, 1.18), alpha);
    lift += ch;
  }
  return lift;
}

/** An HQ: a flat team-colour pad with a small building and an antenna. */
export function drawHq(g: G, cx: number, cy: number, color: number, hw: number, alpha = 1): void {
  diamond(g, cx, cy, hw, hw / 2, shade(color, 0.35), 0.9 * alpha, color, 2);
  cube(g, cx, cy, hw * 0.55, 10, 0, shade(color, 0.85), alpha);
  g.lineStyle(2, color, alpha);
  g.beginPath();
  g.moveTo(cx, cy - 12);
  g.lineTo(cx, cy - 24);
  g.strokePath();
  g.fillStyle(color, alpha).fillTriangle(cx, cy - 24, cx + 9, cy - 21, cx, cy - 18);
}
