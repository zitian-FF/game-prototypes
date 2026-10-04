import Phaser from 'phaser';
import { VIEW } from './pixelRatio';
import { roomFromUrl } from '../net/roomCode';

interface AnimationSource { frameCount: number; frames: string[] }
interface ArtIndex { manifest: { path: string; hash: string }[]; animations: Record<string, AnimationSource> }
declare const __PUNCHIES_ART__: ArtIndex;
const index = __PUNCHIES_ART__;
const assetRoot = `${__PUNCHIES_ASSET_BASE__}prototypes/punchies/assets/`;
declare const __PUNCHIES_ASSET_BASE__: string;
const frameRefs = new Map<string, Phaser.Types.Animations.AnimationFrame[]>();
const textureKey = (name: string) => `punchies:${name}`;

export class ArtBootScene extends Phaser.Scene {
  constructor() { super('ArtBoot'); }
  preload(): void {
    for (const file of index.manifest) {
      if (file.path.startsWith('loose/') && /\.(png|webp|jpg)$/i.test(file.path)) {
        const name = file.path.slice(6).replace(/\.[^.]+$/, '');
        this.load.image(textureKey(name), `${assetRoot}${file.path}?v=${file.hash}`);
      } else if (/^atlas\/atlas.*\.json$/.test(file.path)) {
        this.load.multiatlas(textureKey(file.path), `${assetRoot}${file.path}?v=${file.hash}`, `${assetRoot}atlas/`);
      }
    }
  }
  create(): void {
    const atlases = index.manifest.filter(f => /^atlas\/atlas.*\.json$/.test(f.path)).map(f => textureKey(f.path));
    // Keys and counts come exclusively from the packer's source-folder index.
    for (const [key, source] of Object.entries(index.animations)) {
      const frames: Phaser.Types.Animations.AnimationFrame[] = [];
      for (const frame of source.frames) {
        const atlas = atlases.find(a => this.textures.exists(a) && this.textures.get(a).has(frame));
        if (atlas) frames.push({ key: atlas, frame });
      }
      if (frames.length !== source.frameCount) continue; // incomplete animation uses fallback
      frameRefs.set(key, frames);
      if (!this.anims.exists(key)) this.anims.create({ key, frames, frameRate: source.frameCount, repeat: -1 });
    }
    const room = roomFromUrl();
    if (room) this.scene.start('Lobby', { role: 'guest', code: room });
    else this.scene.start('Menu');
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

export function backdrop(scene: Phaser.Scene, dim = 0.72, name = 'menu_background'): void {
  const image = artImage(scene, name, VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, -10);
  if (image) scene.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x101b32, dim).setDepth(-9);
}

export function resultArt(scene: Phaser.Scene): void {
  artImage(scene, 'ui_result', VIEW.cx, VIEW.cy + 45, 400, 180, 125);
}
