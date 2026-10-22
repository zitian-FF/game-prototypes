import Phaser from 'phaser';
import type { MapDef, TeamId } from 'arena-sim';
import { Iso, hash2 } from './iso';
import { clientTune } from '../clientTune';
import { teamColor } from '../theme';

let bakes = 0;

export interface Ground {
  /** A small block of floor tiles; the scene repeats it across the whole map. */
  tileKey: string;
  /** Texture pixels per map pixel for the tile block (1 / this is the tile sprite's tile scale). */
  tileScale: number;
  fogKey: string;
  fogTex: Phaser.Textures.CanvasTexture;
  fogScale: number;
}

const FOG_SCALE = 0.5;
/** The repeating block is this many tiles square. */
const BLOCK_TILES = 12;

/** Bake one repeating block of grid-free basalt: near-even tone, ash grains and soft lighter crusts. */
export function bakeGround(scene: Phaser.Scene, iso: Iso): Ground {
  const n = ++bakes;
  const T = iso.tile;
  const ts = clientTune.dpr.max;
  const size = BLOCK_TILES * T;
  const key = `floor${n}`;
  const tex = scene.textures.createCanvas(key, Math.ceil(size * ts), Math.ceil(size * ts))!;
  const ctx = tex.getContext();
  ctx.scale(ts, ts);
  for (let cy = 0; cy < BLOCK_TILES; cy++) {
    for (let cx = 0; cx < BLOCK_TILES; cx++) {
      const x = cx * T;
      const y = cy * T;
      // Dark basalt, no grid lines: cells are not places you can go. Tiles differ only very slightly in tone, with
      // grains of light and dark ash, so neither the cells nor the repeat stand out.
      const h = hash2(cx, cy, 7);
      const v = 21 + Math.floor(h * 3);
      ctx.fillStyle = `rgb(${v + 7},${v + 1},${v - 2})`;
      ctx.fillRect(x, y, T, T);
      for (let k = 0; k < 14; k++) {
        const r = hash2(cx * 31 + k, cy, 23);
        ctx.fillStyle = r > 0.5 ? 'rgba(150,125,100,0.16)' : 'rgba(0,0,0,0.22)';
        ctx.fillRect(x + T * hash2(cx, cy * 37 + k, 29), y + T * hash2(cx * 41 + k, cy, 31), 1 + r * 1.5, 1 + r * 1.5);
      }
    }
  }
  // Soft lighter crusts that ignore tile edges (wrapped around the block so the repeat has no seams).
  for (let k = 0; k < 18; k++) {
    const gx = hash2(k, 1, 17) * size;
    const gy = hash2(k, 2, 17) * size;
    const r = T * (0.6 + hash2(k, 3, 17) * 1.2);
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = gx + ox;
        const py = gy + oy;
        if (px + r < 0 || py + r < 0 || px - r > size || py - r > size) continue;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
        grad.addColorStop(0, 'rgba(120,95,75,0.10)');
        grad.addColorStop(1, 'rgba(120,95,75,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }
  }
  tex.refresh();

  const fw = Math.ceil(iso.pxW * FOG_SCALE);
  const fh = Math.ceil(iso.pxH * FOG_SCALE);
  const fogTex = scene.textures.createCanvas(`fog${n}`, fw, fh)!;
  return { tileKey: key, tileScale: ts, fogKey: `fog${n}`, fogTex, fogScale: FOG_SCALE };
}

/**
 * Static vector overlays on the floor, drawn once: team-tinted safe zones and the map edge. Vector, so they stay sharp at any zoom.
 */
export function drawDecor(g: Phaser.GameObjects.Graphics, iso: Iso, map: MapDef, mine: TeamId): void {
  const T = iso.tile;
  g.clear();
  // The 8 HQ slot tiles around every node used to be drawn here. They looked like places to click, and nodes are the
  // only thing you click, so they now only appear (as the teleport glow) when a node you can jump to is selected.
  // Safe zones.
  map.safeZones.forEach((z, team) => {
    const col = teamColor(team as TeamId, mine);
    g.fillStyle(col, 0.2).fillRect(z.origin.cx * T, z.origin.cy * T, z.cols * T, z.rows * T);
    g.lineStyle(1, col, 0.4);
    for (let dx = 1; dx < z.cols; dx++) g.lineBetween((z.origin.cx + dx) * T, z.origin.cy * T, (z.origin.cx + dx) * T, (z.origin.cy + z.rows) * T);
    for (let dy = 1; dy < z.rows; dy++) g.lineBetween(z.origin.cx * T, (z.origin.cy + dy) * T, (z.origin.cx + z.cols) * T, (z.origin.cy + dy) * T);
    g.lineStyle(3, col, 1).strokeRect(z.origin.cx * T, z.origin.cy * T, z.cols * T, z.rows * T);
  });
  // Map edge.
  g.lineStyle(4, 0xff7832, 0.5).strokeRect(0, 0, iso.pxW, iso.pxH);
}

export interface VisionCircle {
  x: number;
  y: number;
  r: number;
}

/** Repaint the fog: dark everywhere except crisp circular holes around vision sources. */
export function paintFog(g: Ground, iso: Iso, circles: VisionCircle[]): void {
  const ctx = g.fogTex.getContext();
  const s = g.fogScale;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, g.fogTex.width, g.fogTex.height);
  ctx.fillStyle = `rgba(4,3,6,${clientTune.fog.alpha})`;
  ctx.fillRect(0, 0, g.fogTex.width, g.fogTex.height);
  ctx.globalCompositeOperation = 'destination-out';
  for (const c of circles) {
    const p = iso.p(c.x, c.y);
    const a = (c.r / iso.cell) * iso.tile * s; // radius in fog pixels
    ctx.save();
    ctx.translate(p.x * s, p.y * s);
    // A crisp edge: fully clear inside, the fog starts right at the vision radius.
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  g.fogTex.refresh();
}

