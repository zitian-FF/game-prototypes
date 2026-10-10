import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { generateVersionStamps } from './scripts/generate-versions.js';

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

function getPrototypeEntries(): Record<string, string> {
  if (process.env.PUNCHIES_ASSET_PROFILE) return { punchies: path.resolve(__dirname, 'prototypes/punchies/index.html') };
  const entries: Record<string, string> = {
    main: path.resolve(__dirname, 'index.html'),
  };
  const protoDir = path.resolve(__dirname, 'prototypes');
  if (!fs.existsSync(protoDir)) return entries;
  for (const name of fs.readdirSync(protoDir)) {
    const htmlPath = path.join(protoDir, name, 'index.html');
    if (fs.existsSync(htmlPath)) {
      entries[name] = htmlPath;
    }
  }
  return entries;
}

generateVersionStamps(__dirname);
const assetProfile = process.env.PUNCHIES_ASSET_PROFILE;
if (assetProfile) {
  if (!['standard', 'compact'].includes(assetProfile) || !process.env.PUNCHIES_PUBLIC_DIR) throw new Error('Use the Punchies profile build scripts to prepare isolated assets');
  const record = JSON.parse(fs.readFileSync(path.join(process.env.PUNCHIES_PUBLIC_DIR, 'prototypes/punchies/asset-profile.json'), 'utf8'));
  if (record.profile !== assetProfile || record.portal !== (process.env.PORTAL ?? 'web')) throw new Error('Staged assets do not match the requested profile/portal');
}

// Optional packed art index: generated from the R2 source folders by the
// packer. An art-free checkout boots the existing procedural fallback.
function punchiesArtIndex(): unknown {
  const dir = path.resolve(process.env.PUNCHIES_PUBLIC_DIR ?? path.join(__dirname, 'public'), 'prototypes/punchies/assets');
  const read = (file: string, fallback: unknown) => fs.existsSync(path.join(dir, file))
    ? JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) : fallback;
  return { manifest: read('manifest.json', []), animations: read('atlas/animations.json', {}), groups: read('atlas/groups.json', {}) };
}

export default defineConfig(({ command }) => ({
  root: assetProfile ? path.resolve(__dirname, 'prototypes/punchies') : __dirname,
  base: '/game-prototypes/',
  publicDir: process.env.PUNCHIES_PUBLIC_DIR ?? 'public',
  plugins: [react(), tailwindcss()],
  define: {
    __GIT_SHA__: JSON.stringify(getGitSha()),
    __PUNCHIES_ART__: JSON.stringify(punchiesArtIndex()),
    __PUNCHIES_PORTAL__: JSON.stringify(process.env.PORTAL ?? 'web'),
    __PUNCHIES_MUSIC_EXTENSION__: JSON.stringify(process.env.PUNCHIES_ASSET_PROFILE === 'compact' ? 'm4a' : 'mp3'),
    __PUNCHIES_PORTAL_ADS__: JSON.stringify(process.env.PORTAL_ADS !== 'off'),
    // PORTAL_FIXED_ALIAS=on: a portal that forbids user-generated text gets generated or platform names only.
    __PUNCHIES_FIXED_ALIAS__: JSON.stringify(process.env.PORTAL_FIXED_ALIAS === 'on'),
    __PUNCHIES_ASSET_BASE__: JSON.stringify(assetProfile ? './' : command === 'serve' ? '/game-prototypes/' : '../../'),
  },
  build: {
    rollupOptions: {
      input: getPrototypeEntries(),
    },
  },
}));
