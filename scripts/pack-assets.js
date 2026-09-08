#!/usr/bin/env node
// Atlas-packs prototypes/<name>/assets-src/packed/ with free-tex-packer-cli
// (one animation key per subfolder), copies assets-src/loose/ through -
// optionally downscaled/recompressed per IMAGE_OPTIMIZATION_RULES below -
// and writes a derived animation config plus a content-hash manifest into
// public/prototypes/<name>/assets/.
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import sharp from 'sharp';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Per-prototype, opt-in image optimization for loose/ assets - a
// prototype with no entry here gets exact byte-for-byte passthrough,
// exactly as before this existed (see STACK.md's "Art asset pipeline:
// automatic downscale/recompress" section for the full rationale and how
// to opt another prototype in). Rules are tried in order; the first whose
// `match` (tested against the filename minus extension) returns true
// wins. Each rule:
//   - `maxDimension` (optional): fit the image inside an NxN box,
//     aspect ratio preserved, never enlarged if it's already smaller.
//     Sized to real on-screen usage, not a guess - see each prototype's
//     own comment below for the call sites that set the number.
//   - `format`/`quality` (optional): re-encode into a smaller-footprint
//     format. Currently only 'webp' is implemented (lossy, high quality -
//     suits this repo's painterly/photographic art with alpha better
//     than PNG at equivalent visual quality). Omit to keep the source
//     format.
// A rule with neither `maxDimension` nor `format` is a no-op passthrough,
// same as no rule at all - only useful to explicitly document that an
// asset was considered and intentionally left alone (see suits-mp's
// tabletop background below).
const IMAGE_OPTIMIZATION_RULES = {
  'suits-mp': [
    // The tabletop background is placed via an anchor-and-cover fit (see
    // ui/renderGameView.ts's drawTabletop(), which can require MORE than
    // the image's native 841x1870 pixels at 2x device pixel ratio once
    // the off-center anchor's covering scale is applied) - i.e. this
    // asset is already at, or slightly under, its ideal resolution for
    // its actual on-screen footprint. Recompress only, never downscale.
    { match: (name) => name === 'background_tabletop_stone', format: 'webp', quality: 88 },
    // Everything else (card_backdrop_*/card_frame_*/deity_symbol_*/
    // deity_face_*/deity_nameplate_*, the two ui_* chrome textures, and
    // the two now-unused rank_badge_* files still shipped from the R2
    // zip) is authored at a large illustration canvas (1024x1536 or
    // similar) but only ever rendered small - see cardArt.ts's
    // placeContain() (k = dims.width / 1024) and its callers' real
    // ceiling: CARD_DIMS_STANDARD (76x114 logical) x handFanPopOutScale
    // (1.08, the hand fan's only enlargement) x PIXEL_RATIO (capped at
    // 2x) is ~165x246 physical px at most - every DOM <img> use of this
    // same art (GameOverlay.tsx's Suit Cycle HUD badges, Required Suit
    // banner icon, seat nameplate) is smaller still. 512 leaves real
    // margin above that ceiling while still being a large real
    // reduction from the 1024-1536px authoring canvas.
    { match: () => true, maxDimension: 512, format: 'webp', quality: 88 },
  ],
};

function fail(message) {
  console.error(`pack-assets: ${message}`);
  process.exit(1);
}

const name = process.argv[2];
if (!name) {
  fail('missing prototype name. Usage: npm run pack:assets <name>');
}

const protoDir = path.join(rootDir, 'prototypes', name);
const assetsSrcDir = path.join(protoDir, 'assets-src');
const packedSrcDir = path.join(assetsSrcDir, 'packed');
const looseSrcDir = path.join(assetsSrcDir, 'loose');

if (!existsSync(assetsSrcDir)) {
  fail(`${path.relative(rootDir, assetsSrcDir)} not found. Run "npm run fetch:assets ${name}" first.`);
}

const outDir = path.join(rootDir, 'public', 'prototypes', name, 'assets');
const atlasOutDir = path.join(outDir, 'atlas');
const looseOutDir = path.join(outDir, 'loose');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(atlasOutDir, { recursive: true });

const fetchedAt = new Date().toISOString();
const manifest = [];

