// Builds the playable's small art set from the fetched Punchies art
// (prototypes/punchies-playable/assets-src, see scripts/fetch-assets.js):
// only the two fighters and the animations the game uses, layers composited
// into flat frames, one WebP sheet per fighter plus an index.json.
//
//   node scripts/fetch-assets.js punchies-playable punchies_assets.zip
//   node prototypes/punchies-playable/scripts/prepare-art.mjs
//
// Frames are never trimmed or re-aligned individually: every frame is cut
// with the same fixed window around the shared registration point (128,128),
// so registration is preserved. Output goes to public/art (git-ignored).
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const proto = path.resolve(here, '..');
const src = path.join(proto, 'assets-src/packed');
const out = path.join(proto, 'public/art');

const CHARS = ['marco', 'bruno'];
const ACTIONS = ['idle', 'walk', 'jab', 'cross', 'guard', 'hit_light', 'ko'];
// Bottom to top. `ko` is already a flat folder.
const LAYERS = ['feet', 'torso', 'head', 'gloves', 'effects'];
const COLS = 8;
const REG = 128;

if (!existsSync(src)) {
  console.error('prepare-art: assets-src not found. Run: node scripts/fetch-assets.js punchies-playable punchies_assets.zip');
  process.exit(1);
}

const listFrames = (dir) => {
  const d = path.join(src, dir);
  return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(d, f)) : [];
};

// 1. Compose every frame to a full 256x256 buffer.
const composed = {}; // char -> action -> Buffer[]
for (const c of CHARS) {
  composed[c] = {};
  for (const a of ACTIONS) {
    const flat = listFrames(`${c}_${a}`);
    const layered = LAYERS.map((l) => listFrames(`${c}_${a}_${l}`));
    const n = flat.length || Math.max(...layered.map((l) => l.length));
    if (!n) throw new Error(`no frames for ${c}_${a}`);
    const frames = [];
    for (let i = 0; i < n; i++) {
      const parts = flat.length ? [flat[i]] : layered.map((l) => l[i]).filter(Boolean);
      const base = sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
      frames.push(await base.composite(parts.map((p) => ({ input: p }))).png().toBuffer());
    }
    composed[c][a] = frames;
  }
}

// 2. One fixed window for every frame, symmetric about the registration point.
let half = 0;
for (const c of CHARS) for (const a of ACTIONS) for (const f of composed[c][a]) {
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 8) half = Math.max(half, Math.abs(x - REG), Math.abs(y - REG), Math.abs(x + 1 - REG), Math.abs(y + 1 - REG));
  }
}
half = Math.min(REG, half + 2);
const cell = half * 2;

// 3. Pack one sheet per fighter.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const index = { cell, chars: {} };
let total = 0;
for (const c of CHARS) {
  const placed = [];
  index.chars[c] = {};
  let n = 0;
  for (const a of ACTIONS) {
    index.chars[c][a] = { start: n, count: composed[c][a].length };
    for (const f of composed[c][a]) {
      const cut = await sharp(f).extract({ left: REG - half, top: REG - half, width: cell, height: cell }).png().toBuffer();
      placed.push({ input: cut, left: (n % COLS) * cell, top: Math.floor(n / COLS) * cell });
      n++;
    }
  }
  const rows = Math.ceil(n / COLS);
  const file = path.join(out, `${c}.webp`);
  await sharp({ create: { width: COLS * cell, height: rows * cell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(placed).webp({ quality: 85, alphaQuality: 90, effort: 6 }).toFile(file);
  const size = statSync(file).size;
  total += size;
  console.log(`prepare-art: ${c}.webp ${COLS * cell}x${rows * cell}, ${n} frames, ${(size / 1024).toFixed(0)} KB`);
}
writeFileSync(path.join(out, 'index.json'), JSON.stringify(index));
console.log(`prepare-art: cell ${cell}px, total ${(total / 1024).toFixed(0)} KB`);
