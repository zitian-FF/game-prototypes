// Runs the arena-sim tests headlessly. The sources use extensionless,
// bundler-resolved imports (same as the rest of the repo), so they are
// loaded through Vite's SSR module graph, which is already a dependency,
// instead of adding a TS runner or test framework.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv[2];

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'warn',
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

let failed = 0;
let passed = 0;
try {
  const files = readdirSync(path.join(root, 'test')).filter((f) => f.endsWith('.test.ts'));
  for (const f of files) await server.ssrLoadModule(`/test/${f}`);
  const { getTests } = await server.ssrLoadModule('/test/harness.ts');
  for (const t of getTests()) {
    if (filter && !t.name.includes(filter)) continue;
    const start = performance.now();
    try {
      await t.fn();
      passed++;
      console.log(`  ok   ${t.name} (${Math.round(performance.now() - start)}ms)`);
    } catch (err) {
      failed++;
      console.log(`  FAIL ${t.name}`);
      console.log(String(err && err.stack ? err.stack : err).split('\n').map((l) => `       ${l}`).join('\n'));
    }
  }
} finally {
  await server.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
