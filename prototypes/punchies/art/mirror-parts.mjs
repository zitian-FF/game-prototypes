import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Only collapse verified pixel-exact mirrors. Distinct lighting/anatomy stays authored.
export default async function mirroredParts(assetsSrcDir) {
  const saved = path.join(assetsSrcDir, 'part-mirrors.json');
  if (existsSync(saved)) {
    const aliases = JSON.parse(readFileSync(saved, 'utf8'));
    for (const [target, alias] of Object.entries(aliases)) {
      if (!/^part_[a-z_]+$/.test(target) || !/^part_[a-z_]+$/.test(alias.source) || !['x', 'y'].includes(alias.axis)
        || !existsSync(path.join(assetsSrcDir, 'loose', `${alias.source}.webp`))) throw new Error(`Invalid mirror alias: ${target}`);
    }
    return aliases;
  }
  const root = path.join(assetsSrcDir, 'parts');
  const result = {};
  if (!existsSync(root)) return result;
  for (const char of readdirSync(root)) {
    for (const part of ['glove', 'boot']) {
      const right = path.join(root, char, `${part}_right.png`);
      const left = path.join(root, char, `${part}_left.png`);
      if (!existsSync(right) || !existsSync(left)) continue;
      const target = await sharp(left).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const axis of ['flop', 'flip']) {
        const source = await sharp(right)[axis]().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        if (source.info.width !== target.info.width || source.info.height !== target.info.height || !source.data.equals(target.data)) continue;
        result[`part_${char}_${part}_left`] = { source: `part_${char}_${part}_right`, axis: axis === 'flop' ? 'x' : 'y' };
        break;
      }
    }
  }
  return result;
}
