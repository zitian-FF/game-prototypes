// Visual check for Dice Dig. Usage:
//   node scripts/screenshot-dice-dig.mjs <baseUrl> <outDir>
// baseUrl is a running dev/preview server, e.g. http://localhost:5199/game-prototypes/prototypes/digger/
// Plays real taps on the canvas, fails on any console error, and writes one
// screenshot per skin plus a side-by-side style sheet.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwright = require('playwright');
const { chromium } = playwright;

const base = process.argv[2];
const outDir = process.argv[3];
if (!base || !outDir) {
  console.error('usage: node scripts/screenshot-dice-dig.mjs <baseUrl> <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const shots = [];
for (const skin of ['pastel', 'bevel', 'flat', 'iso']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${skin}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${skin}] ${e.message}`));
  await page.goto(`${base}?skin=${skin}&seed=11&tool=hammer`);
  await page.waitForTimeout(800);
  // Roll with the hammer a few times, then pause mid-board.
  for (let i = 0; i < 3; i++) {
    await page.mouse.click(195, 784);
    await page.waitForTimeout(1700);
  }
  const file = path.join(outDir, `dice-dig-${skin}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
  await ctx.close();
}

const sheet = await browser.newPage({ viewport: { width: 390 * 4 + 50, height: 844 + 20 } });
const imgs = shots.map((f) => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:390px;height:844px;margin:10px 0 0 10px">`);
await sheet.setContent(`<body style="margin:0;background:#000;display:flex">${imgs.join('')}</body>`);
await sheet.screenshot({ path: path.join(outDir, 'dice-dig-style-sheet.png') });
await browser.close();

if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ok, no console errors. wrote', outDir);
