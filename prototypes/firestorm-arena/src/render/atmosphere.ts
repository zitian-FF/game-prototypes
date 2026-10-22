import type Phaser from 'phaser';
import type { MapDef, TeamId } from 'arena-sim';
import { Iso, hash2 } from './iso';
import { clientTune } from '../clientTune';
import { teamColor } from '../theme';

type G = Phaser.GameObjects.Graphics;

/*
 * Cosmetic atmosphere for the battlefield: terrain variation, team territory, battle scars and drifting embers.
 * None of it is clickable or carries hidden information: territory and scars only use what this client can see.
 */

/** The terrain canvas covers the whole map at this many texture pixels per map pixel (soft, cheap). */
const SOFT_SCALE = 0.25;
/** Territory is a soft glow repainted whenever ownership changes, so it uses a much smaller canvas. */
const TERRITORY_SCALE = 1 / 16;

const rgba = (c: number, a: number) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

/** A stable per-match seed from the map layout, so the terrain is the same after a reload. */
function mapSeed(map: MapDef): number {
  let h = 7;
  for (const n of map.nodes) h = (h * 31 + Math.round(n.pos.x * 7 + n.pos.y * 13)) % 1000003;
  return h;
}

export interface Terrain {
  key: string;
  scale: number;
  decals: { key: string; x: number; y: number; flip: boolean }[];
}

let terrains = 0;

/**
 * Bake the terrain: soft ash flats and dark basalt patches on one low-res canvas, plus crater and rock decals placed as
 * images. Mirrored through the map centre like the map itself, and kept clear of nodes and safe zones.
 */
