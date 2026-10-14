import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const sourceDir = fileURLToPath(new URL('../prototypes/punchies/art/logo/', import.meta.url));
export const LOGO_HASHES = {
  standard: 'ec29006ecab069522f00ba3469e535a0ad8b8cc2bd0e6545ba1b251973cbb1d9',
  compact: '989f16bdf606205fceceb38674169bf3cbb84b7326f156e65eed59e033e742eb',
};

// Apply after source archives/overlays, before embedding the asset manifest.
// Old R2 archives cannot silently bring back a damaged wordmark.
export function applyCanonicalLogo(assetDir, profile = 'standard', entries = null) {
  if (!(profile in LOGO_HASHES)) throw Error(`Unknown logo profile: ${profile}`);
  const bytes = fs.readFileSync(path.join(sourceDir, `logo-${profile}.webp`));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (hash !== LOGO_HASHES[profile]) throw Error(`Canonical ${profile} logo hash mismatch`);
  const loose = path.join(assetDir, 'loose');
  fs.mkdirSync(loose, {recursive:true});
  // Same-basename alternatives would register the same texture key twice.
  // punch_logo is a glove icon and intentionally remains untouched.
  for (const extension of ['png','jpg','jpeg']) fs.rmSync(path.join(loose, `logo.${extension}`), {force:true});
  fs.writeFileSync(path.join(loose, 'logo.webp'), bytes);
  const manifestFile = path.join(assetDir, 'manifest.json');
  const manifest = entries ?? JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (let i = manifest.length-1; i >= 0; i--) {
    if (/^loose\/logo\.(png|webp|jpg|jpeg)$/.test(manifest[i].path)) manifest.splice(i, 1);
  }
  manifest.push({path:'loose/logo.webp', hash});
  if (!entries) fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  return {key:'logo', path:'loose/logo.webp', hash, profile, bytes:bytes.length};
}
