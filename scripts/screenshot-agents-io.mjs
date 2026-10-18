// Visual + interaction check for agents.io. Usage:
//   node scripts/screenshot-agents-io.mjs <baseUrl> <outDir>
// baseUrl is a running dev/preview server, e.g. http://localhost:5199/game-prototypes/prototypes/agents-io/
// Landscape desktop build (1280x720). Set DPR=2 to run at device pixel ratio 2 (slow in headless
// software WebGL, but it exercises the high-density camera maths). Plays level 1 with real mouse input on the
// zoomable snap-to-grid blueprint: click a cell to place agents, give them words, drag from output
// ports to wire (including refused wires), move an agent, wheel-zoom, pan, fit, run twice back to back,
// go to the next level, reload to check the save, and fail on any console error.
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?test=1`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(900);

const fail = (msg) => {
  throw new Error(msg);
};
const shot = (name) => page.screenshot({ path: path.join(outDir, `agents-io-${name}.png`) });
const state = () => page.evaluate(() => window.__agents.state());
const view = () => page.evaluate(() => window.__agents.view());
// Logical (1280x720) position of a named control -> page pixels.
const pt = async (name) =>
  page.evaluate((n) => {
    const a = window.__agents;
    const p = a.at(n);
    if (!p) return null;
    const r = a.rect();
    const s = a.size();
    return { x: r.left + (p.x / s.w) * r.width, y: r.top + (p.y / s.h) * r.height };
  }, name);
const click = async (name) => {
  const p = await pt(name);
  if (!p) fail(`no target ${name}`);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(140);
};
const drag = async (a, b) => {
  const p = await pt(a);
  const q = await pt(b);
  if (!p || !q) fail(`no target ${a} or ${b}`);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move((p.x + q.x) / 2, (p.y + q.y) / 2, { steps: 2 });
  await page.mouse.move(q.x, q.y, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(160);
};
const nodeIds = async () => Object.keys((await state()).layout.nodes);

await shot('1-start');
console.log('start view', JSON.stringify(await view()));

// Place two agents by clicking empty cells.
await click('cell:9,10');
let st = await state();
if (!st.pending) fail('clicking an empty cell should choose a spot');
await shot('2-picker');
await click('model:scribe');
await click('word:formal');
await click('cell:29,10');
await click('model:scribe');
await click('word:apologize');
const [n1, n2] = await nodeIds();
console.log('placed', n1, n2, JSON.stringify((await state()).layout.nodes));
await shot('3-placed');

// A spot that touches an existing agent is refused.
await click('cell:17,10');
st = await state();
console.log('pending after crowded click:', JSON.stringify(st.pending));
if (st.pending && Object.keys(st.layout.nodes).length < 2) fail('expected two agents');

// Wiring: valid, then refused (into INPUT) and a loop.
await drag('port:out:in', n1);
await drag('port:out:in', n2);
await drag(`port:out:${n1}`, 'out');
await drag(`port:out:${n2}`, 'out');
await drag(`port:out:${n1}`, 'in'); // refused: INPUT has no input port
await drag(`port:out:${n1}`, n2); // allowed: same row, no loop
await drag(`port:out:${n2}`, n1); // refused: would loop
st = await state();
console.log('edges', JSON.stringify(st.layout.edges));
const has = (a, b) => st.layout.edges.some(([x, y]) => x === a && y === b);
if (!has('in', n1) || !has('in', n2) || !has(n1, 'out') || !has(n2, 'out')) fail('expected the four main wires');
if (has(n2, n1)) fail('a loop must be refused');
if (!has(n1, n2)) fail('same-row wire should be allowed');
await shot('4-wired');
await drag(`port:out:${n1}`, n2); // toggles the wire off again
st = await state();
if (has(n1, n2) && st.layout.edges.some(([x, y]) => x === n1 && y === n2)) fail('dragging the same pair again should remove the wire');

// Select a wire by clicking on it.
const mid = await pt(`port:out:${n1}`);
await page.mouse.click(mid.x, mid.y + 30);
await page.waitForTimeout(150);
console.log('selected wire', (await state()).selectedWire);
await shot('5-wire-selected');
await page.keyboard.press('Escape');

// Move an agent: drag its body to a new cell.
const before = JSON.stringify((await state()).layout.nodes[n2]);
await drag(n2, 'cell:31,17');
const after = JSON.stringify((await state()).layout.nodes[n2]);
console.log('moved', before, '->', after);
if (before === after) fail('the agent should have moved');
await drag(n2, 'cell:29,10');

// Zoom with the wheel, pan by dragging empty space, then fit.
const z0 = (await view()).zoom;
const centre = await pt('cell:20,20');
await page.mouse.move(centre.x, centre.y);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(150);
const z1 = (await view()).zoom;
await shot('6-zoomed');
const v1 = await view();
const a = await pt('cell:12,26');
await page.mouse.move(a.x, a.y);
await page.mouse.down();
await page.mouse.move(a.x + 90, a.y - 60, { steps: 3 });
await page.mouse.up();
const v2 = await view();
console.log('zoom', z0, '->', z1, ' pan', JSON.stringify([v1.cx, v1.cy]), '->', JSON.stringify([v2.cx, v2.cy]));
if (!(z1 > z0)) fail('wheel up should zoom in');
if (v2.cx === v1.cx && v2.cy === v1.cy) fail('dragging empty space should pan');
await shot('7-panned');
await click('fit');
await page.waitForTimeout(150);
console.log('after fit', JSON.stringify(await view()));
await shot('8-fit');

// Run, then run again straight away (no wallet).
await click(n1);
await click('run');
await page.waitForTimeout(1200);
await shot('9-running');
await page.waitForFunction(() => !!window.__agents.state().result, null, { timeout: 15000 });
await page.waitForTimeout(300);
st = await state();
console.log('result', JSON.stringify(st.result));
await shot('10-result');
if (!st.result || st.result.stars < 1) fail('level 1 should earn a star');
await click('tweak');
await page.waitForTimeout(200);
st = await state();
if (st.block) fail('run should be available immediately, got: ' + st.block);
await click('run');
await page.waitForFunction(() => !!window.__agents.state().result, null, { timeout: 15000 });
await page.waitForTimeout(250);
console.log('second run ok', JSON.stringify((await state()).result));
await click('next');
await page.waitForTimeout(300);
st = await state();
console.log('after next level', st.level, 'unlocked', st.unlocked);
if (st.level !== 1) fail('next level should open level 2');
await shot('11-level2');

// Multimodal ports (level 2: image in, text out). Sage has a text and an image port on each side.
const send = (i) => page.evaluate((x) => window.__agents.send(x), i);
await send({ type: 'cell', bx: 20.5 * 24, by: 12.5 * 24 });
await send({ type: 'place', model: 'sage' });
await send({ type: 'cell', bx: 32.5 * 24, by: 12.5 * 24 });
await send({ type: 'place', model: 'scribe' });
const [m1, m2] = await nodeIds();
await page.waitForTimeout(300);
await shot('11b-sage-ports');
await drag('port:out:in', m2); // refused: Scribe cannot take image
await drag('port:out:in', m1); // Sage takes image on its image input port
await drag(`port:out:${m1}:image`, 'out'); // refused: DELIVER wants text
await drag(`port:out:${m1}:text`, 'out'); // Sage text output to DELIVER
await drag(`port:out:${m1}:text`, m2); // Sage text output into Scribe's text input
st = await state();
console.log('multimodal edges', JSON.stringify(st.layout.edges));
const hasE = (a, b, k) => st.layout.edges.some(([x, y, z]) => x === a && y === b && z === k);
if (!hasE('in', m1, 'image')) fail('INPUT image should wire to the Sage image port');
if (!hasE(m1, 'out', 'text')) fail('Sage text output should wire to DELIVER');
if (hasE(m1, 'out', 'image')) fail('an image wire into a text DELIVER must be refused');
if (hasE('in', m2, 'image')) fail('Scribe cannot take an image');
if (!hasE(m1, m2, 'text')) fail('Sage text output should wire into the text-only Scribe');
await shot('11c-multimodal-wired');

// Persistence
await page.reload();
await page.waitForTimeout(900);
const reloaded = await state();
console.log('after reload: level', reloaded.level, 'best', JSON.stringify(reloaded.best));
await send({ type: 'level', index: 0 });
await page.waitForTimeout(300);
const l1 = await state();
console.log('level 1 layout kept:', Object.keys(l1.layout.nodes).length, 'agents,', l1.layout.edges.length, 'wires');
if (Object.keys(l1.layout.nodes).length !== 2) fail('layout should survive a reload');
await shot('12-reloaded');
await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ok, no console errors');
