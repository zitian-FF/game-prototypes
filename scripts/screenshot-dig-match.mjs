// Visual check for Dig Match. Usage:
//   node scripts/screenshot-dig-match.mjs <baseUrl> <outDir>
// baseUrl is a running dev/preview server, e.g. http://localhost:5199/game-prototypes/prototypes/dig-match/
// Plays real drag-swaps on the canvas (moves come from the ?test=1 test hook),
// fails on any console error, and writes screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2];
const outDir = process.argv[3];
if (!base || !outDir) {
  console.error('usage: node scripts/screenshot-dig-match.mjs <baseUrl> <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?test=1&seed=5`);
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(outDir, 'dig-match-start.png') });

const play = async (n) => {
  for (let i = 0; i < n; i++) {
    const mv = await page.evaluate(() => window.__digMatch.validMove());
    if (!mv) throw new Error('no valid move found');
    await page.mouse.move(mv.a.x, mv.a.y);
    await page.mouse.down();
    await page.mouse.move(mv.b.x, mv.b.y, { steps: 4 });
    await page.mouse.up();
    for (let t = 0; t < 40 && (await page.evaluate(() => window.__digMatch.busy())); t++) await page.waitForTimeout(150);
  }
};
await play(6);
// Mid-play shot: start a move and capture while blocks are popping.
const mv = await page.evaluate(() => window.__digMatch.validMove());
await page.mouse.move(mv.a.x, mv.a.y);
await page.mouse.down();
await page.mouse.move(mv.b.x, mv.b.y, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(330);
await page.screenshot({ path: path.join(outDir, 'dig-match-mid.png') });
for (let t = 0; t < 40 && (await page.evaluate(() => window.__digMatch.busy())); t++) await page.waitForTimeout(150);
await play(20);
await page.screenshot({ path: path.join(outDir, 'dig-match-later.png') });
const cleared = await page.evaluate(() => window.__digMatch.cleared());
await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ok, no console errors. blocks cleared:', cleared);
