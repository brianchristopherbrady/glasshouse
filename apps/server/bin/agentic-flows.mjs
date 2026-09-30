#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const packageRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const require = createRequire(import.meta.url);

function resolveDataDir() {
  const override = process.env.AGENTIC_FLOWS_DATA_DIR;
  const dir = override ? path.resolve(override) : path.join(homedir(), '.agentic-flows');
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function start() {
  const dataDir = resolveDataDir();
  // A real env var always wins — lets a user point at their own Postgres/etc
  // instead of the default per-install SQLite file.
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.join(dataDir, 'data.db')}`;
  }

  // Invoke Prisma's CLI entry script directly rather than `npx prisma` — spawning
  // a .cmd shim without shell:true fails on Windows (see repo notes), and this
  // avoids depending on `prisma` being globally installed or resolvable via PATH.
  // Resolved via real module resolution (not a hardcoded node_modules path) so
  // this works regardless of npm workspace hoisting.
  const prismaCli = require.resolve('prisma/build/index.js');
  const schemaPath = path.join(packageRoot, 'prisma', 'schema.prisma');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], {
    stdio: 'inherit',
    env: process.env,
  });

  if (!existsSync(path.join(packageRoot, 'dist', 'bundle.mjs'))) {
    console.error('agentic-flows: build output missing — run `npm run build` first.');
    process.exit(1);
  }

  await import(new URL('../dist/bundle.mjs', import.meta.url));
}

// Reads an ndjson file (one JSON event per line, e.g. written by
// @agentic-flows/telemetry-client's appendEventToFile) and forwards it to a
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
    console.error(`agentic-flows: ingest failed: ${res.status} ${await res.text().catch(() => '')}`);
    process.exit(1);
  }
  console.log(`agentic-flows: ingested ${events.length} event(s) from ${filePath}.`);
}

const [command, ...rest] = process.argv.slice(2);

if (command === 'ingest') {
  const urlFlagIndex = rest.indexOf('--url');
  const baseUrl =
    urlFlagIndex !== -1 ? rest[urlFlagIndex + 1] : `http://localhost:${process.env.PORT ?? 4000}`;
  const filePath = rest.filter((_, i) => i !== urlFlagIndex && i !== urlFlagIndex + 1)[0];
  await ingest(filePath, baseUrl);
} else if (command === undefined || command === 'start') {
  await start();
} else {
  console.error(`agentic-flows: unrecognized command "${command}". Usage: agentic-flows [start|ingest <file>]`);
  process.exit(1);
}