function hashFile(filePath) {
  return crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function addToManifest(relativePath, absolutePath) {
  manifest.push({
    path: relativePath,
    hash: hashFile(absolutePath),
    fetchedAt,
  });
}

// --- Pack animations ---
const animations = {};

const animKeysPresent = existsSync(packedSrcDir)
  ? readdirSync(packedSrcDir).filter((entry) => statSync(path.join(packedSrcDir, entry)).isDirectory())
  : [];

if (animKeysPresent.length > 0) {
  const animKeys = animKeysPresent.sort();

  const folders = [];
  for (const key of animKeys) {
    const dir = path.join(packedSrcDir, key);
    const frames = readdirSync(dir)
      .filter((f) => /\.png$/i.test(f))
      .sort();

    if (frames.length === 0) {
      fail(`animation folder "${key}" has no frames`);
    }

    animations[key] = {
      frameCount: frames.length,
      frames: frames.map((f) => `${key}/${f.replace(/\.png$/i, '')}`),
    };
    folders.push(dir);
  }

  const atlasName = 'atlas';
  const projectPath = path.join(rootDir, '.cache', `${name}-pack.ftpp`);
  mkdirSync(path.dirname(projectPath), { recursive: true });

  const project = {
    packOptions: {
      textureName: atlasName,
      width: 2048,
      height: 2048,
      fixedSize: false,
      powerOfTwo: false,
      padding: 2,
      extrude: 0,
      allowRotation: false,
      detectIdentical: false,
      allowTrim: true,
      trimMode: 'trim',
      removeFileExtension: true,
      prependFolderName: true,
      textureFormat: 'png',
      base64Export: false,
      scale: 1,
      packer: 'MaxRectsBin',
      packerMethod: 'BestShortSideFit',
      exporter: 'Phaser 3',
    },
    images: [],
    folders,
    savePath: atlasOutDir,
  };

  writeFileSync(projectPath, JSON.stringify(project, null, 2));

  console.log(`pack-assets: packing ${animKeys.length} animation folder(s) with free-tex-packer-cli`);

  const cliBin = path.join(rootDir, 'node_modules', '.bin', 'free-tex-packer-cli');
  try {
    execFileSync(cliBin, ['--project', projectPath, '--output', atlasOutDir], {
      stdio: 'inherit',
      cwd: rootDir,
    });
  } catch (err) {
    fail(`free-tex-packer-cli failed: ${err.message}`);
  }

  const atlasFiles = readdirSync(atlasOutDir).filter(
    (f) => f.startsWith(atlasName) && (f.endsWith('.png') || f.endsWith('.json'))
  );
  if (atlasFiles.length === 0) {
    fail('free-tex-packer-cli did not produce any atlas output');
  }
  for (const file of atlasFiles) {
    addToManifest(`atlas/${file}`, path.join(atlasOutDir, file));
  }

  const animationsPath = path.join(atlasOutDir, 'animations.json');
  writeFileSync(animationsPath, JSON.stringify(animations, null, 2));
  addToManifest('atlas/animations.json', animationsPath);
} else {
  console.log('pack-assets: no packed/ folder in assets-src, skipping atlas packing');
}

// --- Copy loose assets through (optionally optimized per the rules above) ---

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// Applies the first matching rule (if any) to one loose file, writing the
// result into looseOutDir. Returns the output filename (same as the input
// unless `format` changed the extension) plus the before/after byte sizes
// for the summary logged once packing finishes. Falls back to an exact
// copy for non-image files, or when no rule matches, or when the source
// image is already within `maxDimension` and no `format` conversion is
// requested (sharp re-encoding a file we're not shrinking would only add
// build time for no size benefit).
async function processLooseFile(file, rules) {
  const src = path.join(looseSrcDir, file);
  const originalSize = statSync(src).size;
  const ext = path.extname(file).toLowerCase();
  const baseName = path.basename(file, ext);

  const rule = IMAGE_EXTENSIONS.has(ext) ? rules?.find((r) => r.match(baseName)) : undefined;

  if (!rule || (!rule.maxDimension && !rule.format)) {
    const dest = path.join(looseOutDir, file);
    copyFileSync(src, dest);
    return { outputFile: file, originalSize, outputSize: originalSize };
  }

  let pipeline = sharp(src);
  if (rule.maxDimension) {
    pipeline = pipeline.resize({
      width: rule.maxDimension,
      height: rule.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  if (rule.format === 'webp') {
    pipeline = pipeline.webp({ quality: rule.quality ?? 85 });
  } else if (rule.format) {
    fail(`unknown image optimization format "${rule.format}" for ${file}`);
  }

  const outputFile = rule.format === 'webp' ? `${baseName}.webp` : file;
  const dest = path.join(looseOutDir, outputFile);
  await pipeline.toFile(dest);
  const outputSize = statSync(dest).size;
  return { outputFile, originalSize, outputSize };
}

if (existsSync(looseSrcDir)) {
  mkdirSync(looseOutDir, { recursive: true });
  const looseFiles = readdirSync(looseSrcDir).filter((f) =>
    statSync(path.join(looseSrcDir, f)).isFile()
  );
  const rules = IMAGE_OPTIMIZATION_RULES[name];

  let totalBefore = 0;
  let totalAfter = 0;
  for (const file of looseFiles) {
    const { outputFile, originalSize, outputSize } = await processLooseFile(file, rules);
    totalBefore += originalSize;
    totalAfter += outputSize;
    addToManifest(`loose/${outputFile}`, path.join(looseOutDir, outputFile));
  }

  if (rules) {
    const pct = totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0;
    console.log(
      `pack-assets: optimized loose/ - ${(totalBefore / 1e6).toFixed(1)}MB -> ${(totalAfter / 1e6).toFixed(1)}MB (${pct}% smaller)`,
    );
  }
} else {
  console.log('pack-assets: no loose/ folder in assets-src, skipping loose copy');
}

const manifestPath = path.join(outDir, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`pack-assets: wrote ${manifest.length} file(s) to ${path.relative(rootDir, outDir)}`);
