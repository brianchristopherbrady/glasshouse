// Generates prisma/postgres/schema.prisma from the canonical SQLite schema so
// the two never drift by hand. Only the datasource provider differs — every
// JSON-shaped column is already a plain String, which works on both.
// `--check` exits non-zero if the committed Postgres schema is stale (CI).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prismaDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../prisma');
const source = readFileSync(path.join(prismaDir, 'schema.prisma'), 'utf8').replace(/\r\n/g, '\n');

const providerLine = /(datasource db \{\s*\n\s*provider\s*=\s*)"sqlite"/;
if (!providerLine.test(source)) {
  console.error(
    'sync-postgres-schema: could not find `provider = "sqlite"` in the datasource block',
  );
  process.exit(1);
}

const body = source.replace(/^(\/\/.*\n)+/, '').replace(providerLine, '$1"postgresql"');
const generated =
  '// GENERATED from ../schema.prisma by scripts/sync-postgres-schema.mjs — do not edit.\n' +
  '// Used automatically when DATABASE_URL is a postgres:// or postgresql:// URL.\n' +
  body;

const target = path.join(prismaDir, 'postgres', 'schema.prisma');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    // missing file is reported as stale below
  }
  if (current !== generated) {
    console.error(
      'prisma/postgres/schema.prisma is out of date — run `npm run db:sync-postgres --workspace apps/server` ' +
        'and add a matching migration under prisma/postgres/migrations.',
    );
    process.exit(1);
  }
  console.log('prisma/postgres/schema.prisma is in sync.');
} else {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, generated, 'utf8');
  console.log(`wrote ${path.relative(process.cwd(), target)}`);
}
