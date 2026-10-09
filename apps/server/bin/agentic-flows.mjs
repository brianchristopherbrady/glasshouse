#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const packageRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const require = createRequire(import.meta.url);

function resolveDataDir() {
  const override = process.env.AGENTIC_FLOWS_DATA_DIR;
  const dir = override ? path.resolve(override) : path.join(homedir(), '.agentic-flows');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function selectSchema(databaseUrl) {
  const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
  return path.join(
    packageRoot,
    'prisma',
    ...(isPostgres ? ['postgres', 'schema.prisma'] : ['schema.prisma']),
  );
}

// Invoke Prisma's CLI entry script directly rather than `npx prisma` — spawning
// a .cmd shim without shell:true fails on Windows, and this avoids depending
// on `prisma` being on PATH. require.resolve is robust to npm hoisting.
function prisma(args) {
  const prismaCli = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, ...args], {
    stdio: 'inherit',
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  });
}

/**
 * The generated client is provider-specific and, for an npm-installed
 * package, may not exist at all. Prisma reformats its copy of the schema, so
 * freshness is tracked with our own hash marker next to the generated client.
 */
function ensureClientGenerated(schemaPath) {
  const wanted = createHash('sha256').update(readFileSync(schemaPath)).digest('hex');
  let marker = null;
  try {
    const clientRequire = createRequire(require.resolve('@prisma/client/package.json'));
    marker = path.join(
      path.dirname(clientRequire.resolve('.prisma/client/package.json')),
      '.agentic-flows-schema',
    );
    if (readFileSync(marker, 'utf8') === wanted) return;
  } catch {
    // no generated client or no marker yet
  }
  console.log(
    'agentic-flows: generating database client for',
    path.relative(packageRoot, schemaPath),
  );
  prisma(['generate', '--schema', schemaPath]);
  const clientRequire = createRequire(require.resolve('@prisma/client/package.json'));
  marker = path.join(
    path.dirname(clientRequire.resolve('.prisma/client/package.json')),
    '.agentic-flows-schema',
  );
  writeFileSync(marker, wanted);
}

async function start() {
  const dataDir = resolveDataDir();
  // A real env var always wins — lets a user point at their own Postgres
  // instead of the default per-install SQLite file.
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.join(dataDir, 'data.db')}`;
  }
  const schemaPath = selectSchema(process.env.DATABASE_URL);
  ensureClientGenerated(schemaPath);
  prisma(['migrate', 'deploy', '--schema', schemaPath]);

  if (!existsSync(path.join(packageRoot, 'dist', 'bundle.mjs'))) {
    console.error('agentic-flows: build output missing — run `npm run build` first.');
    process.exit(1);
  }

  await import(new URL('../dist/bundle.mjs', import.meta.url));
}

// Reads an ndjson file (one JSON event per line, e.g. written by
// @brianbrady/glasshouse-telemetry-client's appendEventToFile) and forwards it to a
// running server's batch telemetry endpoint. Deliberately reimplements the
// tiny bit of ndjson-parsing logic inline rather than depending on the
// telemetry-client package here — keeps that package a zero-runtime-deps,
// independently publishable unit, and keeps this CLI's own runtime deps
// exactly the set that gets bundled/published (see repo notes).
async function ingest(filePath, baseUrl) {
  if (!filePath) {
    console.error('agentic-flows: usage: agentic-flows ingest <file.ndjson> [--url <serverUrl>]');
    process.exit(1);
  }
  const events = [];
  for (const line of readFileSync(path.resolve(filePath), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      console.warn(`agentic-flows: skipping malformed line in ${filePath}`);
    }
  }
  if (events.length === 0) {
    console.log('agentic-flows: no events to ingest.');
    return;
  }
  const url = `${baseUrl.replace(/\/$/, '')}/api/telemetry/batch`;
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.AGENTIC_FLOWS_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.AGENTIC_FLOWS_API_TOKEN}`;
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ events }) });
  if (!res.ok) {
    console.error(
      `agentic-flows: ingest failed: ${res.status} ${await res.text().catch(() => '')}`,
    );
    process.exit(1);
  }
  console.log(`agentic-flows: ingested ${events.length} event(s) from ${filePath}.`);
}

const USAGE = `Usage:
  agentic-flows [start]                         run migrations, then start the server
  agentic-flows ingest <file.ndjson> [--url U]  forward offline-captured telemetry
  agentic-flows generate                        generate the database client for DATABASE_URL
  agentic-flows --version | --help

Configuration is via environment variables — see the README.`;

const [command, ...rest] = process.argv.slice(2);

if (command === 'ingest') {
  const urlFlagIndex = rest.indexOf('--url');
  const baseUrl =
    urlFlagIndex !== -1 ? rest[urlFlagIndex + 1] : `http://localhost:${process.env.PORT ?? 4000}`;
  const positional =
    urlFlagIndex === -1
      ? rest
      : rest.filter((_, i) => i !== urlFlagIndex && i !== urlFlagIndex + 1);
  await ingest(positional[0], baseUrl);
} else if (command === undefined || command === 'start') {
  await start();
} else if (command === 'generate') {
  ensureClientGenerated(selectSchema(process.env.DATABASE_URL ?? ''));
} else if (command === '--help' || command === '-h' || command === 'help') {
  console.log(USAGE);
} else if (command === '--version' || command === '-v') {
  console.log(JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version);
} else {
  console.error(`agentic-flows: unrecognized command "${command}".\n\n${USAGE}`);
  process.exit(1);
}
