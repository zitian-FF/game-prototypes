// Builds the playable's small art set from the fetched Punchies art
// (prototypes/punchies-playable/assets-src, see scripts/fetch-assets.js).
// The main game now draws boxers as a puppet rig from loose parts, so this
// copies only what the playable uses: the rig parts of marco (player) and
// zombie (enemies), a portrait crop of the gym floor, the ring rope,
// the jab and cross glove icons and the logo. Output goes to public/art
// (git-ignored) with an index.json listing every texture.
//
//   node scripts/fetch-assets.js punchies-playable punchies_assets.zip
//   node prototypes/punchies-playable/scripts/prepare-art.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const proto = path.resolve(here, '..');
const src = path.join(proto, 'assets-src/loose');
const out = path.join(proto, 'public/art');

const CHARS = ['marco', 'zombie'];
const PARTS = ['head', 'torso', 'glove_right', 'boot_right'];
const COPY = ['ring_rope', 'icon_jab', 'icon_cross', 'logo'];
// Left glove and boot are mirrors of the right ones. The runtime flips them:
// glove on x, boot on y. Fail loudly if the art pipeline ever says otherwise.
const EXPECT_MIRROR = { glove: 'x', boot: 'y' };

if (!existsSync(src)) {
  console.error('prepare-art: assets-src not found. Run: node scripts/fetch-assets.js punchies-playable punchies_assets.zip');
  process.exit(1);
}

const mirrorsFile = path.join(proto, 'assets-src/part-mirrors.json');
const mirrors = existsSync(mirrorsFile) ? JSON.parse(readFileSync(mirrorsFile, 'utf8')) : {};
for (const c of CHARS) {
  for (const kind of ['glove', 'boot']) {
    const m = mirrors[`part_${c}_${kind}_left`];
    if (m && (m.source !== `part_${c}_${kind}_right` || m.axis !== EXPECT_MIRROR[kind])) {
      console.error(`prepare-art: part_${c}_${kind}_left is mirrored as ${JSON.stringify(m)}, the runtime assumes ${EXPECT_MIRROR[kind]}`);
      process.exit(1);
    }
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const keys = [];
let total = 0;
const add = (key, size) => { keys.push(key); total += size; console.log(`prepare-art: ${key}.webp ${(size / 1024).toFixed(0)} KB`); };
const need = (key) => {
  const f = path.join(src, `${key}.webp`);
  if (!existsSync(f)) { console.error(`prepare-art: missing ${key}.webp in the art zip`); process.exit(1); }
  return f;
};

for (const c of CHARS) for (const p of PARTS) {
  const key = `part_${c}_${p}`;
  copyFileSync(need(key), path.join(out, `${key}.webp`));
  add(key, statSync(path.join(out, `${key}.webp`)).size);
}
for (const key of COPY) {
  copyFileSync(need(key), path.join(out, `${key}.webp`));
  add(key, statSync(path.join(out, `${key}.webp`)).size);
}

// Gym floor: a portrait slice from the middle of the landscape backdrop, so the
// props at the far left and right edges are cropped out and only tiles remain.
const gym = sharp(need('gym_background'));
const { width, height } = await gym.metadata();
const cropW = Math.round((height * 360) / 640);
await gym.extract({ left: Math.round((width - cropW) / 2), top: 0, width: cropW, height }).webp({ quality: 80, effort: 6 }).toFile(path.join(out, 'gym_bg.webp'));
add('gym_bg', statSync(path.join(out, 'gym_bg.webp')).size);

writeFileSync(path.join(out, 'index.json'), JSON.stringify({ keys }));
console.log(`prepare-art: ${keys.length} textures, total ${(total / 1024).toFixed(0)} KB`);
