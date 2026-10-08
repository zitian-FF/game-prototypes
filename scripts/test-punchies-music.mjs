import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const listeners = new Map(), events = new Map(), players = [], gains = [];
const window = { addEventListener: (k, fn) => listeners.set(k, fn), removeEventListener: k => listeners.delete(k) };
const document = { ...window, hidden: false };
const ctx = { currentTime: 0, createGain() { const n = { gain: { value: 0, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } }, connect() {}, disconnect() {} }; gains.push(n); return n; }, createMediaElementSource() { return { connect(n) { return n; } }; } };
class Audio { constructor(src) { this.src = src; this.paused = true; players.push(this); } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } removeAttribute() {} load() {} }
const exports = {};
const code = ts.transpileModule(fs.readFileSync('prototypes/punchies/src/audio/music.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, { exports, Audio, window, document, __PUNCHIES_ASSET_BASE__: '/', require: () => ({ preloadStingers() {}, unlockMixer: () => ctx, audioOutput: () => ({}) }) });
let active = ['Menu'], paused = [];
exports.installMusic({ events: { on: (k, fn) => events.set(k, fn), once: (k, fn) => events.set(k, fn), off: k => events.delete(k) }, scene: { getScenes: () => active.map(key => ({ scene: { key } })), isActive: k => active.includes(k), isPaused: k => paused.includes(k) } });
const step = () => events.get('step')();
step(); assert.equal(players.length, 0, 'wait for gesture');
listeners.get('pointerdown')(); assert.match(players[0].src, /title.mp3$/); assert.equal(players[0].loop, true);
active = ['CharSelect']; step(); assert.match(players[1].src, /charselect.mp3$/); assert.equal(players[0].paused, true);
active = ['Training']; step(); assert.match(players[2].src, /gameplay.mp3$/);
active = ['GameMenu']; paused = ['Training']; step(); assert.equal(players[2].paused, false);
document.hidden = true; listeners.get('visibilitychange')(); assert.ok(players.every(p => p.paused));
document.hidden = false; listeners.get('visibilitychange')(); assert.equal(players[2].paused, false);
paused = []; active = ['Shop']; step(); assert.equal(players.length, 3); assert.equal(players[0].paused, false);
events.get('destroy')(); assert.ok(players.every(p => p.paused)); assert.equal(listeners.size, 0);
console.log('PASS: music gesture unlock, scene mapping, looping, pause overlay, visibility and cleanup');

