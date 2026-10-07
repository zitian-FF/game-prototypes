import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from './pixelRatio';
import { isCharId } from '../sim/character';
import { makeAltParts } from './puppet';
import { roomFromUrl } from '../net/roomCode';
import { tune } from '../sim/tune';
import { reducedMotion } from '../ui/presentation';

interface AnimationSource { frameCount: number; frames: string[] }
interface ArtGroup { atlases: string[]; animations: string[] }
interface ArtIndex {
  manifest: { path: string; hash: string }[];
  animations: Record<string, AnimationSource>;
  groups?: Record<string, ArtGroup>;
}
declare const __PUNCHIES_ART__: ArtIndex;
const index = __PUNCHIES_ART__;
const assetRoot = `${__PUNCHIES_ASSET_BASE__}prototypes/punchies/assets/`;
declare const __PUNCHIES_ASSET_BASE__: string;
const frameRefs = new Map<string, Phaser.Types.Animations.AnimationFrame[]>();
const textureKey = (name: string) => `punchies:${name}`;
// Texture key of a loaded loose art file (e.g. portrait_marco), or null.
export function artKey(scene: Phaser.Scene, name: string): string | null {
  const k = textureKey(name);
  return scene.textures.exists(k) ? k : null;
}
const hashOf = (path: string) => index.manifest.find((f) => f.path === path)?.hash ?? '';
const atlasUrl = (path: string) => `${assetRoot}${path}?v=${hashOf(path)}`;

// Fighter atlases are split per character (and per alt colour) by the packer
// (groups.json). Only the loose UI files load at boot; a group downloads when
// a screen needs it. A build without groups.json (older zip) falls back to
// loading every atlas at boot, and a build without art skips all of this.
const groups = index.groups ?? {};
const grouped = Object.keys(groups).length > 0;
const groupState = new Map<string, 'loading' | 'ready' | 'failed'>();
const groupWaiters = new Map<string, Array<() => void>>();
// ArtBoot stays running after boot so its loader outlives every screen.
let loaderScene: Phaser.Scene | null = null;

// Keys and counts come exclusively from the packer's source-folder index.
function registerAnimations(scene: Phaser.Scene, animationKeys: string[], atlases: string[]): void {
  for (const key of animationKeys) {
    const source = index.animations[key];
    if (!source) continue;
    const frames: Phaser.Types.Animations.AnimationFrame[] = [];
    for (const frame of source.frames) {
      const atlas = atlases.find((a) => scene.textures.exists(a) && scene.textures.get(a).has(frame));
      if (atlas) frames.push({ key: atlas, frame });
    }
    if (frames.length !== source.frameCount) continue; // incomplete animation uses fallback
    frameRefs.set(key, frames);
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames, frameRate: source.frameCount, repeat: -1 });
  }
}

function settleGroup(group: string, state: 'ready' | 'failed'): void {
  groupState.set(group, state);
  const waiters = groupWaiters.get(group) ?? [];
  groupWaiters.delete(group);
  for (const done of waiters) done();
}

function requestGroup(group: string): void {
  const g = groups[group];
  if (!g || !loaderScene || groupState.has(group)) return;
  groupState.set(group, 'loading');
  const scene = loaderScene;
  const load = scene.load;
  const keys = g.atlases.map(textureKey);
  let remaining = keys.length;
  const onError = (file: Phaser.Loader.File) => {
    if (!keys.includes(file.key) || groupState.get(group) !== 'loading') return;
    load.off('loaderror', onError);
    settleGroup(group, 'failed'); // the procedural fallback keeps the game playable
  };
  load.on('loaderror', onError);
  g.atlases.forEach((path, i) => {
    load.once(`filecomplete-multiatlas-${keys[i]}`, () => {
      if (--remaining > 0) return;
      load.off('loaderror', onError);
      registerAnimations(scene, g.animations, keys);
      settleGroup(group, 'ready');
    });
    load.multiatlas(keys[i], atlasUrl(path), `${assetRoot}atlas/`);
  });
  if (!load.isLoading()) load.start();
}

