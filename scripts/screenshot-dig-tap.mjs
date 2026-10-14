// Visual check for Dig Tap. Usage:
//   node scripts/screenshot-dig-tap.mjs <baseUrl> <outDir>
// baseUrl is a running dev/preview server, e.g. http://localhost:5199/game-prototypes/prototypes/dig-tap/
// Taps real blocks on the canvas (positions come from the ?test=1 hook), buys an
// upgrade, reloads to check the save, fails on any console error.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2];
const outDir = process.argv[3];
if (!base || !outDir) {
  console.error('usage: node scripts/screenshot-dig-tap.mjs <baseUrl> <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?test=1`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(outDir, 'dig-tap-start.png') });

const tap = async (n, wait = 120, kind = 'dirt') => {
  for (let i = 0; i < n; i++) {
    const t = await page.evaluate((k) => window.__digTap.target(k), kind);
    if (!t) break;
    await page.mouse.click(t.x, t.y);
    await page.waitForTimeout(wait);
  }
};
await tap(3);
await page.screenshot({ path: path.join(outDir, 'dig-tap-cracking.png') });
await tap(80);
await page.waitForTimeout(1500);
const kinds = await page.evaluate(() => window.__digTap.kinds());
console.log('kinds in view', kinds);
// Tap a rock (should refuse), then a TNT block if one is in view.
await tap(2, 150, 'rock');
await page.screenshot({ path: path.join(outDir, 'dig-tap-rock.png') });
await tap(2, 90, 'tnt');
await page.waitForTimeout(160);
await page.screenshot({ path: path.join(outDir, 'dig-tap-tnt.png') });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDir, 'dig-tap-later.png') });
const before = await page.evaluate(() => ({ gems: window.__digTap.gems(), dug: window.__digTap.dug() }));
// Buy the first upgrade with granted gems, then check the save survives a reload.
await page.evaluate(() => window.__digTap.grant(50));
await page.mouse.click(57, 757);
await page.waitForTimeout(600);
await page.waitForTimeout(500);
await page.reload();
await page.waitForTimeout(1200);
const after = await page.evaluate(() => ({ gems: window.__digTap.gems(), dug: window.__digTap.dug() }));
await page.screenshot({ path: path.join(outDir, 'dig-tap-reloaded.png') });
await browser.close();
console.log('before reload', before, 'after reload', after);
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ok, no console errors');
