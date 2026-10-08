import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const stored = new Map();
const nodes = [];
class Node {
  connections = [];
  gain = { value: 1, setTargetAtTime: v => { this.gain.value = v; }, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  frequency = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  connect(node) { this.connections.push(node); return node; }
  start() {} stop() {}
}
class Context {
  currentTime = 1; state = 'suspended'; sampleRate = 44100; destination = new Node();
  resume() { this.state = 'running'; return Promise.resolve(); }
  make() { const n = new Node(); nodes.push(n); return n; }
  createGain() { return this.make(); }
  createOscillator() { return this.make(); }
  createBufferSource() { return this.make(); }
  createBiquadFilter() { return this.make(); }
  createBuffer(_channels, size) { return { getChannelData: () => new Float32Array(size) }; }
}
const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
function loader() {
  const cache = new Map();
  return function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, localStorage: storage, __PUNCHIES_PORTAL__: 'web', __PUNCHIES_PORTAL_ADS__: true, AudioContext: Context, window: { addEventListener() {} },
      require: id => load(path.resolve(path.dirname(file), `${id}.ts`)) });
    return exports;
  };
}
const root = 'prototypes/punchies/src/audio/';
const load = loader(), mixer = load(root + 'mixer.ts'), { sfx, unlockAudio } = load(root + 'sfx.ts');
assert.equal(mixer.getAudioSettings().sfx, .7);
mixer.setAudioSettings({ bgm: .2, sfx: .5 });
unlockAudio();
const ctx = mixer.unlockMixer();
assert.equal(ctx.state, 'running');
assert.equal(mixer.audioOutput('bgm').gain.value, .2);
assert.equal(mixer.audioOutput('sfx').gain.value, .5);
const observations = [];
const unsub = mixer.subscribeAudioSettings(v => observations.push(v));
mixer.setAudioSettings({ muted: true });
assert.equal(mixer.audioOutput('bgm').gain.value, 0);
assert.equal(mixer.audioOutput('sfx').gain.value, 0);
mixer.setAudioSettings({ muted: false });
assert.equal(mixer.audioOutput('bgm').gain.value, .2);
assert.equal(mixer.audioOutput('sfx').gain.value, .5);
mixer.setAudioSettings({ bgm: 99, sfx: -2 });
assert.equal(mixer.getAudioSettings().bgm, 1);
assert.equal(mixer.getAudioSettings().sfx, 0);
mixer.setAudioSettings({ bgm: NaN, sfx: .7 });
assert.equal(mixer.getAudioSettings().bgm, 1);
unsub(); const count = observations.length;
mixer.setAudioSettings({ bgm: .35 }); assert.equal(observations.length, count);
const reloaded = loader()(root + 'mixer.ts');
assert.equal(reloaded.getAudioSettings().bgm, .35);
assert.equal(reloaded.getAudioSettings().sfx, .7);
const before = nodes.length; sfx.denied(); const after = nodes.length;
assert.ok(after > before); sfx.denied(); assert.equal(nodes.length, after, 'held/repeated denial must not spam');
ctx.currentTime += .3; sfx.denied(); assert.ok(nodes.length > after);
for (const cue of Object.values(sfx)) { ctx.currentTime += 1; cue(); }
assert.ok(nodes.some(n => n.connections.includes(mixer.audioOutput('sfx'))));
assert.equal(nodes.filter(n => n.connections.includes(ctx.destination)).length, 2, 'only the two mixer buses connect directly to speakers');
stored.set('punchies:audio:v1', 'null'); assert.equal(loader()(root + 'mixer.ts').getAudioSettings().sfx, .7);
storage.setItem = () => { throw new Error('storage denied'); };
assert.doesNotThrow(() => mixer.setAudioSettings({ muted: true }));
console.log('PASS: audio persistence, independent channels, master mute, bounded volumes, cue routing and denial throttling');