// Groups a fight needs. Fighter 0 wears the main look, fighter 1 the alt
// look in a mirror match (see lookFor), and the training dummy has its own.
export function fighterGroups(chars: [string, string]): string[] {
  const id = (c: string) => (isCharId(c) ? c : 'marco');
  const [a, b] = [id(chars[0]), id(chars[1])];
  return [a, a === b ? `${b}_alt` : b];
}
export function trainingGroups(char: string): string[] {
  return [isCharId(char) ? char : 'marco', 'dummy'];
}

// Start downloading in the background; nothing waits on it.
export function prefetchGroups(names: string[]): void {
  for (const name of names) requestGroup(name);
}

// Run `build` once every group is loaded. Immediately when they already are
// (or there is no art), otherwise behind a small loading bar. A group that
// fails to load counts as done: that fighter uses the procedural fallback.
export function whenGroupsReady(scene: Phaser.Scene, names: string[], build: () => void): void {
  prefetchGroups(names);
  const pending = names.filter((n) => groups[n] && groupState.get(n) === 'loading');
  if (pending.length === 0 || !loaderScene) {
    build();
    return;
  }
  const bar = loadingBar(scene);
  const load = loaderScene.load;
  let left = pending.length;
  let finished = false;
  const onProgress = (v: number) => bar.set(v);
  const cleanup = () => {
    finished = true;
    load.off('progress', onProgress);
    bar.destroy();
  };
  load.on('progress', onProgress);
  scene.events.once('shutdown', () => {
    if (!finished) cleanup();
  });
  for (const name of pending) {
    const list = groupWaiters.get(name) ?? [];
    list.push(() => {
      if (finished || --left > 0) return;
      cleanup();
      build();
    });
    groupWaiters.set(name, list);
  }
}

