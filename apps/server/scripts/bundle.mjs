// Bundles the compiled server (which, via node_modules workspace symlinks,
// still pulls in @agentic-flows/domain and @agentic-flows/parser at this
// point) into a single self-contained ESM file. Real third-party npm
// packages stay external/unbundled — @prisma/client in particular resolves
// its native query-engine binary relative to its own installed location,
// which would break if inlined.
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

await build({
  entryPoints: [path.join(root, 'dist/src/index.js')],
  outfile: path.join(root, 'dist/bundle.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  external: ['fastify', '@fastify/cors', '@fastify/static', '@prisma/client', 'zod'],
  logLevel: 'info',
});
