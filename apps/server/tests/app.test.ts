import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const BOOTSTRAP = 'test-bootstrap-token';
const WEBHOOK_SECRET = 'test-webhook-secret';
const admin = { authorization: `Bearer ${BOOTSTRAP}` };

let prisma: PrismaClient;
let app: FastifyInstance;
let tmpDir: string;
let repoId: string;
let otherRepoId: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agentic-flows-app-test-'));
  const dbUrl = `file:${join(tmpDir, 'test.db')}`;
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../prisma/schema.prisma');
  execSync(`npx prisma db push --schema "${schemaPath}" --skip-generate`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  const repo = await prisma.repository.create({
    data: {
      owner: 'acme',
      name: 'payments',
      fullName: 'acme/payments',
      defaultBranch: 'main',
      providerRepoId: '1',
    },
  });
  const other = await prisma.repository.create({
    data: {
      owner: 'acme',
      name: 'other',
      fullName: 'acme/other',
      defaultBranch: 'main',
      providerRepoId: '2',
    },
  });
  repoId = repo.id;
  otherRepoId = other.id;

  app = await buildApp({
    prisma,
    logger: false,
    resolveGithubToken: async () => undefined,
    env: {
      AGENTIC_FLOWS_API_TOKEN: BOOTSTRAP,
      AGENTIC_FLOWS_GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET,
      AGENTIC_FLOWS_WEB_DIST: join(tmpDir, 'no-web-dist'),
    },
  });
  app.get('/api/test/boom', async () => {
    throw new Error('SQLITE_ERROR: no such table: secret_internal_table');
  });
}, 60_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  await app?.close();
  await prisma?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('operational endpoints', () => {
  it('reports readiness from a real database round-trip', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('sends security headers on every response', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('never leaks internal error details from a 5xx', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/test/boom', headers: admin });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret_internal_table');
    expect(res.json()).toMatchObject({ error: 'internal_error' });
  });
});

describe('API tokens', () => {
  it('creates a viewer token shown once, enforces its role, and revokes it', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: admin,
      payload: { name: 'alice', role: 'viewer' },
    });
    expect(created.statusCode).toBe(201);
    const { id, token } = created.json() as { id: string; token: string };
    expect(token).toMatch(/^af_/);

    const listed = await app.inject({ method: 'GET', url: '/api/tokens', headers: admin });
    expect(listed.body).not.toContain(token);
    expect(listed.body).not.toContain('tokenHash');

    const viewer = { authorization: `Bearer ${token}` };
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: viewer });
    expect(me.json()).toMatchObject({ authEnabled: true, name: 'alice', role: 'viewer' });
    expect(
      (await app.inject({ method: 'GET', url: '/api/repositories', headers: viewer })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'POST', url: '/api/tokens', headers: viewer, payload: {} }))
        .statusCode,
    ).toBe(403);

    expect(
      (await app.inject({ method: 'DELETE', url: `/api/tokens/${id}`, headers: admin })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/repositories', headers: viewer })).statusCode,
    ).toBe(401);
  });
});

function event(overrides: Record<string, unknown>) {
  return {
    timestamp: '2026-10-08T12:00:00.000Z',
    data: {},
    evidence: { source: 'runtime', confidence: 'observed' },
    correlation: { repository: 'acme/payments', providerRunId: '9001' },
    ...overrides,
  };
}

