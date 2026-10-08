import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Separate build for the playable: its own root, its own output folder, and
// not part of the repo's root multi-entry build (that only scans
// prototypes/*/index.html, and this entry lives in app/).
// Build: npm run build:punchies-playable
const here = path.dirname(fileURLToPath(import.meta.url));
const hasArt = fs.existsSync(path.join(here, 'public/art/index.json'));

export default defineConfig({
  root: path.join(here, 'app'),
  base: './',
  publicDir: path.join(here, 'public'),
  define: { __HAS_ART__: JSON.stringify(hasArt) },
  server: { fs: { allow: [here, path.resolve(here, '../..')] } },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
