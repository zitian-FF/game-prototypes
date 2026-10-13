// Offline, reviewable cleanup. Never uploads, deletes R2 objects or alters the input ZIP.
// Run after packing the original sources: node scripts/clean-punchies-assets.mjs original.zip output-directory
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Expected original ZIP and output directory');
fs.mkdirSync(output, {recursive:true});
const original = new AdmZip(input), active = new AdmZip();
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Audited against artImage/artKey/backdrop, puppet/skins, tutorial and shop call sites.
// Ring fallbacks, token fallback, packed poses/feet/effects intentionally remain.
const unused = new Set(['arena_cap_blue','arena_cap_neutral','arena_cap_red','arena_rope',
  'chest_fighter','chest_skin','reward_ad','stage_background','ui_button','ui_hud','ui_knob','ui_stick','ui_touch']);
const loose = 'public/prototypes/punchies/assets/loose';
const aliases = JSON.parse(fs.readFileSync(path.join(loose,'part-mirrors.json'),'utf8'));
const inventory = [];
for (const entry of original.getEntries().filter(e=>!e.isDirectory)) {
  const bytes = entry.getData(), name = path.posix.parse(entry.entryName).name;
  let reason, destination;
  if (entry.entryName.startsWith('parts/')) reason = 'Full-quality design master; active build retains prepared registered part';
  else if (/^packed\/(marco|mia|bruno)_alt_/.test(entry.entryName)) reason = 'Obsolete starter palette animation; runtime recolours base art';
  else if (entry.entryName.startsWith('loose/') && unused.has(name)) reason = 'Superseded artwork; no reachable runtime key in audited screens';
  else if (entry.entryName.startsWith('loose/') && aliases[name]) reason = 'Pixel-verified mirror; persistent alias derives from canonical part';
  else if (entry.entryName.startsWith('packed/')) {
    active.addFile(entry.entryName,bytes); destination = entry.entryName;
    reason = 'Retain registered animation, effect and fallback source (including playable consumer)';
  } else if (entry.entryName.startsWith('loose/')) {
    const available = fs.readdirSync(loose).find(f=>path.parse(f).name===name);
    if (!available) throw new Error(`Missing active counterpart: ${entry.entryName}`);
    destination = `loose/${available}`;
    reason = bytes.equals(fs.readFileSync(path.join(loose,available))) ? 'Retain reachable runtime artwork' : 'Archive original; retain prepared/optimized reachable counterpart';
  } else throw new Error(`Unclassified ZIP entry: ${entry.entryName}`);
  inventory.push({path:entry.entryName,bytes:bytes.length,sha256:hash(bytes),destination:destination??'Drive archive',reason});
}
for (const file of fs.readdirSync(loose)) {
  if (unused.has(path.parse(file).name) || file==='part-mirrors.json') continue;
  // Existing main still applies these framing crops. Keep their full registered
  // canvas in the active ZIP so both old and new packers crop exactly once.
  if (['portrait_tyke','portrait_longan'].includes(path.parse(file).name)) {
    const source = original.getEntry(`loose/${path.parse(file).name}.png`).getData();
    active.addFile(`loose/${file}`,await sharp(source).webp({lossless:true,effort:6}).toBuffer());
  } else active.addFile(`loose/${file}`,fs.readFileSync(path.join(loose,file)));
}
active.addFile('part-mirrors.json',Buffer.from(JSON.stringify(aliases,null,2)));
active.addFile('active-assets.json',Buffer.from(JSON.stringify({schema:1,framedPortraits:false,preparedParts:true,originalSha256:hash(fs.readFileSync(input))},null,2)));
for (const entry of active.getEntries()) entry.header.time = new Date(2000,0,1);
const activeBytes = active.toBuffer();
fs.writeFileSync(path.join(output,'punchies-assets-active.zip'),activeBytes);
const result={originalSha256:hash(fs.readFileSync(input)),activeSha256:hash(activeBytes),originalBytes:fs.statSync(input).size,activeBytes:activeBytes.length,aliases,files:inventory,
  activeFiles:active.getEntries().filter(e=>!e.isDirectory).map(e=>({path:e.entryName,bytes:e.header.size,sha256:hash(e.getData())}))};
fs.writeFileSync(path.join(output,'cleanup-manifest.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({originalBytes:result.originalBytes,activeBytes:result.activeBytes,files:inventory.length,aliases:Object.keys(aliases).length}));
