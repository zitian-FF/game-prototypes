#!/usr/bin/env node
// Atlas-packs prototypes/<name>/assets-src/packed/ with free-tex-packer-cli
// (one animation key per subfolder), copies assets-src/loose/ through -
// optionally downscaled/recompressed per IMAGE_OPTIMIZATION_RULES below -
// and writes a derived animation config plus a content-hash manifest into
// public/prototypes/<name>/assets/.
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  punchies: [
    // Waist-framed portraits; retain full-resolution design masters in Drive.
    { match: name => name === 'portrait_tyke', keepTop: .86, maxDimension: 1280, format: 'webp', quality: 90 },
    { match: name => name === 'portrait_longan', keepTop: .75, maxDimension: 1280, format: 'webp', quality: 90 },
    // Victory/reveal portraits reach about 360 logical pixels at up to 3x.
    { match: name => name.startsWith('portrait_'), maxDimension: 1280, format: 'webp', quality: 90 },
    { match: name => ['gym_background', 'character_select_background'].includes(name), format: 'webp', quality: 90 },
    // Preserve full registration, resolution and pixels; shrink PNG transfer only.
    { match: () => true, format: 'webp', lossless: true },
  ],
  'suits-mp': [
    // The tabletop background is placed via an anchor-and-cover fit (see
    // ui/renderGameView.ts's drawTabletop(), which can require MORE than
    // the image's native 841x1870 pixels at 2x device pixel ratio once
    // the off-center anchor's covering scale is applied) - i.e. this
    // asset is already at, or slightly under, its ideal resolution for
    // its actual on-screen footprint. Recompress only, never downscale.
    { match: (name) => name === 'background_tabletop_stone', format: 'webp', quality: 88 },
    // Landing-screen button/input chrome (suits-mp_landing_ui_assets_v001):
    // authored at 2172x724 (3:1) and rendered as a full-width DOM background
    // covering the whole landing button/input box (see dom/lobby/
    // LobbyFlow.css) - unlike the card-art family below, this can
    // legitimately need most of its own width in device pixels on a wide
    // phone at high DPR (e.g. ~380 CSS px wide x up to 3x DPR ≈ 1140px).
    // 1536 covers that with real margin while still being a meaningful
    // reduction from the 2172px authoring canvas.
    { match: (name) => name.startsWith('ui_landing_'), maxDimension: 1536, format: 'webp', quality: 88 },
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

// Per-prototype, opt-in atlas splitting. A prototype with no entry here is
// packed into one shared atlas (atlas-0, atlas-1, ...) exactly as before.
// With an entry, each animation key is mapped to a group name and every
// group is packed into its own atlas set (atlas-<group>-0, ...), so the game
// can download only the groups a scene needs. The mapping is derived from
// the folder names, never a hand-kept list.
//   punchies: "<char>_<action>" -> "<char>", "<char>_alt_<action>" -> "<char>_alt",
//   "dummy_<action>" -> "dummy".
const ATLAS_GROUPING = {
  punchies: (key) => {
    const [first, second] = key.split('_');
    return second === 'alt' ? `${first}_alt` : first;
  },
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
  // Selected skins are generated from base textures; obsolete mirror-match art is not shipped.
  const animKeys = animKeysPresent.filter(key => name !== 'punchies' || !/^(marco|mia|bruno)_alt_/.test(key)).sort();

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

  const groupOf = ATLAS_GROUPING[name];
  const groups = new Map(); // atlas name -> { folders, animations }
  for (const key of animKeys) {
    const group = groupOf ? groupOf(key) : null;
    const atlasName = group ? `atlas-${group}` : 'atlas';
    if (!groups.has(atlasName)) groups.set(atlasName, { group, folders: [], animations: [] });
    groups.get(atlasName).folders.push(path.join(packedSrcDir, key));
    groups.get(atlasName).animations.push(key);
  }

  // Invoke Node directly so Windows does not need to execute a shell shim.
  const cliBin = path.join(rootDir, 'node_modules', 'free-tex-packer-cli', 'index.js');
  const groupIndex = {};
  mkdirSync(path.join(rootDir, '.cache'), { recursive: true });

  for (const [atlasName, info] of groups) {
    const projectPath = path.join(rootDir, '.cache', `${name}-pack-${atlasName}.ftpp`);
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
      folders: info.folders,
      savePath: atlasOutDir,
    };
    writeFileSync(projectPath, JSON.stringify(project, null, 2));

    console.log(`pack-assets: packing ${info.folders.length} animation folder(s) into ${atlasName}`);
    try {
      execFileSync(process.execPath, [cliBin, '--project', projectPath, '--output', atlasOutDir], {
        stdio: 'inherit',
        cwd: rootDir,
      });
    } catch (err) {
      fail(`free-tex-packer-cli failed: ${err.message}`);
    }

    // Exactly this atlas's files: "<atlasName>.json|png" for a single sheet or
    // "<atlasName>-<n>.json|png" when it spills. Anchoring keeps "atlas-marco"
    // from claiming "atlas-marco_alt".
    const own = new RegExp(`^${atlasName}(-\\d+)?\\.(png|json)$`);
    let atlasFiles = readdirSync(atlasOutDir).filter((f) => own.test(f));
    if (name === 'punchies') {
      // Lossless WebP preserves packed pixels, registration and frame geometry.
      for (const file of atlasFiles.filter(f => f.endsWith('.png'))) {
        const dest = file.replace(/\.png$/, '.webp');
        await sharp(path.join(atlasOutDir,file)).webp({lossless:true,effort:6}).toFile(path.join(atlasOutDir,dest));
        rmSync(path.join(atlasOutDir,file));
      }
      atlasFiles = atlasFiles.map(f => f.replace(/\.png$/, '.webp'));
    }
    if (atlasFiles.length === 0) {
      fail(`free-tex-packer-cli did not produce any output for ${atlasName}`);
    }
    for (const file of atlasFiles) {
      if (file.endsWith('.json')) {
        // The CLI preserves absolute folder paths on Windows. Export portable
        // frame keys matching animations.json without altering trim offsets.
        const atlasPath = path.join(atlasOutDir, file);
        const atlas = JSON.parse(readFileSync(atlasPath, 'utf8'));
        if (name === 'punchies') for (const texture of atlas.textures ?? []) texture.image = texture.image.replace(/\.png$/, '.webp');
        const prefix = packedSrcDir.replaceAll('\\', '/') + '/';
        for (const texture of atlas.textures ?? []) {
          for (const frame of texture.frames ?? []) {
            const filename = frame.filename.replaceAll('\\', '/');
            if (filename.startsWith(prefix)) frame.filename = filename.slice(prefix.length);
          }
        }
        writeFileSync(atlasPath, JSON.stringify(atlas));
      }
      addToManifest(`atlas/${file}`, path.join(atlasOutDir, file));
    }
    if (info.group) {
      groupIndex[info.group] = {
        atlases: atlasFiles.filter((f) => f.endsWith('.json')).map((f) => `atlas/${f}`),
        animations: info.animations,
      };
    }
  }

  if (groupOf) {
    const groupsPath = path.join(atlasOutDir, 'groups.json');
    writeFileSync(groupsPath, JSON.stringify(groupIndex, null, 2));
    addToManifest('atlas/groups.json', groupsPath);
  }

  const animationsPath = path.join(atlasOutDir, 'animations.json');
  writeFileSync(animationsPath, JSON.stringify(animations, null, 2));
  addToManifest('atlas/animations.json', animationsPath);
} else {
  console.log('pack-assets: no packed/ folder in assets-src, skipping atlas packing');
}

