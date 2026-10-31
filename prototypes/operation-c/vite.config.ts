import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVersionStamps } from '../../scripts/generate-versions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
generateVersionStamps(path.resolve(here, '../..'));
export default defineConfig({
  root: here,
  base: './',
  publicDir: false,
  server: { host: '127.0.0.1', fs: { allow: [path.resolve(here, '../..')] } },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 1600 },
});
