// Browser verification for the playable. Serves dist/ (run the build first),
// drives the real page with taps on the on-screen buttons, checks scoring,
// damage, both end conditions and console errors, and writes screenshots.
//   node prototypes/punchies-playable/scripts/verify.mjs
// Env: PLAYWRIGHT_MODULE (path to playwright), SCREENSHOT_DIR, EXPECT_NO_ART=1.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
const shots = process.env.SCREENSHOT_DIR || path.resolve(here, '../screenshots');
fs.mkdirSync(shots, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(dist) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

async function load(query) {
  await page.goto(`${base}?test=1&seed=5${query}`);
  await page.waitForFunction(() => window.__playable);
  await page.waitForTimeout(300);
}
// Logical (360x640) -> page coordinates of the canvas.
const tap = async (lx, ly) => {
  const b = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; });
  const k = b.w / 360;
  await page.touchscreen.tap(b.x + lx * k, b.y + ly * k);
};
const JAB = [90, 588], CROSS = [270, 588];
const st = () => page.evaluate(() => { const s = window.__playable.state(); return { score: s.score, hp: s.hp, frame: s.frame, ended: s.ended, enemies: s.enemies.length }; });
// Fresh run with no automatic spawns and one parked enemy at distance d.
async function arrange(d, windup = 99999) {
  await page.evaluate(({ d, windup }) => {
    const p = window.__playable;
    p.tune.run.firstSpawnSec = 9999; p.tune.enemy.walkSpeed = 0; p.tune.enemy.windupFrames = windup;
    p.restart();
    p.state().enemies.push({ id: 99, d, state: 'windup', frame: 0, side: 1 });
  }, { d, windup });
}
// Wait for the sim itself (not wall time: headless rendering can be slow).
const settle = (frames = 70) => page.waitForFunction((n) => window.__playable.state().frame >= n, frames, { timeout: 30000 });

await load('');
const hasArt = await page.evaluate(() => window.__playable.scene.textures.exists('marco'));
check(process.env.EXPECT_NO_ART ? 'placeholder build has no art' : 'sprite art loaded', hasArt === !process.env.EXPECT_NO_ART);
check('canvas buffer follows devicePixelRatio', await page.evaluate(() => document.querySelector('canvas').width) === 720);

// Scoring through real taps.
await arrange(80); await tap(...JAB); await settle();
let s = await st(); check('tap JAB at head range scores 2', s.score === 2 && s.hp === 3, JSON.stringify(s));
await arrange(100); await tap(...JAB); await settle();
s = await st(); check('tap JAB at body range scores 1', s.score === 1, JSON.stringify(s));
await arrange(110); await tap(...CROSS); await settle();
s = await st(); check('tap CROSS at head range scores 2', s.score === 2, JSON.stringify(s));
await arrange(122); await tap(...CROSS); await settle();
s = await st(); check('tap CROSS at body range scores 1', s.score === 1, JSON.stringify(s));

// Sour hit then the enemy punches for 1 damage.
await arrange(80, 12); await tap(...CROSS); await settle(80);
s = await st(); check('sour CROSS scores 0 and enemy hits for 1', s.score === 0 && s.hp === 2, JSON.stringify(s));
// Doing nothing: enemy punches for 1.
await arrange(80, 12); await settle(80);
s = await st(); check('no input costs 1 HP', s.score === 0 && s.hp === 2, JSON.stringify(s));
// Keyboard binding goes through the same intents.
await arrange(80); await page.keyboard.press('KeyJ'); await settle();
s = await st(); check('keyboard J jab scores 2', s.score === 2, JSON.stringify(s));

// Mid-run screenshot with enemies in the lane.
await page.evaluate(() => { const p = window.__playable; p.tune.run.firstSpawnSec = 0.2; p.tune.enemy.walkSpeed = 150; p.tune.enemy.windupFrames = 20; p.restart(); p.advance(150); });
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(shots, 'game.png') });

// 3 HP ends the run early.
await page.evaluate(() => { const p = window.__playable; p.tune.run.firstSpawnSec = 0.2; p.tune.enemy.walkSpeed = 150; p.restart(); });
await page.evaluate(() => window.__playable.advance(900));
await page.waitForTimeout(1200);
s = await st(); check('3 HP lost ends the run early', s.ended === 'dead' && s.hp === 0 && s.frame < 1800, JSON.stringify(s));
await page.screenshot({ path: path.join(shots, 'end-ko.png') });

// 30 s timer ends the run (fast forwarded), then the end screen with the CTA.
await page.evaluate(() => { const p = window.__playable; p.tune.run.playerHp = 99; p.restart(); p.advance(1800); });
await page.waitForTimeout(1200);
s = await st(); check('30 s ends the run', s.ended === 'time' && s.frame === 1800, JSON.stringify(s));
await page.screenshot({ path: path.join(shots, 'end-time.png') });
await tap(180, 470); await page.waitForTimeout(200);
check('CTA tap does nothing (no navigation)', page.url().startsWith(base));

// Debug panel hidden by default, shown with ?debug=1.
check('debug panel hidden by default', await page.evaluate(() => !document.querySelector('.tp-dfwv')));
await page.goto(`${base}?debug=1`); await page.waitForTimeout(1200);
check('debug panel shown with ?debug=1', await page.evaluate(() => !!document.querySelector('.tp-dfwv')));
await page.screenshot({ path: path.join(shots, 'debug.png') });
await page.goto(`${base}?debug=0`); await page.waitForTimeout(600);
check('?debug=0 hides it again', await page.evaluate(() => !document.querySelector('.tp-dfwv')));

check('no console or page errors', errors.length === 0, errors.join(' | '));
await browser.close();
server.close();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
