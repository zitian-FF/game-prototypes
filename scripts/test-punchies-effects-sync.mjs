import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
// Device detection is browser-only; this test only needs stable array sorting.
require.cache[require.resolve('phaser/src/device/index.js')] = { exports: { features: { stableSort: true } } };
// Exercise the real Phaser DisplayList emission contract without a DOM.
const DisplayList = require('phaser/src/gameobjects/DisplayList.js');
const EventEmitter = require('eventemitter3');
const ADDED_TO_SCENE = require('phaser/src/scene/events/ADDED_TO_SCENE_EVENT.js');
const tune = JSON.parse(fs.readFileSync(new URL('../prototypes/punchies/tune.json', import.meta.url)));
const VIEW = { left: 0, top: 0, width: 844, height: 390, bottom: 390, cx: 422, cy: 195 };
const source = fs.readFileSync(new URL('../prototypes/punchies/src/render/perspective.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class WebGLRenderer {}
const phaser = { Scenes: { Events: { ADDED_TO_SCENE } }, Renderer: { WebGL: {
  WebGLRenderer, Pipelines: { PostFXPipeline: class {} },
} }, Math: { Clamp: (x, a, b) => Math.max(a, Math.min(b, x)), Linear: (a, b, t) => a + (b - a) * t } };
const exports = {};
vm.runInNewContext(compiled, { exports, queueMicrotask, window: { matchMedia: () => ({ matches: false }) },
  require: (id) => id === 'phaser' ? { default: phaser } : id.endsWith('/tune') ? { tune }
    : id.endsWith('/pixelRatio') ? { VIEW }
      : id.endsWith('/gymPerspective') ? { arenaVanishingY: () => -2200, updateGymProjection() {} }
        : (() => { throw new Error(`Unexpected import ${id}`); })(),
});

class ObjectStub extends EventEmitter {
  constructor(scene, depth = 0) { super(); Object.assign(this, { scene, depth, parentContainer: null,
    displayList: null, x: 0, y: 0, scaleX: 1, scaleY: 1, list: [] }); }
  setDepth(depth) { this.depth = depth; return this; }
  setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setPostPipeline() { return this; }
  setVisible(visible) { this.visible=visible;return this; }
  setAlpha() { return this; }
  setRotation() { return this; }
  setOrigin() { return this; }
  setFrame() { return this; }
  clear() { return this; }
  fillStyle() { return this; }
  lineStyle() { return this; }
  fillPoints() { return this; }
  strokePoints() { return this; }
  destroy() { this.scene=null;this.active=false; }
  resetPostPipeline() { return this; }
  sort() { this.list.sort((a, b) => a.depth - b.depth); }
  add(objects) {
    for (const obj of Array.isArray(objects) ? objects : [objects]) {
      obj.displayList?.remove(obj);
      obj.parentContainer = this;
      this.list.push(obj);
    }
    return this;
  }
}

for (const webgl of [false, true]) {
  const events = new EventEmitter();
  const renderer = webgl ? new WebGLRenderer() : {};
  renderer.pipelines = { getPostPipeline: () => true };
  const scene = { events, sys: { events }, game: { renderer }, time: { now: 0 } };
  scene.children = new DisplayList(scene);
  const spawn = (depth, x = 400, y = 200) => {
    const obj = new ObjectStub(scene).setPosition(x, y);
    scene.children.add(obj);
    // Real factories add first; caller chains setDepth after ADDED_TO_SCENE.
    return obj.setDepth(depth);
  };
  scene.add = { container: () => spawn(0),graphics:()=>{const g=spawn(0);g.pooledSpark=true;return g;},image:(_x,_y,_k,frame)=>{const o=spawn(0);o.pooledSymbol=frame==='sweet-star'||frame==='charge-lost-bolt';return o;} };
  scene.textures={exists:()=>true};
  const perspective = new exports.RingPerspective(scene);
  const fighter = spawn(10);
  perspective.take([fighter]);
  const combatExports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/combatVfx.ts','utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:combatExports});
  const sparks=new combatExports.CombatSparks(scene);
  sparks.burst(400,200,1,0,1.25,[0xffffff,0xfff27a,0xffc83a],10);
  const symbolExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/combatSymbols.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:symbolExports,require:()=>({reducedMotion:()=>false})});
  const symbols=new symbolExports.CombatSymbols(scene);symbols.sweet(400,204);
  const shadowExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/codeXShadows.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:shadowExports,require:id=>id.includes('codeXShadowSheet')?{codeXTrailTexture:()=> 'trail'}:{}});
  const shadowBefore=new Set(scene.children.list),shadows=new shadowExports.CodeXShadows(scene),shadowObjects=scene.children.list.filter(o=>!shadowBefore.has(o));perspective.take(shadowObjects);assert.equal(shadowObjects.length,24);assert(shadowObjects.every(o=>o.parentContainer===perspective.world),'all cached shadow tracks share ring world');
  const waveExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/waveMotionVfx.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:waveExports,require:id=>id.includes('waveMotionTexture')?{waveMotionTexture:()=> 'wave',WAVE_ART:{coreX:88,coreY:48,width:128,height:96}}:{reducedMotion:()=>false}});
  const waveBefore=new Set(scene.children.list),wave=new waveExports.WaveMotionVfx(scene),waveObjects=scene.children.list.filter(o=>!waveBefore.has(o));perspective.take(waveObjects);assert.equal(waveObjects.length,6);assert(waveObjects.every(o=>o.parentContainer===perspective.world),'all wave objects share fitted ring world');
  const eagleExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/eagleFireVfx.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:eagleExports,require:id=>id.includes('eagleFireTexture')?{eagleFireTexture:()=> 'eagle',EAGLE_ART:{gloveX:72,width:96}}:{reducedMotion:()=>false}});
  const eagleBefore=new Set(scene.children.list),eagle=new eagleExports.EagleFireVfx(scene),eagleObjects=scene.children.list.filter(o=>!eagleBefore.has(o));perspective.take(eagleObjects);assert.equal(eagleObjects.length,10);assert(eagleObjects.every(o=>o.parentContainer===perspective.world),'all eagle fire objects share fitted ring world');
  const effects = [60, 61, 69, 70, 72, 75].map((depth) => spawn(depth));effects.push(...waveObjects,...eagleObjects);
  const overlay = spawn(76);
  const flash = spawn(80);
  const hud = spawn(130);
  const dead = spawn(60);
  dead.scene = null;
  const owned = spawn(60);
  const otherContainer = new ObjectStub(scene);
  otherContainer.add(owned);
  await new Promise((resolve) => queueMicrotask(resolve));
  const pooled=perspective.world.list.filter(o=>o.pooledSpark);
  assert.equal(pooled.length,8,'all pooled sparks must join the fitted world');
  const activeSpark=pooled.find(o=>o.visible);
  effects.push(activeSpark);
  const pooledSymbols=perspective.world.list.filter(o=>o.pooledSymbol);assert.equal(pooledSymbols.length,12,'all sweet/charge-loss slots share fitted world');effects.push(pooledSymbols.find(o=>o.visible));
  for (const effect of effects) assert.equal(effect.parentContainer, perspective.world, `depth ${effect.depth} detached`);
  for (const item of [overlay, flash, hud, dead]) assert.equal(item.parentContainer, null);
  assert.equal(owned.parentContainer, otherContainer);
  perspective.fitArtwork({ left: 240, top: 30, width: 360, height: 430, aspect: 1 });
  perspective.beginRound(0);
  const positions = [];
  for (const time of [0, tune.view.arena.roundZoomMs / 2, tune.view.arena.roundZoomMs]) {
    scene.time.now = time;
    perspective.update();
    const worldPosition = (obj) => ({ x: obj.parentContainer.x + obj.x * obj.parentContainer.scaleX,
      y: obj.parentContainer.y + obj.y * obj.parentContainer.scaleY });
    const expected = worldPosition(fighter);
    for (const effect of effects) assert.deepEqual(worldPosition(effect), expected);
    positions.push(expected);
  }
  assert.notDeepEqual(positions[0], positions[2], 'test must exercise a moving zoom');
  // DisplayList itself destroys children on shutdown; this stub tests only
  // the perspective listener, without pretending to be a full GameObject.
  scene.children.shutdown = () => {};
  events.emit('shutdown');
  assert(waveObjects.every(o=>o.scene===null),'wave object cleanup leaked');assert(eagleObjects.every(o=>o.scene===null),'eagle fire cleanup leaked');
  assert.equal(events.listenerCount('update'),0,'pooled spark update listener leaked');
  const afterShutdown = spawn(60);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(afterShutdown.parentContainer, null, 'listener leaked after shutdown');
  console.log(`${webgl ? 'WebGL' : 'Canvas'}: runtime effects share zoom container; HUD stays separate; shutdown cleans up`);
}
