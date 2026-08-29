#!/usr/bin/env node
// Downloads <name>_assets.zip from the R2 art bucket and extracts it into
// prototypes/<name>/assets-src/. Caches by the response ETag (never by
// filename) so unchanged art is not re-downloaded.
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const BUCKET_URL = 'https://pub-415572b047994ab8807f76b8462eda45.r2.dev';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`fetch-assets: ${message}`);
  process.exit(1);
}

const name = process.argv[2];
if (!name) {
  fail('missing prototype name. Usage: npm run fetch:assets <name>');
}

const protoDir = path.join(rootDir, 'prototypes', name);
if (!existsSync(protoDir)) {
  fail(`prototype "${name}" does not exist at ${path.relative(rootDir, protoDir)}`);
}

const cacheDir = path.join(rootDir, '.cache');
const etagFile = path.join(cacheDir, `${name}.etag`);
const assetsSrcDir = path.join(protoDir, 'assets-src');
const packedDir = path.join(assetsSrcDir, 'packed');
const looseDir = path.join(assetsSrcDir, 'loose');

mkdirSync(cacheDir, { recursive: true });

const previousEtag = existsSync(etagFile) ? readFileSync(etagFile, 'utf8').trim() : null;
// Optional 3rd arg overrides the R2 object name for prototypes whose art
// was uploaded under a name that doesn't match "<name>_assets.zip" (e.g.
// suits-mp's card art, uploaded as "Suits-of-Madness_assets.zip").
const zipObjectName = process.argv[3] || `${name}_assets.zip`;
const zipUrl = `${BUCKET_URL}/${zipObjectName}`;

console.log(`fetch-assets: fetching ${zipUrl}`);

let response;
try {
  response = await fetch(zipUrl);
} catch (err) {
  fail(`network error fetching ${zipUrl}: ${err.message}`);
}

if (!response.ok) {
  fail(`request failed with ${response.status} ${response.statusText} for ${zipUrl}`);
}

const etag = response.headers.get('etag');
const haveExtracted = existsSync(packedDir) || existsSync(looseDir);

if (etag && previousEtag === etag && haveExtracted) {
  console.log(`fetch-assets: ${name} art unchanged (ETag ${etag}), skipping download`);
  process.exit(0);
}

const buffer = Buffer.from(await response.arrayBuffer());

let zip;
try {
  zip = new AdmZip(buffer);
} catch (err) {
  fail(`downloaded file from ${zipUrl} is not a valid zip: ${err.message}`);
}

const entries = zip.getEntries();
if (entries.length === 0) {
  fail(`zip from ${zipUrl} is empty`);
}

rmSync(assetsSrcDir, { recursive: true, force: true });
mkdirSync(assetsSrcDir, { recursive: true });

try {
  zip.extractAllTo(assetsSrcDir, true);
} catch (err) {
  fail(`failed to extract zip: ${err.message}`);
}

// The zip may wrap packed/ and loose/ in a single top-level folder (e.g.
// "<name>/packed/..."). Flatten that one level so assets-src/packed and
// assets-src/loose always exist directly under assets-src/.
if (!existsSync(packedDir) && !existsSync(looseDir)) {
  const topEntries = readdirSync(assetsSrcDir).filter((entry) =>
    statSync(path.join(assetsSrcDir, entry)).isDirectory()
  );

  if (topEntries.length === 1) {
    const wrapperDir = path.join(assetsSrcDir, topEntries[0]);
    const wrapperPacked = path.join(wrapperDir, 'packed');
    const wrapperLoose = path.join(wrapperDir, 'loose');

    if (existsSync(wrapperPacked) || existsSync(wrapperLoose)) {
      for (const child of readdirSync(wrapperDir)) {
        renameSync(path.join(wrapperDir, child), path.join(assetsSrcDir, child));
      }
      rmSync(wrapperDir, { recursive: true, force: true });
    }
  }
}

if (!existsSync(packedDir) && !existsSync(looseDir)) {
  fail(`extracted zip has neither packed/ nor loose/ (checked top level and one nested level)`);
}

if (etag) {
  writeFileSync(etagFile, etag);
}

console.log(`fetch-assets: extracted ${name}_assets.zip into ${path.relative(rootDir, assetsSrcDir)}`);
