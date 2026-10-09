// Build step for the boxer puppet parts (run by scripts/pack-assets.js before
// it copies loose/ through). The raw design masters live in the art zip under
// parts/<char>/<part>.png (hundreds of px, far larger than a boxer on screen).
// This writes small WebP files to assets-src/loose/part_<char>_<part>.webp,
// and slices Mia's ponytail off her head master (it sways on its own).
// Nothing here is committed: the zip, the parts and the output stay out of git.
import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

function applyTorsoOverrides(assetsSrcDir) {
  const dir = fileURLToPath(new URL('./torso-overrides/', import.meta.url));
  const loose = path.join(assetsSrcDir, 'loose');
  mkdirSync(loose, { recursive: true });
  for (const char of ['marco', 'mia', 'bruno', 'tee']) {
    const name = `part_${char}_torso.webp`;
    copyFileSync(path.join(dir, name), path.join(loose, name));
  }
}

// Output size per part type, in source pixels (a boxer is about 40 logical px
// across and renders at up to 3x, so these keep a safe margin).
const HEAD_H = 120;
const TORSO_H = 128;
const GLOVE_H = 96;
const BOOT_W = 84;
const QUALITY = 90;

// Mia's master is one image: ponytail on the left, head on the right. The tie
// sits at the join. Cut just left of the head circle; the ponytail piece keeps
// a little overlap (it is drawn under the head) so no gap opens when it sways.
const MIA_CUT = 0.43;
const MIA_OVERLAP = 0.05;

async function save(img, out, scale) {
  // Render any extract first: metadata() on a pending pipeline reports the
  // input size, which would stretch a cropped piece.
  const buf = await img.toBuffer();
  const meta = await sharp(buf).metadata();
  await sharp(buf)
    .resize({ width: Math.max(1, Math.round(meta.width * scale)), height: Math.max(1, Math.round(meta.height * scale)), kernel: 'lanczos3' })
    .webp({ quality: QUALITY, alphaQuality: 100 })
    .toFile(out);
}

export default async function prepare({ assetsSrcDir }) {
  const partsDir = path.join(assetsSrcDir, 'parts');
  if (!existsSync(partsDir)) {
    applyTorsoOverrides(assetsSrcDir);
    console.log('prepare-assets: applied torso overrides without parts masters');
    return;
  }
  const looseDir = path.join(assetsSrcDir, 'loose');
  mkdirSync(looseDir, { recursive: true });
  let count = 0;
  for (const char of readdirSync(partsDir)) {
    const dir = path.join(partsDir, char);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
      const name = file.replace(/\.png$/, '');
      const src = path.join(dir, file);
      const out = (n) => path.join(looseDir, `part_${char}_${n}.webp`);
      const meta = await sharp(src).metadata();
      if (name === 'head') {
        const scale = HEAD_H / meta.height;
        if (char === 'mia' && meta.width > meta.height * 1.4) {
          const cut = Math.round(meta.width * MIA_CUT);
          const over = Math.round(meta.width * MIA_OVERLAP);
          await save(sharp(src).extract({ left: 0, top: 0, width: cut + over, height: meta.height }), out('ponytail'), scale);
          await save(sharp(src).extract({ left: cut, top: 0, width: meta.width - cut, height: meta.height }), out('head'), scale);
          count += 2;
          continue;
        }
        await save(sharp(src), out('head'), scale);
      } else if(name.startsWith('ponytail')) {
        // Register long strands and blindfold ribbons by length, not thickness.
        await save(sharp(src),out(name),char==='tee'||char==='dragon'?180/meta.width:HEAD_H/meta.height);
      } else if (name === 'torso') {
        await save(sharp(src), out('torso'), TORSO_H / meta.height);
      } else if (name.startsWith('glove')) {
        await save(sharp(src), out(name), GLOVE_H / meta.height);
      } else if (name.startsWith('boot')) {
        await save(sharp(src), out(name), BOOT_W / meta.width);
      } else continue;
      count++;
    }
  }
  applyTorsoOverrides(assetsSrcDir);
  console.log(`prepare-assets: wrote ${count} boxer part(s) to ${path.relative(process.cwd(), looseDir)}`);
}