// --- Optional per-prototype prepare step ---
// A prototype may ship art/prepare-assets.mjs (default export, async). It runs
// here, after the fetch and before loose/ is copied, so it can derive extra
// loose files (e.g. downsized parts) from the raw art. Prototypes without the
// file are unaffected.
const prepareHook = path.join(protoDir, 'art', 'prepare-assets.mjs');
if (existsSync(prepareHook)) {
  const mod = await import(pathToFileURL(prepareHook).href);
  await mod.default({ assetsSrcDir, rootDir });
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

  // Cleaned R2 sources already contain the final framed/encoded loose art.
  // Copy it exactly: repeated lossy encoding and waist cropping must not occur.
  if (name === 'punchies' && existsSync(path.join(assetsSrcDir, 'active-assets.json')) && !['portrait_tyke','portrait_longan'].includes(baseName)) {
    copyFileSync(src, path.join(looseOutDir, file));
    return { outputFile: file, originalSize, outputSize: originalSize };
  }

  const rule = IMAGE_EXTENSIONS.has(ext) ? rules?.find((r) => r.match(baseName)) : undefined;

  if (!rule || (!rule.maxDimension && !rule.format) || (rule.lossless && ext !== '.png' && !rule.keepTop)) {
    const dest = path.join(looseOutDir, file);
    copyFileSync(src, dest);
    return { outputFile: file, originalSize, outputSize: originalSize };
  }

  let pipeline = sharp(src);
  if (rule.keepTop) {
    const meta = await pipeline.metadata();
    pipeline = pipeline.extract({left:0,top:0,width:meta.width,height:Math.round(meta.height * rule.keepTop)});
  }
  if (rule.maxDimension) {
    pipeline = pipeline.resize({
      width: rule.maxDimension,
      height: rule.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  if (rule.format === 'webp') {
    pipeline = pipeline.webp({ quality: rule.quality ?? 85, lossless: rule.lossless ?? false, effort: rule.lossless ? 6 : 4 });
  } else if (rule.format) {
    fail(`unknown image optimization format "${rule.format}" for ${file}`);
  }

  const outputFile = rule.format === 'webp' ? `${baseName}.webp` : file;
  const dest = path.join(looseOutDir, outputFile);
  const encoded = await pipeline.toBuffer();
  // Pure lossless optimization must not grow files; explicit framing crops must always apply.
  if (rule.lossless && !rule.keepTop && (ext !== '.png' || encoded.length >= originalSize)) {
    copyFileSync(src, path.join(looseOutDir, file));
    return { outputFile: file, originalSize, outputSize: originalSize };
  }
  writeFileSync(dest, encoded);
  const outputSize = statSync(dest).size;
  return { outputFile, originalSize, outputSize };
}

if (existsSync(looseSrcDir)) {
  mkdirSync(looseOutDir, { recursive: true });
  const looseFiles = readdirSync(looseSrcDir).filter((f) =>
    statSync(path.join(looseSrcDir, f)).isFile()
  );
  const rules = IMAGE_OPTIMIZATION_RULES[name];
  const mirrors = name === 'punchies'
    ? await (await import('../prototypes/punchies/art/mirror-parts.mjs')).default(assetsSrcDir)
    : {};

  let totalBefore = 0;
  let totalAfter = 0;
  for (const file of looseFiles) {
    if (name === 'punchies' && /^(portrait|part)_(marco|mia|bruno)_alt(?:_|$)/.test(path.parse(file).name)) continue;
    if (mirrors[path.parse(file).name]) {
      totalBefore += statSync(path.join(looseSrcDir, file)).size;
      continue;
    }
    const { outputFile, originalSize, outputSize } = await processLooseFile(file, rules);
    totalBefore += originalSize;
    totalAfter += outputSize;
    addToManifest(`loose/${outputFile}`, path.join(looseOutDir, outputFile));
  }
  if (Object.keys(mirrors).length) {
    const file = path.join(looseOutDir, 'part-mirrors.json');
    writeFileSync(file, JSON.stringify(mirrors));
    addToManifest('loose/part-mirrors.json', file);
    console.log(`pack-assets: derive ${Object.keys(mirrors).length} mirrored parts in code`);
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
