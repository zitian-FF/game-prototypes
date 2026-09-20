#!/usr/bin/env node
// Downloads <name>_assets.zip from the R2 art bucket and extracts it into
// prototypes/<name>/assets-src/. Caches by the response ETag (never by
// filename) so unchanged art is not re-downloaded.
//
// Pass --merge (after the object-name override) to extract a supplementary
// package on top of an existing assets-src/ instead of replacing it - for
// a named, versioned content drop (e.g. suits-mp_landing_ui_assets_v001.zip)
// that adds a handful of loose/ files to a prototype whose main
// <name>_assets.zip already has its own separate content. Default (no
// --merge) behavior, used by every prototype's primary fetch, is unchanged:
// assets-src/ is wiped and replaced wholesale.
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

// Optional 3rd arg overrides the R2 object name for a prototype whose art
// was uploaded under a name that doesn't match "<name>_assets.zip".
// Optional --merge flag (see this file's header comment) switches from
// replace-wholesale to extract-on-top-of-existing.
const rawArgs = process.argv.slice(3);
const merge = rawArgs.includes('--merge');
const zipObjectName = rawArgs.find((a) => a !== '--merge') || `${name}_assets.zip`;
const zipUrl = `${BUCKET_URL}/${zipObjectName}`;

const cacheDir = path.join(rootDir, '.cache');
// Cache key is the actual object being fetched, not just the prototype
// name - a merge-mode fetch of a supplementary package must not collide
// with (or be mistaken for) the prototype's own primary-zip cache entry.
const etagFile = path.join(cacheDir, `${zipObjectName.replace(/[^a-zA-Z0-9_.-]/g, '_')}.etag`);
const assetsSrcDir = path.join(protoDir, 'assets-src');
const packedDir = path.join(assetsSrcDir, 'packed');
const looseDir = path.join(assetsSrcDir, 'loose');

mkdirSync(cacheDir, { recursive: true });

const previousEtag = existsSync(etagFile) ? readFileSync(etagFile, 'utf8').trim() : null;

console.log(`fetch-assets: fetching ${zipUrl}`);

let response;
try {
  response = await fetch(zipUrl);
} catch (err) {
  fail(`network error fetching ${zipUrl}: ${err.message}`);
}

if (!response.ok) {
  if (response.status === 404) {
    fail(
      `no asset zip found at ${zipUrl} (404 Not Found).\n\n` +
        `This usually means the file hasn't been uploaded to R2 yet, or is\n` +
        `named differently than expected.\n\n` +
        `Expected naming convention: <name>_assets.zip (underscore, not\n` +
        `hyphen). For this prototype, that's: ${zipObjectName}\n\n` +
        `Upload it to the public bucket:\n${BUCKET_URL}\n\n` +
        `If the zip is intentionally named differently, pass the actual\n` +
        `object name as a third argument:\n` +
        `npm run fetch:assets ${name} <actual-object-name>.zip`,
    );
  }
  fail(`request failed with ${response.status} ${response.statusText} for ${zipUrl}`);
}

const etag = response.headers.get('etag');
// In merge mode, this object's own etag file (keyed above by zipObjectName)
// only exists once *this* package has actually been merged in before - so
// the etag match alone is enough, unlike the default wholesale-replace
// mode's extra guard against etag-says-fetched-but-directory-missing.
const haveExtracted = merge || existsSync(packedDir) || existsSync(looseDir);

if (etag && previousEtag === etag && haveExtracted) {
  console.log(`fetch-assets: ${zipObjectName} unchanged (ETag ${etag}), skipping download`);
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

if (!merge) {
  rmSync(assetsSrcDir, { recursive: true, force: true });
}
mkdirSync(assetsSrcDir, { recursive: true });

try {
  // `true` = overwrite - in merge mode this lets a re-fetch of the same
  // package update files in place; it never touches files the zip doesn't
  // contain, so the rest of assets-src/ (from the prototype's primary zip)
  // is left alone.
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

console.log(`fetch-assets: extracted ${zipObjectName} into ${path.relative(rootDir, assetsSrcDir)}`);
