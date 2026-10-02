import Phaser from 'phaser';
import type { MapDef, TeamId, Tune } from 'arena-sim';
import { Iso, hash2 } from './iso';
import { clientTune } from '../clientTune';
import { cssColor, teamColor } from '../theme';

export interface LavaTile {
  cx: number;
  cy: number;
  phase: number;
}

let bakes = 0;

export interface Ground {
  groundKey: string;
  fogKey: string;
  /** Bake the static volcanic floor and safe zones, return the lava tiles to animate. */
  lava: LavaTile[];
  fogTex: Phaser.Textures.CanvasTexture;
  fogScale: number;
}

const FOG_SCALE = 0.5;

function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

export function bakeGround(scene: Phaser.Scene, iso: Iso, map: MapDef, tune: Tune, mine: TeamId): Ground {
  const key = `ground${++bakes}`;
  const tex = scene.textures.createCanvas(key, Math.ceil(iso.pxW), Math.ceil(iso.pxH))!;
  const ctx = tex.getContext();
  const hw = iso.tw / 2;
  const hh = iso.th / 2;

  // Basalt floor with per-tile variation and the odd hairline crack.
  for (let cy = 0; cy < iso.rows; cy++) {
    for (let cx = 0; cx < iso.cols; cx++) {
      const p = iso.p((cx + 0.5) * iso.cell, (cy + 0.5) * iso.cell);
      const n = hash2(cx, cy, 7);
      const v = 26 + Math.floor(n * 16);
      ctx.fillStyle = `rgb(${v + 6},${v},${v - 2})`;
      diamondPath(ctx, p.x, p.y, hw, hh);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (hash2(cx, cy, 13) > 0.86) {
        ctx.strokeStyle = 'rgba(255,110,40,0.22)';
        ctx.beginPath();
        ctx.moveTo(p.x - hw * 0.4, p.y - hh * 0.1);
        ctx.lineTo(p.x + hw * 0.1, p.y + hh * 0.2);
        ctx.lineTo(p.x + hw * 0.45, p.y - hh * 0.05);
        ctx.stroke();
      }
    }
  }

  // Safe zones: tinted block with a bright border, marked for each team.
  map.safeZones.forEach((z, team) => {
    const col = teamColor(team as TeamId, mine);
    const x0 = z.origin.cx;
    const y0 = z.origin.cy;
    ctx.fillStyle = cssColor(col) + '33';
    for (let dy = 0; dy < z.rows; dy++) {
      for (let dx = 0; dx < z.cols; dx++) {
        const p = iso.p((x0 + dx + 0.5) * iso.cell, (y0 + dy + 0.5) * iso.cell);
        diamondPath(ctx, p.x, p.y, hw, hh);
        ctx.fill();
      }
    }
    const a = iso.p(x0 * iso.cell, y0 * iso.cell);
    const b = iso.p((x0 + z.cols) * iso.cell, y0 * iso.cell);
    const c = iso.p((x0 + z.cols) * iso.cell, (y0 + z.rows) * iso.cell);
    const d = iso.p(x0 * iso.cell, (y0 + z.rows) * iso.cell);
    ctx.strokeStyle = cssColor(col);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.stroke();
  });

  // Map edge.
  ctx.strokeStyle = 'rgba(255,120,50,0.5)';
  ctx.lineWidth = 4;
  const corners = [iso.p(0, 0), iso.p(iso.cols * iso.cell, 0), iso.p(iso.cols * iso.cell, iso.rows * iso.cell), iso.p(0, iso.rows * iso.cell)];
  ctx.beginPath();
  corners.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
  ctx.closePath();
  ctx.stroke();
  tex.refresh();

  const lava = scatterLava(iso, map, tune);

  const fw = Math.ceil(iso.pxW * FOG_SCALE);
  const fh = Math.ceil(iso.pxH * FOG_SCALE);
  const fogTex = scene.textures.createCanvas(`fog${bakes}`, fw, fh)!;
  return { lava, groundKey: key, fogKey: `fog${bakes}`, fogTex, fogScale: FOG_SCALE };
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

/** Repaint the fog: dark everywhere except soft elliptical holes around vision sources. */
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
    const rc = c.r / iso.cell; // radius in cells
    const a = rc * Math.SQRT2 * (iso.tw / 2) * s; // horizontal semi-axis
    ctx.save();
    ctx.translate(p.x * s, p.y * s);
    ctx.scale(1, 0.5);
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

