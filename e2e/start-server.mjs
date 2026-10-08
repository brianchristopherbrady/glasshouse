// Boots the real packaged server for E2E: seeds a throwaway SQLite database,
// then starts apps/server/bin/agentic-flows.mjs (bundle + built web UI) with
// authentication enabled — the same entry point a real install runs.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_PORT = 4310;
export const E2E_ADMIN_TOKEN = 'e2e-bootstrap-admin-token';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const serverDir = path.join(root, 'apps/server');
const require = createRequire(path.join(serverDir, 'package.json'));
const dataDir = mkdtempSync(path.join(tmpdir(), 'agentic-flows-e2e-'));

const env = {
  ...process.env,
  DATABASE_URL: `file:${path.join(dataDir, 'e2e.db')}`,
  AGENTIC_FLOWS_DATA_DIR: dataDir,
  AGENTIC_FLOWS_API_TOKEN: E2E_ADMIN_TOKEN,
  AGENTIC_FLOWS_GITHUB_WEBHOOK_SECRET: 'e2e-webhook-secret',
  PORT: String(E2E_PORT),
  HOST: '127.0.0.1',
  PRISMA_HIDE_UPDATE_MESSAGE: '1',
};

const run = (args) =>
  execFileSync(process.execPath, args, { cwd: serverDir, env, stdio: 'inherit' });
run([
  require.resolve('prisma/build/index.js'),
  'migrate',
  'deploy',
  '--schema',
  'prisma/schema.prisma',
]);
run([require.resolve('tsx/cli'), 'prisma/seed.ts']);

const server = spawn(process.execPath, [path.join(serverDir, 'bin/agentic-flows.mjs')], {
  env,
  stdio: 'inherit',
});
const stop = () => server.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
server.on('exit', (code) => {
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
