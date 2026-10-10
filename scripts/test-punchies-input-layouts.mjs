import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { EventEmitter } from 'node:events';
import { i18nStub } from './lib-i18n-stub.mjs';

const memory = new Map(), KEYS = { localInputs: 'punchies:localInputs:v1' };
const store = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
let pads = [];
const keys = new EventEmitter();
const window = { addEventListener: (k, f) => keys.on(k, f), removeEventListener: (k, f) => keys.off(k, f) };
function load(file, mocks = {}, expose = '') {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`prototypes/punchies/src/${file}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText + expose,
    { exports, require: id => mocks[id] ?? {}, window, navigator: { getGamepads: () => pads }, structuredClone, console });
  return exports;
}
const tune = JSON.parse(fs.readFileSync('prototypes/punchies/tune.json', 'utf8'));
const layouts = load('input/layouts', { '../portal/store': { store }, '../portal/keys': { KEYS }, '../sim/tune': { tune } });
const { defaults, loadLayouts, saveLayouts, validateLayouts, assignBinding, LayoutDraft, PadCapture, resolveTouch, hitTouch, touchValid } = layouts;
const view = { left: 0, top: 0, width: 844, height: 390, cx: 422, cy: 195 };
const plain = value => JSON.parse(JSON.stringify(value));
const equal = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);
const local = load('input/localSetup', { '../portal/store': { store }, '../portal/keys': { KEYS }, './layouts': layouts });
memory.set(KEYS.localInputs, JSON.stringify({ p1: 'touch', p2: 'pad2' }));
equal(loadLayouts(), defaults(), 'legacy saves retain every default and alternate');
const custom = defaults(); custom.kb1.jab = ['KeyQ']; custom.kb2.guard = ['ControlRight']; custom.pad2.guard = [10];
saveLayouts(custom); local.saveLocalInputs({ p1: 'kb1', p2: 'pad2' });
equal(loadLayouts(), custom, 'device picks do not overwrite mappings');
equal(local.loadLocalInputs(), { p1: 'kb1', p2: 'pad2' });
const reloaded = load('input/layouts', { '../portal/store': { store }, '../portal/keys': { KEYS }, '../sim/tune': { tune } });
equal(reloaded.loadLayouts(), custom, 'reload uses the portal store');
assert.equal(assignBinding(custom.kb1, 'cross', 'KeyQ'), 'duplicate');
equal(custom.kb1.cross, ['KeyK'], 'duplicate leaves other action intact');
for (const raw of [null, [], 7, 'bad', { kb1: { jab: ['Escape'] } }, { touch: { main: { x: -10, y: Infinity } } }]) assert.doesNotThrow(() => validateLayouts(raw));
const damaged = plain(custom); damaged.kb1.cross = ['KeyQ']; damaged.touch.main.x = 2;
const repaired = validateLayouts(damaged);
equal(repaired.kb1, defaults().kb1); equal(repaired.kb2, custom.kb2); equal(repaired.pad2, custom.pad2); equal(repaired.touch, defaults().touch);
for (const raw of ['{', 'null', '[]', 'true']) { memory.set(KEYS.localInputs, raw); equal(loadLayouts(), defaults()); assert.doesNotThrow(local.loadLocalInputs); }
local.saveLocalInputs({ p1: 'pad1', p2: 'pad1' }); assert.notEqual(local.loadLocalInputs().p1, local.loadLocalInputs().p2);
saveLayouts(custom);
const cancelled = new LayoutDraft('kb1'); cancelled.value.kb1.jab = ['KeyZ']; cancelled.cancel(); assert.equal(cancelled.save(), false); equal(loadLayouts().kb1, custom.kb1);
const saved = new LayoutDraft('kb1'); saved.value.kb1.jab = ['KeyZ']; assert.equal(saved.save(), true); equal(loadLayouts().kb1.jab, ['KeyZ']); equal(loadLayouts().kb2, custom.kb2);
const reset = new LayoutDraft('kb1'); reset.reset(); equal(loadLayouts().kb1.jab, ['KeyZ'], 'Reset stays staged'); reset.save(); equal(loadLayouts().kb1.guard, ['ShiftLeft', 'ShiftRight']);

const input = load('input/devices', { './layouts': layouts, '../i18n': i18nStub, '../sim/types': { NEUTRAL_INPUT: { mx: 0, my: 0, jab: false, cross: false, hook: false, uppercut: false, dodge: false, guard: false } } });
const hub = input.devices;
const key = (code, repeat = false) => keys.emit('keydown', { code, repeat, preventDefault() {}, stopImmediatePropagation() {} });
const up = code => keys.emit('keyup', { code });
custom.kb1.jab = ['KeyQ']; custom.kb1.guard = ['ControlLeft']; saveLayouts(custom);
key('KeyQ'); assert.equal(hub.sample('kb1').jab, true); assert.equal(hub.sample('kb1').jab, false); key('KeyQ', true); assert.equal(hub.sample('kb1').jab, false); up('KeyQ');
key('KeyJ'); assert.equal(hub.sample('kb1').jab, false); key('ControlLeft'); assert.equal(hub.sample('kb1').guard, true); assert.equal(hub.sample('kb1').guard, true); up('ControlLeft'); assert.equal(hub.sample('kb1').guard, false);
key('KeyQ'); keys.emit('blur'); assert.equal(hub.sample('kb1').jab, false); assert.equal(hub.sample('kb1').guard, false);
key('KeyW'); key('KeyD'); assert.equal(hub.sample('kb1').mx, 71); up('KeyW'); up('KeyD');
const pad = (index = 0) => ({ index, id: 'test-' + index, connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
pads = [pad(), pad(1)]; hub.poll(); pads[1].buttons[10].pressed = true; hub.poll(); assert.equal(hub.sample('pad2').guard, true); assert.equal(hub.sample('pad1').guard, false);
pads[0].buttons[6].value = .39; hub.poll(); assert.equal(hub.sample('pad1').uppercut, false); pads[0].buttons[6].value = .41; hub.poll(); assert.equal(hub.sample('pad1').uppercut, true); assert.equal(hub.sample('pad1').uppercut, false);
const capture = new PadCapture(pads[0]); assert.equal(capture.poll(pads[0]), null, 'held trigger ignored'); pads[0].buttons[6].value = 0; capture.poll(pads[0]); pads[0].buttons[6].value = .5; assert.equal(capture.poll(pads[0]), 6);
pads[0].buttons[9].pressed = true; assert.equal(capture.poll(pads[0]), 'cancel', 'Start cancels capture rather than binding');
const release = hub.suspend(); key('KeyQ'); assert.equal(hub.sample('kb1').jab, false); pads[0].buttons[5].pressed = true; release(); hub.poll(); assert.equal(hub.sample('pad1').guard, false, 'editor held guard cannot leak');
key('KeyQ', true); assert.equal(hub.sample('kb1').jab, false); up('KeyQ'); key('KeyQ'); assert.equal(hub.sample('kb1').jab, true); up('KeyQ');
pads[0].buttons[5].pressed = false; hub.poll(); pads[0].buttons[5].pressed = true; hub.poll(); assert.equal(hub.sample('pad1').guard, true);
pads[1].buttons[10].pressed = false; hub.poll(); pads[1].buttons[10].pressed = true; hub.poll();
pads[0] = null; hub.poll(); assert.equal(hub.sample('pad1').guard, false); assert.equal(hub.sample('pad2').guard, true, 'disconnect does not transfer P2 ownership');
pads[0] = pad(); pads[0].buttons[5].pressed = true; hub.poll(); assert.equal(hub.sample('pad1').guard, false, 'reconnect starts clean');

const touch = defaults().touch;
assert.equal(touchValid(touch, view), true); equal(resolveTouch(touch, view).main, { x: 752, y: 300, r: 58 });
for (const v of [view, { left: -178, top: 0, width: 1200, height: 390 }, { left: 0, top: -86, width: 844, height: 562 }]) {
  assert.equal(touchValid(touch, v), true);
  const positions = resolveTouch(touch, v);
  for (const id of ['hook', 'guard', 'dodge', 'uppercut']) assert.equal(hitTouch(touch, v, positions[id].x, positions[id].y), id);
  assert.equal(hitTouch(touch, v, positions.main.x - 15, positions.main.y), 'jab'); assert.equal(hitTouch(touch, v, positions.main.x + 15, positions.main.y), 'cross');
}
const badTouch = plain(touch); badTouch.guard = badTouch.main; assert.equal(touchValid(badTouch, view), false);
equal(validateLayouts({ ...defaults(), touch: badTouch }).touch, touch);

// Execute real touch handlers, graphics and label placements against the same resolved geometry.
class Obj extends EventEmitter {
  constructor(x = 0, y = 0, text = '') { super(); Object.assign(this, { x, y, text, active: true, data: {}, circles: [] }); }
  setDepth() { return this; } setOrigin() { return this; } setAlpha() { return this; } setVisible() { return this; } setInteractive() { return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; } setText(text) { this.text = text; return this; } setWordWrapWidth() { return this; }
  setData(k, v) { this.data[k] = v; return this; } getData(k) { return this.data[k]; }
  destroy() { if (!this.active) return; this.active = false; this.emit('destroy'); }
  clear() { this.circles = []; return this; } fillStyle() { return this; } lineStyle() { return this; }
  fillCircle(x, y, r) { this.circles.push({ x, y, r }); return this; } strokeCircle() { return this; }
  fillRect() { return this; } fillRoundedRect() { return this; } lineBetween() { return this; }
  fillEllipse() { return this; } beginPath() { return this; } arc() { return this; } strokePath() { return this; } slice() { return this; } fillPath() { return this; }
}
function scene() {
  const objects = [], add = fn => (...args) => { const obj = fn(...args); objects.push(obj); return obj; };
  const events = new EventEmitter(), input = new EventEmitter(); input.addPointer = () => {};
  return { objects, events, input, scene: { isActive: () => true }, cameras: { main: { getWorldPoint: (x, y) => ({ x: x / 2, y: y / 2 }) } }, time: { now: 0 },
    add: { graphics: add(() => new Obj()), text: add((x, y, t) => new Obj(x, y, t)), rectangle: add((x, y) => new Obj(x, y)), circle: add((x, y) => Object.assign(new Obj(x, y), { kind: 'circle' })) } };
}
const { IntentLayer } = load('input/intents');
const { TouchControls } = load('ui/TouchControls', { '../input/layouts': layouts, '../i18n': i18nStub, '../render/pixelRatio': { VIEW: view, PIXEL_RATIO: 1 },
  phaser: { default: { Math: { Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) } } } }, '../render/art': { artImage: () => null },
  '../sim/tune': { tune }, '../sim/character': { punchCfg: () => ({ fatigueBars: 3 }) }, '../sim/sim': { fatigueLevel: () => 0 } });
saveLayouts(defaults());
const sc = scene(), intents = new IntentLayer(), controls = new TouchControls(sc, intents);
const pointer = (id, x, y) => ({ id, x: x * 2, y: y * 2, worldX: -999, worldY: -999 });
controls.onDown(pointer(1, 668, 236)); controls.onDown(pointer(2, 668, 236)); controls.onUp(pointer(1, 668, 236)); assert.equal(intents.sample().guard, true); controls.onUp(pointer(2, 668, 236)); assert.equal(intents.sample().guard, false);
controls.shown = new Set(['stick', 'jab', 'cross']); controls.onDown(pointer(1, 652, 318)); assert.equal(intents.sample().hook, false); controls.onDown(pointer(1, 735, 300)); assert.equal(intents.sample().jab, true);
controls.onDown(pointer(2, 100, 300)); controls.onMove(pointer(2, 200, 300)); assert.equal(intents.sample().mx, 100); controls.onUp(pointer(2, 200, 300)); assert.equal(intents.sample().mx, 0);
const moved = defaults(); moved.touch.main.x += .01; assert.equal(touchValid(moved.touch, view), true); saveLayouts(moved); controls.draw({ stars: 0 });
assert.equal(controls.labels[0].x, resolveTouch(moved.touch, view).main.x - 29);
assert.ok(sc.objects[0].circles.some(p => p.x === resolveTouch(moved.touch, view).main.x && p.r === 58));
controls.shown = null; controls.onDown(pointer(1, 668, 236)); sc.events.emit('shutdown'); assert.equal(intents.sample().guard, false); assert.equal(sc.input.listenerCount('pointerdown'), 0);

// The real modal: staging, pointer choices without hardware, keyboard capture, Save / Cancel / Reset and shutdown ownership.
let owners = 0; const buttons = [], nav = { modalBack(_anchor, fn) { this.back = fn; }, ownBindings() { owners++; let done = false; return () => { if (!done) { done = true; owners--; } }; } };
const glyph = load('ui/inputGlyph', { '../i18n': i18nStub, '../input/layouts': layouts });
assert.equal(glyph.keyLabel('KeyQ'), 'Q'); assert.equal(glyph.padLabel(0), 'A'); assert.equal(glyph.padLabel(7), 'RT');
const { inputLayoutEditor } = load('ui/inputLayoutEditor', { '../i18n': i18nStub, '../input/layouts': layouts, '../input/devices': { devices: hub }, '../render/pixelRatio': { VIEW: view, PIXEL_RATIO: 1 },
  './menuNav': { getNav: () => nav }, './inputGlyph': { inputGlyph: () => new Obj() }, './titleButton': { titleButton: (_s, x, y, w, h, label, fn) => { const obj = new Obj(x, y, label); obj.setData('bg', new Obj()); buttons.push({ x, y, label, fn }); return obj; } } });
const at = (x, y) => buttons.findLast(b => b.x === x && b.y === y).fn();
const baseline = keys.listenerCount('keydown');
saveLayouts(defaults());
let ed = scene(); inputLayoutEditor(ed, 'kb1'); at(130, 128); assert.equal(owners, 1); key('KeyQ'); assert.equal(owners, 0); equal(loadLayouts().kb1.jab, ['KeyJ']); at(437, 346); equal(loadLayouts().kb1.jab, ['KeyJ']);
ed = scene(); inputLayoutEditor(ed, 'kb1'); at(130, 128); key('KeyQ'); at(612, 346); equal(loadLayouts().kb1.up, ['KeyQ']); assert.equal(keys.listenerCount('keydown'), baseline); assert.equal(ed.events.listenerCount('update'), 0);
ed = scene(); inputLayoutEditor(ed, 'kb1'); at(130, 128); key('Escape'); assert.equal(owners, 0); assert.ok(ed.objects.some(o => o.active)); at(242, 346); equal(loadLayouts().kb1.up, ['KeyQ']); at(437, 346); equal(loadLayouts().kb1.up, ['KeyQ']);
pads = []; ed = scene(); inputLayoutEditor(ed, 'pad2'); at(130, 194); at(246, 288); at(612, 346); equal(loadLayouts().pad2.cross, [10]); equal(loadLayouts().pad1.cross, [3]);
pads = [pad(), pad(1)]; pads[1].buttons[0].pressed = true; ed = scene(); inputLayoutEditor(ed, 'pad2'); at(130, 128); ed.events.emit('update'); assert.equal(owners, 1); pads[0].buttons[2].pressed = true; ed.events.emit('update'); assert.equal(owners, 1, 'other controller cannot capture'); pads[1].buttons[0].pressed = false; ed.events.emit('update'); pads[1].buttons[11].pressed = true; ed.events.emit('update'); assert.equal(owners, 0); at(612, 346); equal(loadLayouts().pad2.up, [11]);
ed = scene(); inputLayoutEditor(ed, 'kb2'); at(130, 128); ed.events.emit('shutdown'); assert.equal(owners, 0); assert.equal(keys.listenerCount('keydown'), baseline); assert.equal(ed.input.listenerCount('pointermove'), 0); assert.ok(ed.objects.every(o => !o.active));
saveLayouts(defaults()); ed = scene(); inputLayoutEditor(ed, 'touch');
let handle = ed.objects.filter(o => o.kind === 'circle')[1];
const previewScale = 210 / 390;
handle.emit('pointerdown', pointer(21, handle.x, handle.y)); ed.input.emit('pointermove', pointer(21, handle.x, handle.y + 10 * previewScale)); ed.input.emit('pointerup', pointer(21, handle.x, handle.y));
equal(loadLayouts().touch, defaults().touch, 'touch dragging is staged'); at(612, 346);
assert.ok(Math.abs(loadLayouts().touch.main.y - 310 / 390) < .00001, 'saved touch coordinates normalized from pointer/view space');
const beforeCancel = loadLayouts().touch; ed = scene(); inputLayoutEditor(ed, 'touch'); at(242, 346); equal(loadLayouts().touch, beforeCancel); at(437, 346); equal(loadLayouts().touch, beforeCancel);
ed = scene(); inputLayoutEditor(ed, 'touch'); at(242, 346); at(612, 346); equal(loadLayouts().touch, defaults().touch, 'touch Reset requires Save');
ed = scene(); inputLayoutEditor(ed, 'touch'); handle = ed.objects.filter(o => o.kind === 'circle')[1];
handle.emit('pointerdown', pointer(23, handle.x, handle.y)); ed.input.emit('pointermove', pointer(23, handle.x - 84 * previewScale, handle.y - 64 * previewScale)); at(612, 346);
equal(loadLayouts().touch, defaults().touch, 'overlapping layout cannot save'); assert.ok(ed.objects.some(o => o.active)); ed.events.emit('shutdown'); assert.equal(ed.input.listenerCount('pointermove'), 0);
const tutorial = load('scenes/TutorialScene', { phaser: { default: { Scene: class {} } }, '../input/devices': { devices: hub }, '../ui/inputGlyph': glyph,
  '../i18n': i18nStub, '../portal/keys': { KEYS: { tutorial: 'tutorial' } }, '../sim/tune': { TICK_RATE: 60 } }, '\nexports.binderForTest = binder;');
hub.lastSource = 'kb2'; hub.lastDevice = 'keyboard'; custom.kb2.jab = ['KeyZ']; custom.kb2.guard = ['ControlRight']; saveLayouts(custom);
assert.equal(tutorial.binderForTest()('jab'), i18nStub.t('tutorial.press_key', { key: 'Z' })); assert.equal(tutorial.binderForTest()('guard'), glyph.keyLabel('ControlRight'));
const { FirstFightScene } = load('scenes/FirstFightScene', { phaser: { default: { Scene: class {} } }, '../input/devices': { devices: hub }, '../ui/inputGlyph': glyph, '../i18n': i18nStub, '../sim/tune': { TICK_RATE: 60 } });
const coach = new FirstFightScene(); coach.phase = 'jab'; assert.equal(coach.coachText(), 'Throw JABS: Z');
memory.delete(KEYS.localInputs); equal(loadLayouts(), defaults(), 'whole-save removal restores mapping config through its registered key');
console.log('PASS: saved inputs reload/repair, independent profiles, defaults/alternates, actual FrameInput edges/guard, capture isolation/held/disconnect, normalized touch draw/hit/labels/tutorial/multitouch/floating stick, editor Save/Cancel/Reset/shutdown.');
