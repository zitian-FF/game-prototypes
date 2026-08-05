#!/usr/bin/env node
// Atlas-packs prototypes/<name>/assets-src/packed/ with free-tex-packer-cli
// (one animation key per subfolder), copies assets-src/loose/ through
// untouched, and writes a derived animation config plus a content-hash
// manifest into public/prototypes/<name>/assets/.
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

if (existsSync(packedSrcDir)) {
  const animKeys = readdirSync(packedSrcDir)
    .filter((entry) => statSync(path.join(packedSrcDir, entry)).isDirectory())
    .sort();

  if (animKeys.length === 0) {
    fail(`no animation folders found under ${path.relative(rootDir, packedSrcDir)}`);
  }

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

// --- Copy loose assets through untouched ---
if (existsSync(looseSrcDir)) {
  mkdirSync(looseOutDir, { recursive: true });
  const looseFiles = readdirSync(looseSrcDir).filter((f) =>
    statSync(path.join(looseSrcDir, f)).isFile()
  );

  for (const file of looseFiles) {
    const src = path.join(looseSrcDir, file);
    const dest = path.join(looseOutDir, file);
    copyFileSync(src, dest);
    addToManifest(`loose/${file}`, dest);
  }
} else {
  console.log('pack-assets: no loose/ folder in assets-src, skipping loose copy');
}

const manifestPath = path.join(outDir, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`pack-assets: wrote ${manifest.length} file(s) to ${path.relative(rootDir, outDir)}`);
