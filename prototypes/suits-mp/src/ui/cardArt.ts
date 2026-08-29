import Phaser from 'phaser';
import { GOD_TEAM } from '../rules/cards';
import type { God, Rank } from '../rules/types';
import type { CardDimensions } from './cardComponent';
import { PIXEL_RATIO } from '../render/pixelRatio';

// Real card compositing, per the Claude Design handoff ("Suit of Madness
// Card Frame.dc.html"). Three layers, assembled at runtime rather than
// baked into 40 static PNGs:
//   1. A per-god card-frame texture (background/border/motif/symbol-plate),
//      generated once via Canvas2D (scene.textures.createCanvas) - only 4
//      of these exist (one per god; rank never changes a frame's look).
//   2. The god's symbol (ranks 2-10) or full face art (Aces) - one of the
//      8 R2-fetched PNGs, placed as its own Image so it can differ by rank
//      without multiplying frame textures.
//   3. The rank numeral (ranks 2-10 only) - a live Phaser.Text, per root
//      CLAUDE.md's DPR rule (baking it into the canvas frame would bypass
//      per-Text `resolution`). Its backing "rank-plate" plate shape is
//      drawn fresh via Graphics rather than baked into the frame texture,
//      since it must disappear entirely on Aces (same frame texture is
//      shared by every rank of that god).
//
// Scope note: the design's engraving dot-pattern, linen hatch, and SVG
// grain-noise texture layers are omitted - all three are sub-pixel detail
// at this project's actual on-screen card size (tens of px tall) and would
// cost far more Canvas2D code than they'd ever be visible. Background
// washes, tint, vignette, gold border/corners, the hex/circle motif, the
// symbol-plate, and the team tag are all reproduced.

interface GodTokens {
  line: string;
  plate: string;
  glow: string;
  deep: string;
  label: string;
  motif: 'hex' | 'circle';
  artIndex: number;
  artSlug: string;
}

const GOD_TOKENS: Record<God, GodTokens> = {
  Cthulhu: {
    line: 'rgba(96, 200, 188, 0.72)',
    plate: 'rgba(14, 62, 62, 0.62)',
    glow: 'rgba(34, 150, 144, 0.20)',
    deep: 'rgba(8, 52, 56, 0.34)',
    label: 'rgba(140, 210, 198, 0.85)',
    motif: 'hex',
    artIndex: 1,
    artSlug: 'cthulhu',
  },
  Nyarlathotep: {
    line: 'rgba(178, 138, 226, 0.68)',
    plate: 'rgba(40, 22, 62, 0.66)',
    glow: 'rgba(112, 62, 168, 0.20)',
    deep: 'rgba(24, 10, 40, 0.44)',
    label: 'rgba(186, 156, 224, 0.85)',
    motif: 'hex',
    artIndex: 2,
    artSlug: 'nyarlathotep',
  },
  ShubNiggurath: {
    line: 'rgba(150, 200, 108, 0.68)',
    plate: 'rgba(30, 54, 22, 0.62)',
    glow: 'rgba(96, 148, 48, 0.20)',
    deep: 'rgba(28, 40, 12, 0.38)',
    label: 'rgba(178, 208, 132, 0.85)',
    motif: 'circle',
    artIndex: 3,
    artSlug: 'shub-niggurath',
  },
  YogSothoth: {
    line: 'rgba(196, 160, 232, 0.68)',
    plate: 'rgba(46, 30, 66, 0.62)',
    glow: 'rgba(132, 88, 172, 0.20)',
    deep: 'rgba(32, 18, 44, 0.40)',
    label: 'rgba(206, 178, 132, 0.85)',
    motif: 'circle',
    artIndex: 4,
    artSlug: 'yog-sothoth',
  },
};

function symbolKey(god: God): string {
  const t = GOD_TOKENS[god];
  return `symbol_${t.artIndex}_${t.artSlug}`;
}

function faceKey(god: God): string {
  const t = GOD_TOKENS[god];
  return `face_${t.artIndex}_${t.artSlug}`;
}

// Loads the 8 R2-fetched god art PNGs (see art/manifest.json, produced by
// scripts/pack-assets.js from prototypes/suits-mp/assets-src/loose/) the
// same manifest-driven way every other prototype with loose art loads it
// (see prototypes/digger/src/main.ts's preload) - discovering filenames
// from the manifest rather than hardcoding them keeps this working if art
// gets re-exported under different filenames later.
interface ManifestEntry {
  path: string;
  hash: string;
  fetchedAt: string;
}

const MANIFEST_KEY = '__suitsMpCardArtManifest';

