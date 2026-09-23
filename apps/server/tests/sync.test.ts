import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { syncRepositoryFromDisk } from '../src/sync.js';

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/parser/tests/fixtures/acme-payments',
);

let prisma: PrismaClient;
let tmpDbDir: string;
let repositoryId: string;

beforeAll(async () => {
  // Real SQLite db in a throwaway temp dir, migrated via the actual schema
  // — this exercises the real Prisma client/schema, not a mock.
  tmpDbDir = mkdtempSync(join(tmpdir(), 'agentic-flows-sync-test-'));
  const dbPath = join(tmpDbDir, 'test.db');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../prisma/schema.prisma');
  execSync(`npx prisma db push --schema "${schemaPath}" --skip-generate`, {
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: 'pipe',
  });

  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  const repo = await prisma.repository.create({
    data: {
      owner: 'acme',
      name: 'payments',
      fullName: 'acme/payments-sync-test',
      defaultBranch: 'main',
      provider: 'github',
      providerRepoId: 'test-1',
    },
  });
  repositoryId = repo.id;
}, 30_000);

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(tmpDbDir, { recursive: true, force: true });
});

describe('syncRepositoryFromDisk', () => {
  it('persists discovered definitions and returns accurate counts', async () => {
    const summary = await syncRepositoryFromDisk(prisma, repositoryId, FIXTURE_DIR);
    expect(summary).toEqual({
      workflows: 2,
      agents: 2,
      skills: 2,
      instructions: 3,
      prompts: 1,
      hooks: 1,
      mcpServers: 1,
      relationships: 4,
    });
  }, 20_000);

  it('gives the compiled workflow a distinct id from its parent workflow', async () => {
    const rel = await prisma.definitionRelationship.findFirst({
      where: { repositoryId, relationshipType: 'COMPILES_TO' },
    });
    expect(rel).toBeTruthy();
    expect(rel?.sourceDefinitionId).not.toBe(rel?.targetDefinitionId);

    const compiled = await prisma.compiledWorkflow.findUnique({
      where: { id: rel?.targetDefinitionId },
    });
    expect(compiled).toBeTruthy();
  });

  it('is idempotent: re-syncing the same repo does not duplicate rows', async () => {
    await syncRepositoryFromDisk(prisma, repositoryId, FIXTURE_DIR);
    const workflows = await prisma.workflowDefinition.findMany({ where: { repositoryId } });
    const relationships = await prisma.definitionRelationship.findMany({
      where: { repositoryId },
    });
    expect(workflows).toHaveLength(2);
    expect(relationships).toHaveLength(4);
  }, 20_000);
});