export function bakeTerrain(scene: Phaser.Scene, iso: Iso, map: MapDef): Terrain {
  const a = clientTune.atmosphere;
  const seed = mapSeed(map);
  const n = ++terrains;
  const key = `terrain${n}`;
  const w = Math.ceil(iso.pxW * SOFT_SCALE);
  const h = Math.ceil(iso.pxH * SOFT_SCALE);
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  const mirror = (x: number, y: number): [number, number][] => [
    [x, y],
    [iso.pxW - x, iso.pxH - y],
  ];
  for (let i = 0; i < a.terrainPatchCount; i++) {
    const x = hash2(i, 1, seed) * iso.pxW;
    const y = hash2(i, 2, seed) * iso.pxH;
    const r = (2 + hash2(i, 3, seed) * 5) * iso.tile;
    const ash = hash2(i, 4, seed) > 0.45;
    // Ash flats are a warm light grey; basalt patches are darker than the floor.
    const col = ash ? 0xb8a690 : 0x050304;
    const alpha = ash ? 0.07 : 0.22;
    for (const [px, py] of mirror(x, y)) {
      const g = ctx.createRadialGradient(px * SOFT_SCALE, py * SOFT_SCALE, 0, px * SOFT_SCALE, py * SOFT_SCALE, r * SOFT_SCALE);
      g.addColorStop(0, rgba(col, alpha));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px * SOFT_SCALE, py * SOFT_SCALE, r * SOFT_SCALE, r * SOFT_SCALE * (0.6 + 0.4 * hash2(i, 5, seed)), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  tex.refresh();

  // Decals stay off nodes (and their HQ slots) and out of the safe zones, so nothing looks like a place to click.
  const clear = (x: number, y: number): boolean => {
    for (const nd of map.nodes) {
      const p = iso.p(nd.pos.x, nd.pos.y);
      if (Math.abs(p.x - x) < iso.tile * 2.6 && Math.abs(p.y - y) < iso.tile * 2.6) return false;
    }
    for (const z of map.safeZones) {
      const x0 = (z.origin.cx - 1) * iso.tile;
      const y0 = (z.origin.cy - 1) * iso.tile;
      if (x > x0 && x < x0 + (z.cols + 2) * iso.tile && y > y0 && y < y0 + (z.rows + 2) * iso.tile) return false;
    }
    return true;
  };
  const kinds = DECALS.map((d) => d.key);
  const decals: Terrain['decals'] = [];
  for (let i = 0; i < a.decalCount * 3 && decals.length < a.decalCount * 2; i++) {
    const x = hash2(i, 11, seed) * iso.pxW;
    const y = hash2(i, 12, seed) * iso.pxH;
    const k = kinds[Math.floor(hash2(i, 13, seed) * kinds.length)];
    const flip = hash2(i, 14, seed) > 0.5;
    const spots = mirror(x, y);
    if (!spots.every(([px, py]) => clear(px, py))) continue;
    for (const [px, py] of spots) decals.push({ key: bakeDecal(scene, k), x: px, y: py, flip });
  }
  return { key, scale: SOFT_SCALE, decals };
}

interface DecalDef {
  key: string;
  w: number;
  h: number;
  draw: (g: G, cx: number, cy: number) => void;
}

/** Low-contrast ground features, drawn as vectors once and baked. Seen from above with light from the top left. */
const DECALS: DecalDef[] = [
  {
    key: 'rocks',
    w: 70,
    h: 50,
    draw: (g, cx, cy) => {
      const rock = (x: number, y: number, r: number) => {
        g.fillStyle(0x000000, 0.3).fillEllipse(x + 2, y + r * 0.5, r * 2.2, r * 0.9);
        g.fillStyle(0x3a3330, 1).fillCircle(x, y, r);
        g.fillStyle(0x5a4e45, 1).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.55);
      };
      rock(cx - 14, cy + 2, 7);
      rock(cx + 4, cy - 4, 9);
      rock(cx + 16, cy + 8, 5);
    },
  },
  {
    key: 'ridge',
    w: 110,
    h: 40,
    draw: (g, cx, cy) => {
      const pts = [-48, -30, -14, 0, 16, 32, 48].map((dx, i) => ({ x: cx + dx, y: cy + (i % 2 ? -5 : 4) }));
      g.lineStyle(4, 0x000000, 0.3).strokePoints(pts.map((p) => ({ x: p.x, y: p.y + 3 })));
      g.lineStyle(2, 0x6b5a4a, 0.3).strokePoints(pts);
      g.lineStyle(1, 0xff6a28, 0.18).strokePoints(pts.map((p) => ({ x: p.x, y: p.y + 2 })));
    },
  },
];

const DECAL_RES = 2;

function bakeDecal(scene: Phaser.Scene, kind: string): string {
  const key = `decal:${kind}`;
  if (scene.textures.exists(key)) return key;
  const d = DECALS.find((x) => x.key === kind)!;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.save();
  g.scaleCanvas(DECAL_RES, DECAL_RES);
  d.draw(g, d.w / 2, d.h / 2);
  g.restore();
  g.generateTexture(key, d.w * DECAL_RES, d.h * DECAL_RES);
  g.destroy();
  return key;
}

export const DECAL_SCALE = 1 / DECAL_RES;

// ------------------------------------------------------------------ territory

export interface TerritoryNode {
  x: number;
  y: number;
  owner: TeamId;
}

/**
 * Team territory: a soft glow of the team colour around every held node, fading out over `territoryRadiusCells`.
 * Soft on purpose, so it reads as ground influence and never as a box to click.
 */
export class Territory {
  readonly key: string;
  readonly scale = TERRITORY_SCALE;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private last = '';
  private static count = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly iso: Iso,
    private readonly mine: TeamId,
  ) {
    this.key = `territory${++Territory.count}`;
    this.tex = scene.textures.createCanvas(this.key, Math.ceil(iso.pxW * TERRITORY_SCALE), Math.ceil(iso.pxH * TERRITORY_SCALE))!;
  }

  /** Repaint only when the set of held, visible nodes changes. */
  update(nodes: TerritoryNode[]): void {
    const key = nodes.map((n) => `${n.x},${n.y},${n.owner}`).join(';');
    if (key === this.last) return;
    this.last = key;
    const a = clientTune.atmosphere;
    const ctx = this.tex.getContext();
    ctx.clearRect(0, 0, this.tex.width, this.tex.height);
    const r = a.territoryRadiusCells * this.iso.tile * TERRITORY_SCALE;
    for (const n of nodes) {
      const p = this.iso.p(n.x, n.y);
      const x = p.x * TERRITORY_SCALE;
      const y = p.y * TERRITORY_SCALE;
      const col = teamColor(n.owner, this.mine);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, a.territoryAlpha));
      g.addColorStop(0.6, rgba(col, a.territoryAlpha * 0.7));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    this.tex.refresh();
  }
}

// ------------------------------------------------------------------ scars and trails

interface Scar {
  x: number;
  y: number;
  start: number;
  seed: number;
}

interface Tread {
  x: number;
  y: number;
  start: number;
  ux: number;
  uy: number;
}

/** Scorch marks where fights happened and tread marks behind your own marches, fading out over time. */
export class Scars {
  private scars: Scar[] = [];
  private treads: Tread[] = [];
  private lastTread = new Map<string, number>();
  private seed = 1;

  /**
   * A fight at map pixels (x, y). Fights happen on nodes and HQs, whose art would hide a mark right on top, so the
   * scorches land in a ring around the spot, where the squads fought.
   */
  fight(x: number, y: number, tile: number, now: number): void {
    const n = 2 + Math.floor(hash2(this.seed, 9, 2) * 2);
    for (let i = 0; i < n; i++) {
      const ang = hash2(this.seed, i, 10) * Math.PI * 2;
      const r = tile * (0.75 + hash2(this.seed, i, 11) * 0.7);
      this.scorch(x + Math.cos(ang) * r, y + Math.sin(ang) * r, now);
    }
  }

  private scorch(x: number, y: number, now: number): void {
    const a = clientTune.atmosphere;
    // A second fight on the same spot refreshes the scar instead of stacking another one.
    const near = this.scars.find((s) => Math.abs(s.x - x) < 24 && Math.abs(s.y - y) < 24);
    if (near) {
      near.start = now;
      return;
    }
    this.scars.push({ x, y, start: now, seed: this.seed++ });
    if (this.scars.length > a.scarMax) this.scars.shift();
  }

