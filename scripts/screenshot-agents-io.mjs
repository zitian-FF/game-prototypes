// Visual + interaction check for agents.io. Usage:
//   node scripts/screenshot-agents-io.mjs <baseUrl> <outDir>
// baseUrl is a running dev/preview server, e.g. http://localhost:5199/game-prototypes/prototypes/agents-io/
// Landscape desktop build (1280x720). Plays level 1 with real mouse input (click a slot, click a
// model, click words, drag to wire), runs the batch twice back to back (no wallet, so retries are
// instant), checks the result, reloads to check the save, fails on any console error.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2];
const outDir = process.argv[3];
if (!base || !outDir) {
  console.error('usage: node scripts/screenshot-agents-io.mjs <baseUrl> <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?test=1`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(900);

const shot = (name) => page.screenshot({ path: path.join(outDir, `agents-io-${name}.png`) });
const state = () => page.evaluate(() => window.__agents.state());
// Logical (390x844) position of a named control -> page pixels.
const pt = async (name) =>
  page.evaluate((n) => {
    const a = window.__agents;
    const p = a.at(n);
    if (!p) return null;
    const r = a.rect();
    const s = a.size();
    return { x: r.left + (p.x / s.w) * r.width, y: r.top + (p.y / s.h) * r.height };
  }, name);
const tap = async (name) => {
  const p = await pt(name);
  if (!p) throw new Error(`no target ${name}`);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(120);
};
const drag = async (a, b) => {
  const p = await pt(a);
  const q = await pt(b);
  if (!p || !q) throw new Error(`no target ${a} or ${b}`);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move((p.x + q.x) / 2, (p.y + q.y) / 2, { steps: 4 });
  await page.mouse.move(q.x, q.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
};

await shot('1-start');
await tap('s0');
await page.waitForTimeout(120);
await shot('2-picker');
await tap('model:scribe');
await tap('word:formal');
await tap('s1');
await tap('model:scribe');
await tap('word:apologize');
await shot('3-built');
// Wrong wire first: an agent to INPUT must be refused.
await drag('s0', 'in');
await drag('in', 's0');
await drag('in', 's1');
await drag('s0', 'out');
await drag('s1', 'out');
await tap('s0');
await shot('4-wired');
let st = await state();
console.log('edges', JSON.stringify(st.layout.edges), 'block', JSON.stringify(st.block));
if (st.layout.edges.length !== 4) throw new Error('expected 4 wires');

await tap('run');
await page.waitForTimeout(1100);
await shot('5-running');
await page.waitForFunction(() => !!window.__agents.state().result, null, { timeout: 15000 });
await page.waitForTimeout(300);
st = await state();
console.log('result', JSON.stringify(st.result));
await shot('6-result');
if (!st.result || st.result.stars < 1) throw new Error('level 1 should earn a star');

// Retry straight away: close the result and run again with no waiting.
await tap('tweak');
await page.waitForTimeout(200);
st = await state();
if (st.block) throw new Error('run should be available immediately, got: ' + st.block);
await tap('run');
await page.waitForFunction(() => !!window.__agents.state().result, null, { timeout: 15000 });
await page.waitForTimeout(250);
console.log('second run ok', JSON.stringify((await state()).result));
await page.waitForTimeout(100);

await tap('next');
await page.waitForTimeout(300);
st = await state();
console.log('after next level', st.level, 'unlocked', st.unlocked);
await shot('7-level2');
await tap('s0');
await tap('model:lens');
await tap('word:extract');
await shot('8-level2-lens');

// Persistence: the layout, best result and wallet survive a reload.
await page.reload();
await page.waitForTimeout(900);
const after = await state();
console.log('after reload: level', after.level, 'best', JSON.stringify(after.best), 'nodes', Object.keys(after.layout.nodes));
await shot('9-reloaded');
await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ok, no console errors');
