// Music stays outside Git. Stage the approved downloads before local/release builds.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/stage-punchies-music.mjs <approved-music-folder>');
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/prototypes/punchies/audio');
const files = ['title.mp3', 'charselect.mp3', 'gameplay.mp3'];
for (const file of files) if (!fs.statSync(path.join(source, file)).isFile()) throw new Error(`Missing ${file}`);
fs.mkdirSync(target, { recursive: true });
for (const file of files) fs.copyFileSync(path.join(source, file), path.join(target, file));
console.log('Staged title, character-select and gameplay music.');
