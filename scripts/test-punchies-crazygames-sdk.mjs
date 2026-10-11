// Runs the CrazyGames build (dev server started with PORTAL=crazygames) against the real
// CrazyGames SDK v3 in its local demo mode. Usage:
//   PORTAL=crazygames npx vite --port 5199 &
//   node scripts/test-punchies-crazygames-sdk.mjs [http://localhost:5199/game-prototypes/prototypes/punchies/]
// Set CG_SDK_FILE to a downloaded copy of the SDK if the browser cannot reach sdk.crazygames.com.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5199/game-prototypes/prototypes/punchies/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
if (process.env.CG_SDK_FILE) {
  await page.route('https://sdk.crazygames.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.CG_SDK_FILE) }));
}
const sdkLog = [];
page.on('console', (m) => sdkLog.push(m.text()));
await page.goto(url); await page.waitForTimeout(4000);
const has = (re) => sdkLog.some((l) => re.test(l));
const env = await page.evaluate(() => window.CrazyGames?.SDK?.environment);
assert.ok(env, 'SDK loaded');
assert.ok(has(/CrazyGames HTML SDK initialized/), 'SDK init completed');
assert.ok(has(/Requesting game loading start/), 'loadingStart reached the SDK');
assert.ok(has(/Requesting game loading stop/), 'loadingStop reached the SDK once the first menu was up');
assert.ok(has(/(Get|Set) "punchies:/), 'saves go through the SDK data module');
console.log('environment:', env);
const real = errors.filter((e) => !/404/.test(e));
assert.deepEqual(real, [], 'no console errors: ' + real.join(' | '));
await browser.close();
console.log('PASS: CrazyGames build loads the real SDK, reports loading, and runs without console errors');