function queueLooseImages(scene: Phaser.Scene): void {
  const manifest = scene.cache.json.get(MANIFEST_KEY) as ManifestEntry[];
  for (const entry of manifest) {
    if (!entry.path.startsWith('loose/')) continue;
    const key = entry.path.slice('loose/'.length).replace(/\.[^.]+$/, '');
    if (!scene.textures.exists(key)) scene.load.image(key, `assets/${entry.path}`);
  }
}

export function preloadCardArt(scene: Phaser.Scene): void {
  if (scene.cache.json.exists(MANIFEST_KEY)) {
    // A previous scene instance in this same Game already loaded the
    // manifest (and, via the completion handler below, the images it
    // lists) - re-queuing loads for keys that already exist in the
    // Texture Manager is a no-op per queueLooseImages' own guard, so this
    // only matters the first time any scene reaches here.
    queueLooseImages(scene);
    return;
  }
  scene.load.json(MANIFEST_KEY, 'assets/manifest.json');
  scene.load.once(`filecomplete-json-${MANIFEST_KEY}`, () => queueLooseImages(scene));
}

// --- Card-local authoring space -----------------------------------------
// Matches the design's own 300x816 reference canvas exactly, so every zone
// coordinate below is a direct transcription of the .dc.html spec. Frame
// textures are generated at half that resolution (150x408) - comfortably
// oversampled for this game's largest on-screen card size (the popped-out
// hand card, well under 100 logical px wide even at PIXEL_RATIO 2), while
// keeping texture memory small.

const AUTH_W = 300;
const AUTH_H = 816;
const TEX_SCALE = 0.5;
const TEX_W = AUTH_W * TEX_SCALE;
const TEX_H = AUTH_H * TEX_SCALE;

const SYMBOL_SAFE = { x: 50, y: 170, w: 200, h: 236 };
const ACE_BLEED = { x: 26, y: 92, w: 248, h: 396 };
const RANK_SAFE = { x: 96, y: 572, w: 108, h: 68 };

function frameKey(god: God): string {
  return `cardFrame_${god}`;
}

