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

// Optional packed art index: generated from the R2 source folders by the
// packer. An art-free checkout boots the existing procedural fallback.
function punchiesArtIndex(): unknown {
  const dir = path.resolve(__dirname, 'public/prototypes/punchies/assets');
  const read = (file: string, fallback: unknown) => fs.existsSync(path.join(dir, file))
    ? JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) : fallback;
  return { manifest: read('manifest.json', []), animations: read('atlas/animations.json', {}) };
}

export default defineConfig(({ command }) => ({
  base: '/game-prototypes/',
  plugins: [react(), tailwindcss()],
  define: {
    __GIT_SHA__: JSON.stringify(getGitSha()),
    __PUNCHIES_ART__: JSON.stringify(punchiesArtIndex()),
    __PUNCHIES_ASSET_BASE__: JSON.stringify(command === 'serve' ? '/game-prototypes/' : '../../'),
  },
  build: {
    rollupOptions: {
      input: getPrototypeEntries(),
    },
  },
}));
