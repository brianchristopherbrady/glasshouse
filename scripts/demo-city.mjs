// One command to demo Glasshouse on the Agentic City workspace:
//
//   npm run demo
//
// Starts the API on 127.0.0.1:4410 (loopback only, auth disabled) and the web
// UI on localhost:5410, registers examples/agentic-city as "Agentic City
// (local)", and points the city's hook recorder at the API. Ports can be
// changed with DEMO_API_PORT / DEMO_WEB_PORT.
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = join(repoRoot, 'apps', 'server');
const cityRoot = join(repoRoot, 'examples', 'agentic-city');
const API_PORT = Number(process.env.DEMO_API_PORT ?? 4410);
const WEB_PORT = Number(process.env.DEMO_WEB_PORT ?? 5410);
const apiUrl = `http://127.0.0.1:${API_PORT}`;
const webUrl = `http://localhost:${WEB_PORT}`;
const require = createRequire(import.meta.url);
const children = [];

function inUse(port, host) {
  return new Promise((done) => {
    const socket = createConnection({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
}

function runNode(script, args, cwd, env = process.env) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${args.join(' ')} failed (exit ${result.status})`);
}

function start(label, command, env) {
  // A single command string (no args array) keeps shell: true free of
  // argument-injection concerns; every part of it is a constant.
  const child = spawn(command, { cwd: repoRoot, env, shell: true, stdio: 'inherit' });
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`\n${label} exited (code ${code}). Stopping the demo.`);
      stop(1);
    }
  });
  children.push(child);
}

let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exit(code);
}

async function waitForApi() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiUrl}/api/ready`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`the API did not become ready at ${apiUrl}`);
}

async function api(path, init) {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok)
    throw new Error(
      `${init?.method ?? 'GET'} ${path} failed: HTTP ${res.status} ${await res.text()}`,
    );
  return res.json();
}

async function main() {
  for (const [port, name] of [
    [API_PORT, 'DEMO_API_PORT'],
    [WEB_PORT, 'DEMO_WEB_PORT'],
  ]) {
    if ((await inUse(port, '127.0.0.1')) || (await inUse(port, '::1'))) {
      throw new Error(`port ${port} is already in use. Stop that process or set ${name}.`);
    }
  }

  // Pin the database explicitly so the demo doesn't depend on where the
  // Prisma client was generated from (that decides which .env it auto-loads).
  // Relative SQLite paths are relative to prisma/schema.prisma, as in Prisma.
  const env = { ...process.env };
  if (!env.DATABASE_URL) {
    let url = 'file:./dev.db';
    try {
      const line = readFileSync(join(serverDir, '.env'), 'utf8')
        .split(/\r?\n/)
        .find((l) => /^\s*DATABASE_URL\s*=/.test(l));
      if (line)
        url = line
          .split('=')
          .slice(1)
          .join('=')
          .trim()
          .replace(/^["']|["']$/g, '');
    } catch {
      // no .env: use the default dev database
    }
    const relativeFile = /^file:(\.{1,2}[\\/].*)$/.exec(url);
    env.DATABASE_URL = relativeFile ? `file:${resolve(serverDir, 'prisma', relativeFile[1])}` : url;
  }

  console.log('Building shared packages…');
  runNode(
    require.resolve('typescript/bin/tsc'),
    ['-b', 'packages/parser', 'packages/telemetry-client'],
    repoRoot,
  );
  console.log('Applying database migrations…');
  runNode(require.resolve('prisma/build/index.js'), ['migrate', 'deploy'], serverDir, env);

  const serverEnv = {
    ...env,
    PORT: String(API_PORT),
    HOST: '127.0.0.1',
    GLASSHOUSE_ALLOWED_ORIGINS: webUrl,
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn', // the UI polls; keep the terminal readable
  };
  delete serverEnv.GLASSHOUSE_API_TOKEN; // loopback-only demo: no auth
  start('API server', 'npm run dev --workspace apps/server', serverEnv);
  start(
    'Web UI',
    `npm run dev --workspace apps/web -- --port ${WEB_PORT} --strictPort --clearScreen false`,
    { ...process.env, GLASSHOUSE_API_PROXY: apiUrl },
  );

  await waitForApi();
  const repositories = await api('/api/repositories');
  if (repositories.length === 0) {
    console.log('Empty database: seeding the acme/payments sample repository…');
    const seed = spawnSync('npm run db:seed', {
      cwd: repoRoot,
      env,
      shell: true,
      stdio: 'inherit',
    });
    if (seed.status !== 0) throw new Error('seeding failed');
  }
  const { repository, synced } = await api('/api/repositories/local', {
    method: 'POST',
    body: JSON.stringify({ path: cityRoot }),
  });
  mkdirSync(join(cityRoot, '.city-recorder'), { recursive: true });
  writeFileSync(
    join(cityRoot, '.city-recorder', 'config.json'),
    JSON.stringify({ serverUrl: apiUrl, webUrl, repository: repository.fullName }, null, 2),
  );

  console.log(`
────────────────────────────────────────────────────────────────────
 Glasshouse demo is running
   Web UI  ${webUrl}/repos/${repository.id}/runs
   API     ${apiUrl}  (loopback only, auth disabled)

 Registered "Agentic City (local)": ${synced.agents} agents, ${synced.skills} skills,
 ${synced.prompts} prompts, ${synced.instructions} instructions, ${synced.relationships} relationships.

 Next:
   1. Open the city in its own VS Code window:  code examples/agentic-city
   2. Trust the folder, open Copilot Chat with the Local agent, and run:
        /found-district Noodle Heights, built on a retired noodle factory
   3. Watch the run appear (and update live) under Runs.
 No Copilot handy? In another terminal:  npm run city:replay
 Reset the city afterwards:              npm run city:reset
 Press Ctrl+C to stop.
────────────────────────────────────────────────────────────────────
`);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
main().catch((err) => {
  console.error(`\nDemo failed: ${err.message}`);
  stop(1);
});