function loadingBar(scene: Phaser.Scene): { set(v: number): void; refreshLogo(): void; destroy(): void } {
  const W = 220;
  const objs: Phaser.GameObjects.GameObject[] = [];
  objs.push(scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x101b32, 1).setDepth(1000));
  let logo: Phaser.GameObjects.Image | null = null;
  const stamps: Array<{image: Phaser.GameObjects.Image; x: number}> = [];
  let offset = 0;
  const drift = (_time: number, delta: number) => {
    if (reducedMotion()) return;
    offset = (offset + delta * tune.view.menu.loadingDrift / 1000) % 190;
    for (const s of stamps) s.image.x = s.x - offset;
  };
  const refreshLogo = () => {
    if (logo || !artKey(scene,'logo')) return;
    for (let row=0; row<Math.ceil(VIEW.height/90)+2; row++) {
      for (let col=0; col<Math.ceil(VIEW.width/190)+2; col++) {
        const x=VIEW.left-190+col*190+(row%2)*95;
        const image=artImage(scene,'logo',x,VIEW.top-45+row*90,145,42,1000)!;
        image.setAngle(-12).setAlpha(0.09);
        stamps.push({image,x}); objs.push(image);
      }
    }
    logo=artImage(scene,'logo',VIEW.cx,VIEW.cy-73,250,71,1001)!;
    objs.push(logo);
    if (!reducedMotion()) {
      const sx=logo.scaleX,sy=logo.scaleY;
      logo.setScale(sx*1.3,sy*1.3).setAngle(-6).setAlpha(0);
      scene.tweens.add({targets:logo,scaleX:sx,scaleY:sy,angle:0,alpha:1,duration:tune.view.menu.stampMs,ease:'Back.Out'});
    }
  };
  refreshLogo();
  scene.events.on('update',drift);
  objs.push(
    scene.add
      .text(VIEW.cx, VIEW.cy - 18, 'LOADING', { fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#fff1d1', resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(1001),
  );
  objs.push(scene.add.rectangle(VIEW.cx, VIEW.cy + 6, W + 4, 12, 0x253650, 1).setStrokeStyle(1, 0x5a6378).setDepth(1001));
  const fill = scene.add.rectangle(VIEW.cx - W / 2, VIEW.cy + 6, 1, 8, 0xffc84a, 1).setOrigin(0, 0.5).setDepth(1002);
  objs.push(fill);
  return {
    set: (v) => fill.setSize(Math.max(1, W * Math.min(1, Math.max(0, v))), 8),
    refreshLogo,
    destroy: () => { scene.events.off('update',drift); if(logo)scene.tweens.killTweensOf(logo); objs.forEach((o) => o.destroy()); },
  };
}

export class ArtBootScene extends Phaser.Scene {
  private bar: ReturnType<typeof loadingBar> | null = null;
  constructor() { super('ArtBoot'); }
  init(): void { applyCameraPixelRatio(this); }
  preload(): void {
    this.bar = loadingBar(this);
    this.load.on('progress', (v: number) => this.bar?.set(v));
    // The logo becomes available during the first loose-file download, before boot completes.
    this.load.once(`filecomplete-image-${textureKey('logo')}`, () => {
      this.bar?.refreshLogo();
    });
    for (const file of index.manifest) {
      if (file.path.startsWith('loose/') && /\.(png|webp|jpg)$/i.test(file.path)) {
        const name = file.path.slice(6).replace(/\.[^.]+$/, '');
        this.load.image(textureKey(name), `${assetRoot}${file.path}?v=${file.hash}`);
      } else if (!grouped && /^atlas\/atlas.*\.json$/.test(file.path)) {
        this.load.multiatlas(textureKey(file.path), atlasUrl(file.path), `${assetRoot}atlas/`);
      }
    }
  }
  create(): void {
    this.bar?.destroy();
    this.bar = null;
    loaderScene = this;
    makeAltParts(this); // hue-shifted copies of the boxer parts for mirror matches
    if (!grouped) {
      const atlases = index.manifest.filter((f) => /^atlas\/atlas.*\.json$/.test(f.path)).map((f) => textureKey(f.path));
      registerAnimations(this, Object.keys(index.animations), atlases);
    }
    const room = roomFromUrl();
    // launch (not start): this scene keeps running as the background loader.
    if (room) this.scene.launch('Lobby', { role: 'guest', code: room });
    else this.scene.launch('Menu');
  }
}

// Display a source frame by normalized sim phase. Atlas trimming preserves
// the 256x256 source canvas; origin stays fixed at its center, never trim center.
export function pose(image: Phaser.GameObjects.Image, key: string, progress: number): boolean {
  const frames = frameRefs.get(key);
  if (!frames?.length) { image.setVisible(false); return false; }
  const i = Math.min(frames.length - 1, Math.max(0, Math.floor(progress * frames.length)));
  const ref = frames[i];
  image.setTexture(ref.key!, ref.frame).setVisible(true);
  return true;
}

export function artImage(scene: Phaser.Scene, name: string, x: number, y: number, w: number, h: number, depth = 0): Phaser.GameObjects.Image | null {
  const key = textureKey(name);
  return scene.textures.exists(key) ? scene.add.image(x, y, key).setDisplaySize(w, h).setDepth(depth) : null;
}

export function backdrop(scene: Phaser.Scene, dim = 0.72, name = 'menu_background'): Phaser.GameObjects.Image | null {
  const image = artImage(scene, name, VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, -10);
  if (image && name==='gym_background') image.setScale(Math.max(VIEW.width/image.width,VIEW.height/image.height));
  if (image) scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x101b32, dim).setDepth(-9);
  return image;
}

export function resultArt(scene: Phaser.Scene): void {
  artImage(scene, 'ui_result', VIEW.cx, VIEW.cy + 45, 400, 180, 125);
}
