import { build } from 'esbuild';

// Loads TypeScript game modules into node for scripts and tests (portal defaults to the web adapter).
export async function loadTs(entry, exportsList) {
  const out = await build({
    stdin: { contents: `export { ${exportsList.join(', ')} } from '${entry}';`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.json': 'json' },
    define: { __PUNCHIES_PORTAL__: '"web"', __PUNCHIES_PORTAL_ADS__: 'true' },
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}#${Math.random()}`);
}
