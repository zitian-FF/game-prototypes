// Browser verification for the playable. Serves dist/ (run the build first),
// drives the real page with taps on the on-screen buttons, checks scoring,
// damage, both end conditions and console errors, and writes screenshots.
//   node prototypes/punchies-playable/scripts/verify.mjs
// Env: PLAYWRIGHT_MODULE (path to playwright), BRAVE_PATH, SCREENSHOT_DIR, EXPECT_NO_ART=1.
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
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const p = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(dist) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };
const errors = [];

const launchOptions = process.env.BRAVE_PATH ? { executablePath: process.env.BRAVE_PATH } : {};
const browser = await chromium.launch(launchOptions);
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
    p.tune.run.zombieCount = 0; p.tune.enemy.walkSpeed = 0; p.tune.enemy.windupFrames = windup;
    p.restart();
    p.state().enemies.push({ id: 99, d, ang: 0, hp: 4, speed: 0, hurt: 0, state: 'windup', frame: 0, side: 1 });
  }, { d, windup });
}
// Wait for the sim itself (not wall time: headless rendering can be slow).
const settle = (frames = 70) => page.waitForFunction((n) => window.__playable.state().frame >= n, frames, { timeout: 30000 });

await load('');
const hasArt = await page.evaluate(() => window.__playable.scene.artLoaded);
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

// Two jab taps defeat a 4 HP zombie (2 damage each); the first one only staggers it.
await arrange(80); await tap(...JAB);
await page.waitForFunction(() => window.__playable.state().frame >= 45);
const mid = await page.evaluate(() => { const e = window.__playable.state().enemies[0]; return { hp: e.hp, state: e.state }; });
check('first jab leaves the zombie at 2 HP, still up', mid.hp === 2 && mid.state !== 'knocked', JSON.stringify(mid));
await tap(...JAB); await settle(140);
s = await st(); check('second jab defeats it (2 + 1 points) and it is gone', s.score === 3 && s.enemies === 0, JSON.stringify(s));

// Player hit look: red tint on Marco and a red edge vignette (captured right after the hit lands).
await arrange(80, 12);
await page.evaluate(() => { const p = window.__playable; p.pause(true); p.advance(19); const sc = p.scene; sc.tweens.killAll(); sc.hurtEdge.setAlpha(1); sc.player.flash(0xff6a6a, performance.now(), 60000, false); p.advance(0); });
await page.screenshot({ path: path.join(shots, 'hit.png') });
await page.evaluate(() => window.__playable.pause(false));

// Action shot: a jab at full extension against a parked zombie, and one knocked off.
await arrange(80);
await page.evaluate(() => { const p = window.__playable; p.pause(true); p.advance(1, { jab: true }); p.advance(10); });
await page.screenshot({ path: path.join(shots, 'action.png') });
await page.evaluate(() => window.__playable.advance(8));
await page.screenshot({ path: path.join(shots, 'knock.png') });
await page.evaluate(() => window.__playable.pause(false));

// Diagonal knock-off: the zombie flies along the blow direction, spins and fades.
await arrange(110);
await page.evaluate(() => { const p = window.__playable; p.state().enemies[0].ang = 0.38; p.pause(true); p.advance(1, { cross: true }); p.advance(24); });
await page.screenshot({ path: path.join(shots, 'knock-angle-flight.png') });
await page.evaluate(() => window.__playable.advance(19));
await page.screenshot({ path: path.join(shots, 'knock-angle-fade.png') });
const gone = await page.evaluate(() => { const p = window.__playable; p.advance(30); return p.state().enemies.length; });
check('knocked zombie is removed after the fade', gone === 0, `enemies left ${gone}`);
await page.evaluate(() => window.__playable.pause(false));

// Mid-run screenshot with enemies in the lane.
await page.evaluate(() => { const p = window.__playable; p.tune.run.zombieCount = 12; p.tune.run.playerHp = 99; p.tune.enemy.walkSpeed = 150; p.tune.enemy.windupFrames = 20; p.restart(); p.advance(300); });
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(shots, 'game.png') });

// 3 HP ends the run early.
await page.evaluate(() => { const p = window.__playable; p.tune.run.zombieCount = 12; p.tune.run.playerHp = 3; p.tune.enemy.walkSpeed = 150; p.restart(); });
await page.evaluate(() => window.__playable.advance(900));
await page.waitForTimeout(1200);
s = await st(); check('3 HP lost ends the run early', s.ended === 'dead' && s.hp === 0 && s.frame < 1800, JSON.stringify(s));
await page.screenshot({ path: path.join(shots, 'end-ko.png') });

// 30 s timer ends the run (fast forwarded), then the end screen with the CTA.
await page.evaluate(() => { const p = window.__playable; p.tune.run.playerHp = 99; p.restart(); p.advance(1800); });
await page.waitForTimeout(1200);
s = await st(); check('30 s ends the run', s.ended === 'time' && s.frame === 1800, JSON.stringify(s));
await page.screenshot({ path: path.join(shots, 'end-time.png') });
await tap(180, 410); await page.waitForTimeout(200);
check('CTA tap does nothing (no navigation)', page.url().startsWith(base));
// Retry (testing build): tapping RETRY starts a fresh run.
await page.screenshot({ path: path.join(shots, 'end-time-retry.png') });
await tap(180, 513); await page.waitForTimeout(300);
s = await st(); check('RETRY starts a fresh run', s.ended === null && s.score === 0 && s.hp === 99 && s.frame < 120, JSON.stringify(s));
// ?retry=0 leaves the button out.
await load('&retry=0');
check('?retry=0 hides the retry button', await page.evaluate(() => window.__playable.scene.retryEnabled === false));

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