function ellipseRadialFill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  stops: ReadonlyArray<readonly [number, string]>,
): void {
  if (rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// The hex plate's own clip-path polygon from the .dc.html spec, expressed
// relative to a box of the given width/height (its apex sits at the exact
// horizontal center, side vertices at ~20%/80% height - the same fixed
// proportions the spec uses for both the symbol-plate and rank-plate hexes,
// just at different box sizes).
function hexPolygon(x: number, y: number, w: number, h: number): [number, number][] {
  const midX = x + w / 2;
  const yTop = y + h * 0.1995;
  const yBot = y + h * 0.8005;
  return [
    [midX, y],
    [x + w, yTop],
    [x + w, yBot],
    [midX, y + h],
    [x, yBot],
    [x, yTop],
  ];
}

function fillPolygon(ctx: CanvasRenderingContext2D, points: ReadonlyArray<readonly [number, number]>): void {
  ctx.beginPath();
  points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.fill();
}

function drawSymbolPlate(ctx: CanvasRenderingContext2D, tokens: GodTokens): void {
  const { x, y, w, h } = ACE_BLEED; // the plate's own full silhouette bounds
  if (tokens.motif === 'hex') {
    ctx.fillStyle = tokens.line;
    fillPolygon(ctx, hexPolygon(x, y, w, h));
    ctx.fillStyle = '#080c0e';
    fillPolygon(ctx, hexPolygon(x + 1, y + 1.2, w - 2, h - 2.4));
    ctx.fillStyle = 'rgba(176, 142, 66, 0.26)';
    fillPolygon(ctx, hexPolygon(x + 9, y + 10.7, w - 18, h - 21.4));
    ctx.save();
    fillPolygon(ctx, hexPolygon(x + 11, y + 13, w - 22, h - 26));
    ctx.clip();
    ellipseRadialFill(ctx, x + w / 2, y + h * 0.46, w * 0.28, h * 0.26, [
      [0, tokens.plate],
      [1, 'rgba(4, 7, 9, 0.97)'],
    ]);
    ctx.restore();
  } else {
    ctx.strokeStyle = tokens.line;
    ctx.lineWidth = 1;
    roundedRectPath(ctx, x, y, w, h, 100);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(176, 142, 66, 0.26)';
    roundedRectPath(ctx, x + 8, y + 8, w - 16, h - 16, 92);
    ctx.stroke();
    ctx.save();
    roundedRectPath(ctx, x + 10, y + 10, w - 20, h - 20, 90);
    ctx.clip();
    ellipseRadialFill(ctx, x + w / 2, y + h * 0.46, w * 0.28, h * 0.26, [
      [0, tokens.plate],
      [1, 'rgba(4, 7, 9, 0.97)'],
    ]);
    ctx.restore();
    ctx.strokeStyle = 'rgba(176, 142, 66, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w * 0.463, h * 0.290, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = tokens.line;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 34, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h - 34, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMotifOrnaments(ctx: CanvasRenderingContext2D, tokens: GodTokens): void {
  const midX = AUTH_W / 2;
  if (tokens.motif === 'hex') {
    ctx.fillStyle = tokens.line;
    fillPolygon(ctx, hexPolygon(midX - 17, 30, 34, 30));
    ctx.fillStyle = '#080c0e';
    fillPolygon(ctx, hexPolygon(midX - 16, 31, 32, 28));
    ctx.fillStyle = tokens.line;
    fillPolygon(ctx, hexPolygon(midX - 17, AUTH_H - 60, 34, 30));
    ctx.fillStyle = '#080c0e';
    fillPolygon(ctx, hexPolygon(midX - 16, AUTH_H - 59, 32, 28));
  } else {
    ctx.strokeStyle = tokens.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(midX, 44, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(midX, AUTH_H - 44, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawFrameTexture(scene: Phaser.Scene, god: God): void {
  const key = frameKey(god);
  if (scene.textures.exists(key)) return;
  const tokens = GOD_TOKENS[god];

  const canvasTexture = scene.textures.createCanvas(key, TEX_W, TEX_H);
  if (!canvasTexture) return;
  const ctx = canvasTexture.context;
  ctx.scale(TEX_SCALE, TEX_SCALE);
  ctx.imageSmoothingEnabled = true;

  // Base wash.
  ctx.fillStyle = '#080c0e';
  ctx.fillRect(0, 0, AUTH_W, AUTH_H);
  ellipseRadialFill(ctx, 150, 375.4, 240, 375.4, [
    [0, 'rgba(34, 38, 32, 0.5)'],
    [1, 'rgba(6, 9, 11, 0)'],
  ]);
  ellipseRadialFill(ctx, 42, 32.6, 270, 326.4, [
    [0, 'rgba(58, 50, 32, 0.26)'],
    [1, 'rgba(6, 9, 11, 0)'],
  ]);
  ellipseRadialFill(ctx, 258, 799.7, 270, 326.4, [
    [0, 'rgba(58, 50, 32, 0.2)'],
    [1, 'rgba(6, 9, 11, 0)'],
  ]);

  // Tint (glow + deep) - the one layer that carries most of each god's
  // color identity at a glance.
  ellipseRadialFill(ctx, 150, 269.3, 93, 138.7, [
    [0, tokens.glow],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ellipseRadialFill(ctx, 150, 881.3, 360, 408, [
    [0, tokens.deep],
    [1, 'rgba(0,0,0,0)'],
  ]);

  drawSymbolPlate(ctx, tokens);
  drawMotifOrnaments(ctx, tokens);

  // Gold border + corner brackets (shared, never recolored).
  ctx.strokeStyle = 'rgba(122, 98, 46, 0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, AUTH_W - 2, AUTH_H - 2);
  ctx.strokeStyle = 'rgba(176, 142, 66, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(9, 9, AUTH_W - 18, AUTH_H - 18);

  ctx.strokeStyle = 'rgba(198, 160, 78, 0.72)';
  const cornerLen = 16;
  const cornerInset = 18;
  const corners: [number, number, number, number][] = [
    [cornerInset, cornerInset, 1, 1],
    [AUTH_W - cornerInset, cornerInset, -1, 1],
    [cornerInset, AUTH_H - cornerInset, 1, -1],
    [AUTH_W - cornerInset, AUTH_H - cornerInset, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + cornerLen * dy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + cornerLen * dx, cy);
    ctx.stroke();
  }

  // Top/bottom accent double-lines.
  ctx.strokeStyle = 'rgba(176, 142, 66, 0.45)';
  for (const y of [56, AUTH_H - 56]) {
    ctx.beginPath();
    ctx.moveTo(52, y);
    ctx.lineTo(AUTH_W - 52, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(176, 142, 66, 0.2)';
  for (const y of [62, AUTH_H - 62]) {
    ctx.beginPath();
    ctx.moveTo(74, y);
    ctx.lineTo(AUTH_W - 74, y);
    ctx.stroke();
  }

  // Vignette - darkens the edges over everything else.
  ellipseRadialFill(ctx, 150, 359, 117, 424, [
    [0.34, 'rgba(0,0,0,0)'],
    [1, 'rgba(2, 4, 6, 0.9)'],
  ]);

  // Team tag - baked here (static per god, unlike the rank numeral, so it
  // doesn't need the per-Text DPR treatment - the whole texture is already
  // generated at a fixed oversampled resolution).
  ctx.fillStyle = tokens.label;
  ctx.font = "700 10px 'Cormorant Unicase', serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '2.8px';
  ctx.fillText(`Team ${GOD_TEAM[god]}`.toUpperCase(), 150, AUTH_H - 96);

  canvasTexture.refresh();
}

export function ensureCardFrameTextures(scene: Phaser.Scene): void {
  (Object.keys(GOD_TOKENS) as God[]).forEach((god) => drawFrameTexture(scene, god));
}

// --- buildCard ------------------------------------------------------------

export interface BuiltCard {
  container: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Rectangle;
}

// The one place a real (non-facedown, non-empty) card gets assembled -
// frame + god symbol/face art + (ranks 2-10 only) rank numeral - reusable
// wherever a face-up card appears (hand fan, play areas, previous-trick
// log). `dims` is the caller's display size in logical px; art is always
// authored/generated at the fixed 300x816 reference and scaled down to
// fit, so this works at both CARD_DIMS_STANDARD and CARD_DIMS_MINI (and
// the hand fan's popped-out scale) without regenerating any texture.
export function buildCard(scene: Phaser.Scene, god: God, rank: Rank, dims: CardDimensions): BuiltCard {
  const tokens = GOD_TOKENS[god];
  const k = dims.width / AUTH_W;

  const container = scene.add.container(0, 0);

  const frame = scene.add.image(0, 0, frameKey(god)).setDisplaySize(dims.width, dims.height);
  container.add(frame);

  const isAce = rank === 'Ace';
  const artKey = isAce ? faceKey(god) : symbolKey(god);
  const safeRect = isAce ? ACE_BLEED : SYMBOL_SAFE;
  if (scene.textures.exists(artKey)) {
    const art = scene.add.image(0, 0, artKey);
    const srcFrame = art.frame;
    const fitScale = Math.min(safeRect.w / srcFrame.width, safeRect.h / srcFrame.height);
    art.setDisplaySize(srcFrame.width * fitScale * k, srcFrame.height * fitScale * k);
    art.setY((safeRect.y + safeRect.h / 2 - AUTH_H / 2) * k);
    container.add(art);
  }

  if (!isAce) {
    const rankCenterX = (RANK_SAFE.x + RANK_SAFE.w / 2 - AUTH_W / 2) * k;
    const rankCenterY = (RANK_SAFE.y + RANK_SAFE.h / 2 - AUTH_H / 2) * k;
    const plateW = RANK_SAFE.w * k;
    const plateH = RANK_SAFE.h * k;

    const plate = scene.add.graphics();
    plate.fillStyle(0x0b1010, 0.98);
    plate.lineStyle(Math.max(1, k), hexToNumber(tokens.line), 1);
    if (tokens.motif === 'hex') {
      const pts = hexPolygon(rankCenterX - plateW / 2, rankCenterY - plateH / 2, plateW, plateH);
      plate.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? plate.moveTo(px, py) : plate.lineTo(px, py)));
      plate.closePath();
      plate.fillPath();
      plate.strokePath();
    } else {
      plate.fillRoundedRect(rankCenterX - plateW / 2, rankCenterY - plateH / 2, plateW, plateH, plateH / 2);
      plate.strokeRoundedRect(rankCenterX - plateW / 2, rankCenterY - plateH / 2, plateW, plateH, plateH / 2);
    }
    container.add(plate);

    const rankLabel = String(rank);
    const fontSize = Math.round((rankLabel.length > 1 ? 90 : 128) * k);
    const rankText = scene.add
      .text(rankCenterX, rankCenterY, rankLabel, {
        fontFamily: 'Georgia, serif',
        fontStyle: 'bold',
        fontSize: `${fontSize}px`,
        color: '#f2e0a8',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);
    container.add(rankText);
  }

  const hitArea = scene.add.rectangle(0, 0, dims.width, dims.height, 0x000000, 0.001);
  container.add(hitArea);

  return { container, hitArea };
}

function hexToNumber(rgba: string): number {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgba);
  if (!m) return 0xffffff;
  return (parseInt(m[1], 10) << 16) | (parseInt(m[2], 10) << 8) | parseInt(m[3], 10);
}
