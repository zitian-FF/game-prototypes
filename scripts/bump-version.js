#!/usr/bin/env node
// Increments the deploy counter in prototypes/<name>/version.json by one.
// Called once per successful deploy by that prototype's itch.io workflow
// (see .github/workflows/deploy-mp-base-itch.yml), which commits the
// updated file back to main. scripts/generate-versions.js then picks up the
// new value on the next build.
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
