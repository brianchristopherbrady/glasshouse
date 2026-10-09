// Bundles the compiled server (which, via node_modules workspace symlinks,
// still pulls in the -domain and -parser workspace packages at this
// point) into a single self-contained ESM file. Real third-party npm
// packages stay external/unbundled — @prisma/client in particular resolves
// its native query-engine binary relative to its own installed location,
// which would break if inlined. Also copies the built web app into
// dist/web so the published package serves the UI on its own.
import { build } from 'esbuild';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

await build({
  entryPoints: [path.join(root, 'dist/src/index.js')],
  outfile: path.join(root, 'dist/bundle.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  // Every real runtime dependency stays external; only workspace code is inlined.
  external: Object.keys(pkg.dependencies ?? {}),
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'info',
});

// Static-demo snapshots and the GitHub Pages SPA shim are Pages-only artifacts
// that can be left in apps/web/dist by an export; never ship them in a real install.
const PAGES_ONLY = new Set(['demo-data', '404.html']);

const webDist = path.resolve(root, '../web/dist');
const target = path.join(root, 'dist/web');
rmSync(target, { recursive: true, force: true });
if (existsSync(path.join(webDist, 'index.html'))) {
  cpSync(webDist, target, {
    recursive: true,
    filter: (src) => !PAGES_ONLY.has(path.relative(webDist, src).split(path.sep)[0]),
  });
  console.log(`copied web app -> ${path.relative(root, target)}`);
} else if (process.env.REQUIRE_WEB_DIST === 'true') {
  console.error('bundle: apps/web/dist is missing — build the web app first');
  process.exit(1);
} else {
  console.warn('bundle: apps/web/dist not found; the bundle will serve the API only');
}
