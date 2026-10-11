import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const stored = new Map();
const nodes = [];
class Node {
  connections = [];
  playbackRate = {value: 1};
  threshold={value:0}; knee={value:0}; ratio={value:0}; attack={value:0}; release={value:0};
  disconnect() { this.connections=[]; }
  gain = { value: 1, setTargetAtTime: v => { this.gain.value = v; }, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  frequency = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  connect(node) { this.connections.push(node); return node; }
  start() {} stop() { this.onended?.(); }
}
class Context {
  currentTime = 1; state = 'suspended'; sampleRate = 44100; destination = new Node();
  resume() { this.state = 'running'; return Promise.resolve(); }
  make() { const n = new Node(); nodes.push(n); return n; }
  createGain() { return this.make(); }
  createDynamicsCompressor() { return this.make(); }
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
const load = loader(), mixer = load(root + 'mixer.ts'), { sfx, unlockAudio, stopCombatSounds } = load(root + 'sfx.ts');
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
stopCombatSounds();
for (const cue of Object.values(sfx)) { ctx.currentTime += 1; cue(); }
stopCombatSounds();
const voiceBefore = nodes.length;
for(let i=0;i<50;i++) sfx.impact('hook',true,true);
assert.equal(nodes.length-voiceBefore,16,'bounded physical voices under dense hits');
stopCombatSounds();
const silentBefore=nodes.length; mixer.setAudioSettings({muted:true}); sfx.swing('cross'); sfx.impact('cross',true); assert.equal(nodes.length,silentBefore,'muted physical cues allocate nothing');
mixer.setAudioSettings({muted:false});
const resultBefore=nodes.length; sfx.victory();sfx.defeat();assert.equal(nodes.length,resultBefore,'result fanfare silent');
const {combatSamples}=load(root+'combatSound.ts');
const energy=a=>a.reduce((n,v)=>n+v*v,0);
for(const punch of ['jab','cross','hook','uppercut']) {
 const sweet=combatSamples('impact',44100,punch,true),sour=combatSamples('impact',44100,punch,false);
 assert.ok(energy(sweet)>energy(sour)*2,punch+' sweet impact fuller than sour');
 assert.ok([...sweet,...sour].every(v=>Number.isFinite(v)&&Math.abs(v)<=.850001));
 assert.notDeepEqual(combatSamples('swing',44100,punch),sweet);
}
const {MovementSound}=load(root+'movementSound.ts');
const tracker=new MovementSound();
const f={x:0,y:0,guarding:false,dodge:null,anchored:false,stunTimer:0,pushFrames:0,pushLock:0};
const state={tick:0,fightStartTick:0,result:null,hitstop:0,fighters:[f,{...f,anchored:true}]};
tracker.update(state);stopCombatSounds();const still=nodes.length;
for(let tick=1;tick<=30;tick++){state.tick=tick;tracker.update(state);}assert.equal(nodes.length,still,'stationary fighters silent');
for(let tick=31;tick<=90;tick++){state.tick=tick;f.x+=2;tracker.update(state);}assert.ok(nodes.length>still,'walking footsteps');assert.ok(nodes.length-still<=5,'step cadence bounded');
stopCombatSounds();let edge=nodes.length;state.tick++;f.dodge={};tracker.update(state);assert.equal(nodes.length,edge+1,'dodge starts one cue');tracker.update(state);assert.equal(nodes.length,edge+1,'same presented tick cannot repeat');
stopCombatSounds();edge=nodes.length;state.tick++;f.dodge=null;f.guarding=true;tracker.update(state);assert.equal(nodes.length,edge+1,'guard raising rustle');
stopCombatSounds();
assert.ok(nodes.some(n => n.connections.includes(mixer.audioOutput('sfx'))));
assert.equal(nodes.filter(n => n.connections.includes(ctx.destination)).length, 2, 'only the two mixer buses connect directly to speakers');
stored.set('punchies:audio:v1', 'null'); assert.equal(loader()(root + 'mixer.ts').getAudioSettings().sfx, .7);
storage.setItem = () => { throw new Error('storage denied'); };
assert.doesNotThrow(() => mixer.setAudioSettings({ muted: true }));
console.log('PASS: audio persistence, independent channels, master mute, bounded volumes, cue routing and denial throttling');