  /** An own squad marching at map pixels (x, y), heading along (ux, uy). */
  tread(id: string, x: number, y: number, ux: number, uy: number, now: number): void {
    const a = clientTune.atmosphere;
    if (now - (this.lastTread.get(id) ?? -1e9) < a.treadEverySeconds) return;
    this.lastTread.set(id, now);
    this.treads.push({ x, y, start: now, ux, uy });
    if (this.treads.length > a.treadMax) this.treads.shift();
  }

  draw(g: G, now: number): void {
    const a = clientTune.atmosphere;
    g.clear();
    this.treads = this.treads.filter((t) => now - t.start < a.treadSeconds);
    for (const t of this.treads) {
      const k = 1 - (now - t.start) / a.treadSeconds;
      // Two short parallel dashes, like tracks, across the line of travel.
      const px = -t.uy * 6;
      const py = t.ux * 6;
      g.lineStyle(3, 0x000000, 0.3 * k);
      g.lineBetween(t.x + px - t.ux * 5, t.y + py - t.uy * 5, t.x + px + t.ux * 5, t.y + py + t.uy * 5);
      g.lineBetween(t.x - px - t.ux * 5, t.y - py - t.uy * 5, t.x - px + t.ux * 5, t.y - py + t.uy * 5);
    }
    this.scars = this.scars.filter((s) => now - s.start < a.scarSeconds);
    for (const s of this.scars) {
      const age = now - s.start;
      const k = 1 - age / a.scarSeconds;
      g.fillStyle(0x000000, 0.3 * k).fillEllipse(s.x, s.y, 56, 30);
      g.fillStyle(0x0a0605, 0.32 * k).fillEllipse(s.x + (hash2(s.seed, 1, 3) - 0.5) * 16, s.y + (hash2(s.seed, 2, 3) - 0.5) * 8, 40, 20);
      g.lineStyle(2, 0x1a0f0a, 0.45 * k);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + hash2(s.seed, i, 4) * 0.8;
        const r = 22 + hash2(s.seed, i, 5) * 14;
        g.lineBetween(s.x + Math.cos(ang) * 10, s.y + Math.sin(ang) * 5, s.x + Math.cos(ang) * r, s.y + Math.sin(ang) * r * 0.52);
      }
      // Embers glow in the scorch for the first part of its life.
      const glow = Math.max(0, 1 - age / (a.scarSeconds * 0.35));
      if (glow > 0) {
        for (let i = 0; i < 4; i++) {
          const fl = 0.6 + 0.4 * Math.sin(now * 7 + i * 1.7 + s.seed);
          g.fillStyle(i % 2 ? 0xff7a2a : 0xffc04a, 0.7 * glow * fl).fillCircle(s.x + (hash2(s.seed, i, 6) - 0.5) * 36, s.y + (hash2(s.seed, i, 7) - 0.5) * 16, 1.6 + hash2(s.seed, i, 8) * 1.4);
        }
      }
    }
  }
}

// ------------------------------------------------------------------ embers

interface Ember {
  x: number;
  y: number;
  start: number;
  life: number;
  sway: number;
  hot: boolean;
}

/** Sparks drifting up across the view. Sizes are in screen pixels, so they read the same at any zoom. */
export class Embers {
  private list: Ember[] = [];
  private seed = 1;

  draw(g: G, now: number, camX: number, camY: number, halfW: number, halfH: number, zoom: number): void {
    const a = clientTune.atmosphere;
    this.list = this.list.filter((e) => now - e.start < e.life && Math.abs(e.x - camX) < halfW * 1.3 && Math.abs(e.y - camY) < halfH * 1.3);
    while (this.list.length < a.emberCount) {
      const i = this.seed++;
      this.list.push({
        x: camX + (hash2(i, 1, 21) * 2 - 1) * halfW,
        y: camY + (hash2(i, 2, 21) * 2 - 1) * halfH,
        // Staggered start so they do not all appear at once.
        start: now - hash2(i, 3, 21) * 3,
        life: 3 + hash2(i, 4, 21) * 4,
        sway: hash2(i, 5, 21) * Math.PI * 2,
        hot: hash2(i, 6, 21) > 0.7,
      });
    }
    const px = 1 / zoom;
    for (const e of this.list) {
      const age = now - e.start;
      const k = age / e.life;
      const fade = Math.min(1, k * 4) * (1 - k);
      const x = e.x + Math.sin(now * 1.3 + e.sway) * 6 * px;
      const y = e.y - age * a.emberRise * px;
      g.fillStyle(e.hot ? 0xffd27a : 0xff8a3a, 0.75 * fade).fillCircle(x, y, (e.hot ? 1.6 : 1.1) * px);
    }
  }
}
