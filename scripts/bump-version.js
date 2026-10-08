#!/usr/bin/env node
// Increments the deploy counter in prototypes/<name>/version.json by one.
// Called once per successful deploy by a versioned prototype's itch.io
// workflow, which commits the updated file back to main. Prototypes with a
// documented version-stamp exception do not call this script.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`bump-version: ${message}`);
  process.exit(1);
}

const name = process.argv[2];
if (!name) {
  fail('missing prototype name. Usage: node scripts/bump-version.js <name>');
}

const versionFile = path.join(rootDir, 'prototypes', name, 'version.json');
if (!existsSync(versionFile)) {
  fail(`${path.relative(rootDir, versionFile)} not found`);
}

const data = JSON.parse(readFileSync(versionFile, 'utf8'));
data.counter = (data.counter ?? -1) + 1;
writeFileSync(versionFile, `${JSON.stringify(data, null, 2)}\n`);
console.log(`bump-version: ${name} counter -> ${data.counter}`);
