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

export default defineConfig({
  base: '/game-prototypes/',
  plugins: [react(), tailwindcss()],
  define: {
    __GIT_SHA__: JSON.stringify(getGitSha()),
  },
  build: {
    rollupOptions: {
      input: getPrototypeEntries(),
    },
  },
});