describe('telemetry correlation', () => {
  it('builds a placeholder run, a nested trace, and changed files from GitHub-correlated events', async () => {
    const events = [
      event({ id: 'e1', kind: 'workflow.started', spanId: 'wf', data: { name: 'Issue Triage' } }),
      event({
        id: 'e2',
        kind: 'agent.started',
        spanId: 'agent',
        parentSpanId: 'wf',
        actor: { type: 'agent', name: 'triage-agent' },
        timestamp: '2026-10-08T12:00:01.000Z',
      }),
      event({
        id: 'e3',
        kind: 'file.modified',
        spanId: 'edit',
        parentSpanId: 'agent',
        timestamp: '2026-10-08T12:00:02.000Z',
        data: {
          path: 'src/auth.ts',
          additions: 3,
          deletions: 1,
          diff: '@@ -1 +1 @@\n-old\n+new token=ghp_abcdefghijklmnopqrstuvwxyz0123456789',
        },
      }),
      event({
        id: 'e4',
        kind: 'tool.completed',
        spanId: 'tool',
        parentSpanId: 'agent',
        timestamp: '2026-10-08T12:00:03.000Z',
        data: { toolName: 'npm test', category: 'shell', durationMs: 900 },
      }),
      event({
        id: 'e5',
        kind: 'agent.completed',
        spanId: 'agent',
        timestamp: '2026-10-08T12:00:04.000Z',
      }),
      event({
        id: 'e6',
        kind: 'workflow.completed',
        spanId: 'wf',
        timestamp: '2026-10-08T12:00:05.000Z',
      }),
    ];
    const res = await app.inject({
      method: 'POST',
      url: '/api/telemetry/batch',
      headers: admin,
      payload: { events },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ ingested: 6, duplicates: 0 });

    const run = await prisma.workflowRun.findUniqueOrThrow({
      where: { repositoryId_providerRunId: { repositoryId: repoId, providerRunId: '9001' } },
    });
    expect(run.status).toBe('success');
    expect(run.durationMs).toBe(5000);

    const trace = (
      await app.inject({ method: 'GET', url: `/api/runs/${run.id}/trace`, headers: admin })
    ).json();
    expect(trace.trace).toHaveLength(1);
    const root = trace.trace[0];
    expect(root).toMatchObject({
      type: 'workflow',
      name: 'Issue Triage',
      status: 'success',
      durationMs: 5000,
    });
    const agent = root.children[0];
    expect(agent).toMatchObject({ type: 'agent', name: 'triage-agent', durationMs: 3000 });
    expect(agent.children.map((c: { name: string }) => c.name)).toEqual([
      'src/auth.ts',
      'npm test',
    ]);

    const files = (
      await app.inject({ method: 'GET', url: `/api/runs/${run.id}/files`, headers: admin })
    ).json();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: 'src/auth.ts',
      operation: 'modified',
      additions: 3,
      evidenceSource: 'runtime',
    });
    expect(files[0].diff).toContain('[REDACTED]');
    expect(files[0].diff).not.toContain('ghp_');

    const tools = (
      await app.inject({ method: 'GET', url: `/api/runs/${run.id}/tools`, headers: admin })
    ).json();
    expect(tools[0]).toMatchObject({ toolName: 'npm test', category: 'shell', durationMs: 900 });

    const retry = await app.inject({
      method: 'POST',
      url: '/api/telemetry/batch',
      headers: admin,
      payload: { events },
    });
    expect(retry.json()).toMatchObject({ ingested: 0, duplicates: 6 });
    expect(await prisma.fileOperation.count({ where: { runId: run.id } })).toBe(1);
  });

  it('rejects events for unknown runs and unregistered repositories', async () => {
    const unknownRun = await app.inject({
      method: 'POST',
      url: '/api/telemetry/events',
      headers: admin,
      payload: {
        ...event({ id: 'x1', kind: 'tool.started' }),
        correlation: undefined,
        runId: 'does-not-exist',
      },
    });
    expect(unknownRun.statusCode).toBe(422);
    expect(unknownRun.json().error).toBe('unknown_run');

    const unknownRepo = await app.inject({
      method: 'POST',
      url: '/api/telemetry/events',
      headers: admin,
      payload: event({
        id: 'x2',
        kind: 'tool.started',
        correlation: { repository: 'nobody/here', providerRunId: '1' },
      }),
    });
    expect(unknownRepo.statusCode).toBe(422);
  });

  it('confines a repository-scoped ingest token to its own repository', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: admin,
      payload: { name: 'ci-other', role: 'ingest', repositoryId: otherRepoId },
    });
    const ingest = { authorization: `Bearer ${created.json().token}` };
    const res = await app.inject({
      method: 'POST',
      url: '/api/telemetry/events',
      headers: ingest,
      payload: event({ id: 'scoped-1', kind: 'tool.started' }),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('local agent workspaces', () => {
  const cityRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/agentic-city');
  let cityRepoId: string;

  function local(overrides: Record<string, unknown>) {
    return event({ correlation: { repository: 'local/agentic-city', sessionId: 'abc123' }, ...overrides });
  }

  it('registers a workspace from disk and discovers its agents, skills, and prompts', async () => {
    const relative = await app.inject({
      method: 'POST',
      url: '/api/repositories/local',
      headers: admin,
      payload: { path: 'examples/agentic-city' },
    });
    expect(relative.statusCode).toBe(400);

    const res = await app.inject({
      method: 'POST',
      url: '/api/repositories/local',
      headers: admin,
      payload: { path: cityRoot },
    });
    expect(res.statusCode).toBe(201);
    const { repository, synced } = res.json();
    expect(repository).toMatchObject({ fullName: 'local/agentic-city', provider: 'local' });
    expect(synced).toMatchObject({ agents: 5, skills: 4, prompts: 4, instructions: 3 });
    cityRepoId = repository.id;

    const again = await app.inject({
      method: 'POST',
      url: '/api/repositories/local',
      headers: admin,
      payload: { path: cityRoot },
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().repository.id).toBe(cityRepoId);
  });

  it('turns a local chat session into a run with agents, handoffs, skills, and diffs', async () => {
    const planner = { type: 'agent', id: 'city-planner', name: 'city-planner' };
    const at = (s: number) => `2026-10-08T13:00:0${s}.000Z`;
    const events = [
      local({
        id: 'l1',
        kind: 'workflow.started',
        spanId: 'session',
        timestamp: at(0),
        data: { name: '/found-district Noodle Heights', engine: 'VS Code agent (local)' },
      }),
      local({
        id: 'l2',
        kind: 'agent.started',
        spanId: 'turn-1',
        parentSpanId: 'session',
        timestamp: at(0),
        actor: { type: 'agent', id: 'mayor', name: 'mayor' },
      }),
      local({
        id: 'l3',
        kind: 'agent.started',
        spanId: 'sub-1',
        parentSpanId: 'turn-1',
        timestamp: at(1),
        actor: { type: 'subagent', id: 'city-planner', name: 'city-planner' },
      }),
      local({
        id: 'l4',
        kind: 'agent.handoff.completed',
        spanId: 'handoff-sub-1',
        parentSpanId: 'turn-1',
        timestamp: at(1),
        data: { fromSpanId: 'turn-1', toSpanId: 'sub-1', reason: 'Design Noodle Heights' },
      }),
      local({
        id: 'l5',
        kind: 'skill.loaded',
        spanId: 'skill-1',
        parentSpanId: 'sub-1',
        timestamp: at(2),
        data: { name: 'zoning-code' },
      }),
      local({
        id: 'l6',
        kind: 'tool.started',
        spanId: 'tool-1',
        parentSpanId: 'sub-1',
        timestamp: at(2),
        data: { toolName: 'create_file' },
      }),
      local({
        id: 'l7',
        kind: 'file.read',
        spanId: 'tool-1',
        timestamp: at(3),
        actor: planner,
        data: { path: 'city/map.md' },
      }),
      local({
        id: 'l8',
        kind: 'file.created',
        spanId: 'tool-1',
        timestamp: at(3),
        actor: planner,
        data: {
          path: 'city/districts/noodle-heights.md',
          diff: '@@ -0,0 +1,1 @@\n+# Noodle Heights',
          additions: 1,
          deletions: 0,
        },
      }),
      local({
        id: 'l9',
        kind: 'tool.completed',
        spanId: 'tool-1',
        timestamp: at(3),
        data: { toolName: 'create_file', status: 'success' },
      }),
      local({ id: 'l10', kind: 'agent.completed', spanId: 'sub-1', timestamp: at(4) }),
      local({ id: 'l11', kind: 'agent.completed', spanId: 'turn-1', timestamp: at(5) }),
      local({ id: 'l12', kind: 'workflow.completed', spanId: 'session', timestamp: at(5) }),
    ];
    const res = await app.inject({
      method: 'POST',
      url: '/api/telemetry/batch',
      headers: admin,
      payload: { events },
    });
    expect(res.statusCode).toBe(201);

    const runs = (
      await app.inject({ method: 'GET', url: `/api/repositories/${cityRepoId}/runs`, headers: admin })
    ).json();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      workflowName: '/found-district Noodle Heights',
      engine: 'VS Code agent (local)',
      status: 'success',
      durationMs: 5000,
    });
    const runId = runs[0].id as string;
    const get = async (path: string) =>
      (await app.inject({ method: 'GET', url: `/api/runs/${runId}/${path}`, headers: admin })).json();

    const { agentRuns, handoffs } = await get('agents');
    const mayor = agentRuns.find((a: { name: string }) => a.name === 'mayor');
    const plannerRun = agentRuns.find((a: { name: string }) => a.name === 'city-planner');
    expect(plannerRun).toMatchObject({ parentAgentRunId: mayor.id, status: 'success' });
    expect(plannerRun.agentDefinition.path).toBe('.github/agents/city-planner.agent.md');
    expect(handoffs).toEqual([
      expect.objectContaining({
        fromAgentRunId: mayor.id,
        toAgentRunId: plannerRun.id,
        reason: 'Design Noodle Heights',
      }),
    ]);

    expect(await get('skills')).toEqual([
      expect.objectContaining({
        loaded: 'true',
        configured: true,
        skillDefinition: expect.objectContaining({ name: 'zoning-code' }),
      }),
    ]);

    const files = await get('files');
    expect(files.map((f: { operation: string }) => f.operation).sort()).toEqual(['created', 'read']);
    expect(files.find((f: { operation: string }) => f.operation === 'created')).toMatchObject({
      actorId: 'city-planner',
      additions: 1,
      diff: '@@ -0,0 +1,1 @@\n+# Noodle Heights',
    });
    expect((await get('metrics')).filesChanged).toBe(1);
  });
});

function signed(body: unknown, event: string) {
  const raw = JSON.stringify(body);
  return {
    payload: raw,
    headers: {
      'content-type': 'application/json',
      'x-github-event': event,
      'x-hub-signature-256': `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex')}`,
    },
  };
}

describe('GitHub webhook', () => {
  const workflowRun = {
    id: 9001,
    name: 'Issue Triage',
    path: '.github/workflows/issue-triage.lock.yml',
    event: 'issues',
    status: 'completed',
    conclusion: 'failure',
    head_branch: 'main',
    head_sha: 'abcdef1234567890abcdef1234567890abcdef12',
    run_started_at: '2026-10-08T12:00:00Z',
    created_at: '2026-10-08T12:00:00Z',
    updated_at: '2026-10-08T12:01:00Z',
  };

  it('rejects an unsigned or wrongly signed delivery', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'ping',
        'x-hub-signature-256': 'sha256=deadbeef',
      },
      payload: '{}',
    });
    expect(res.statusCode).toBe(401);
  });

  it('answers a signed ping', async () => {
    const req = signed({ zen: 'hi' }, 'ping');
    const res = await app.inject({ method: 'POST', url: '/api/webhooks/github', ...req });
    expect(res.statusCode).toBe(200);
  });

  it("upgrades the telemetry placeholder in place and imports the commit's changed files", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            files: [
              {
                filename: 'src/auth.ts',
                status: 'modified',
                additions: 3,
                deletions: 1,
                patch: '@@ -1 +1 @@\n-a\n+b',
              },
              { filename: 'docs/new.md', status: 'added', additions: 10, deletions: 0 },
              {
                filename: 'src/new-name.ts',
                previous_filename: 'src/old-name.ts',
                status: 'renamed',
                additions: 0,
                deletions: 0,
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const req = signed(
      {
        action: 'completed',
        workflow_run: workflowRun,
        repository: { full_name: 'acme/payments' },
      },
      'workflow_run',
    );
    const res = await app.inject({ method: 'POST', url: '/api/webhooks/github', ...req });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, changedFiles: 3 });

    const runs = await prisma.workflowRun.findMany({
      where: { repositoryId: repoId, providerRunId: '9001' },
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      workflowName: 'Issue Triage',
      status: 'failure',
      commitSha: workflowRun.head_sha,
    });

    const files = await prisma.fileOperation.findMany({
      where: { runId: runs[0]!.id, evidenceSource: 'github-api' },
    });
    expect(files.map((f) => f.operation).sort()).toEqual(['created', 'modified', 'renamed']);
    expect(files.find((f) => f.operation === 'renamed')?.previousPath).toBe('src/old-name.ts');
    expect(files[0]!.evidenceNote).toContain('Not necessarily modified by the run itself');
    // Runtime-reported changes survive alongside the commit's files.
    expect(
      await prisma.fileOperation.count({
        where: { runId: runs[0]!.id, evidenceSource: 'runtime' },
      }),
    ).toBe(1);
  });

  it('acknowledges but ignores deliveries for unregistered repositories', async () => {
    const req = signed(
      { action: 'completed', workflow_run: workflowRun, repository: { full_name: 'someone/else' } },
      'workflow_run',
    );
    const res = await app.inject({ method: 'POST', url: '/api/webhooks/github', ...req });
    expect(res.statusCode).toBe(202);
  });
});
