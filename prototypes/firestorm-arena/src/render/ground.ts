import Phaser from 'phaser';
import type { MapDef, TeamId, Tune } from 'arena-sim';
import { Iso, hash2 } from './iso';
import { clientTune } from '../clientTune';
import { teamColor } from '../theme';

export interface LavaTile {
  cx: number;
  cy: number;
  phase: number;
}

let bakes = 0;

export interface Ground {
  /** A small block of floor tiles; the scene repeats it across the whole map. */
  tileKey: string;
  /** Texture pixels per map pixel for the tile block (1 / this is the tile sprite's tile scale). */
  tileScale: number;
  /** Lava tiles to animate. */
  lava: LavaTile[];
  fogKey: string;
  fogTex: Phaser.Textures.CanvasTexture;
  fogScale: number;
}

const FOG_SCALE = 0.5;
/** The repeating block is this many tiles square. */
const BLOCK_TILES = 12;

/** Bake one repeating block of basalt tiles with faint grid lines and the odd hairline crack. */
export function bakeGround(scene: Phaser.Scene, iso: Iso, map: MapDef, tune: Tune): Ground {
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
      const h = hash2(cx, cy, 7);
      const v = 26 + Math.floor(h * 16);
      ctx.fillStyle = `rgb(${v + 6},${v},${v - 2})`;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = 'rgba(0,0,0,0.32)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      if (hash2(cx, cy, 13) > 0.8) {
        ctx.strokeStyle = 'rgba(255,110,40,0.22)';
        ctx.beginPath();
        ctx.moveTo(x + T * 0.2, y + T * 0.45);
        ctx.lineTo(x + T * 0.5, y + T * 0.58);
        ctx.lineTo(x + T * 0.8, y + T * 0.42);
        ctx.stroke();
      }
    }
  }
  tex.refresh();

  const fw = Math.ceil(iso.pxW * FOG_SCALE);
  const fh = Math.ceil(iso.pxH * FOG_SCALE);
  const fogTex = scene.textures.createCanvas(`fog${n}`, fw, fh)!;
  return { tileKey: key, tileScale: ts, lava: scatterLava(iso, map, tune), fogKey: `fog${n}`, fogTex, fogScale: FOG_SCALE };
}

/**
 * Static vector overlays on the floor, drawn once: team-tinted safe zones, the 8 HQ slot tiles around every
 * node, and the map edge. Vector, so they stay sharp at any zoom.
 */
export function drawDecor(g: Phaser.GameObjects.Graphics, iso: Iso, map: MapDef, mine: TeamId): void {
  const T = iso.tile;
  g.clear();
  // HQ slots: the ring of tiles around each node.
  for (const n of map.nodes) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        g.fillStyle(0xb0382c, 0.16).fillRect((n.cell.cx + dx) * T + 2, (n.cell.cy + dy) * T + 2, T - 4, T - 4);
        g.lineStyle(1, 0xd9503f, 0.45).strokeRect((n.cell.cx + dx) * T + 2.5, (n.cell.cy + dy) * T + 2.5, T - 5, T - 5);
      }
    }
  }
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

/** Lava patches away from nodes, safe zones and the map edge. */
function scatterLava(iso: Iso, map: MapDef, tune: Tune): LavaTile[] {
  const taken = new Set<string>();
  const blocked = (cx: number, cy: number): boolean => {
    if (cx < 1 || cy < 1 || cx >= iso.cols - 1 || cy >= iso.rows - 1) return true;
    for (const z of map.safeZones) {
      if (cx >= z.origin.cx - 1 && cx <= z.origin.cx + z.cols && cy >= z.origin.cy - 1 && cy <= z.origin.cy + z.rows) return true;
    }
    for (const n of map.nodes) if (Math.abs(n.cell.cx - cx) <= 2 && Math.abs(n.cell.cy - cy) <= 2) return true;
    return false;
  };
  const out: LavaTile[] = [];
  const patches = clientTune.fx.lavaPatches;
  for (let i = 0; i < patches; i++) {
    let cx = Math.floor(hash2(i, 1, 21) * iso.cols);
    let cy = Math.floor(hash2(i, 2, 21) * iso.rows);
    const size = 3 + Math.floor(hash2(i, 3, 21) * 6);
    const phase = hash2(i, 4, 21) * Math.PI * 2;
    for (let k = 0; k < size; k++) {
      const id = `${cx},${cy}`;
      if (!blocked(cx, cy) && !taken.has(id)) {
        taken.add(id);
        out.push({ cx, cy, phase: phase + k * 0.4 });
      }
      const r = hash2(i * 31 + k, cx + cy, 5);
      if (r < 0.25) cx++;
      else if (r < 0.5) cx--;
      else if (r < 0.75) cy++;
      else cy--;
    }
  }
  void tune;
  return out;
}

export interface VisionCircle {
  x: number;
  y: number;
  r: number;
}

/** Repaint the fog: dark everywhere except soft circular holes around vision sources. */
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
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, a);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.8, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  g.fogTex.refresh();
}

