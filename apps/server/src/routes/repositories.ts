import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { syncRepositoryFromDisk } from '../sync.js';
import { serializeAgentDefinition, serializeSkillDefinition, serializeWorkflowDefinition } from '../serialize.js';

const SyncBodySchema = z.object({ checkoutDir: z.string().min(1) });

export async function repositoriesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/repositories', async () => {
    const repositories = await prisma.repository.findMany({ orderBy: { fullName: 'asc' } });
    return repositories;
  });

  app.get<{ Params: { repoId: string } }>('/api/repositories/:repoId', async (req, reply) => {
    const repository = await prisma.repository.findUnique({ where: { id: req.params.repoId } });
    if (!repository) {
      return reply.code(404).send({ error: 'repository_not_found' });
    }
    return repository;
  });

  app.get<{ Params: { repoId: string } }>(
    '/api/repositories/:repoId/workflows',
    async (req) => {
      const workflows = await prisma.workflowDefinition.findMany({
        where: { repositoryId: req.params.repoId },
        include: { compiledWorkflow: true },
      });
      return workflows.map(serializeWorkflowDefinition);
    },
  );

  app.get<{ Params: { repoId: string; workflowId: string } }>(
    '/api/repositories/:repoId/workflows/:workflowId',
    async (req, reply) => {
      const workflow = await prisma.workflowDefinition.findFirst({
        where: { id: req.params.workflowId, repositoryId: req.params.repoId },
        include: { compiledWorkflow: true },
      });
      if (!workflow) {
        return reply.code(404).send({ error: 'workflow_not_found' });
      }
      return serializeWorkflowDefinition(workflow);
    },
  );

  app.get<{ Params: { repoId: string } }>('/api/repositories/:repoId/agents', async (req) => {
    const agents = await prisma.agentDefinition.findMany({ where: { repositoryId: req.params.repoId } });
    return agents.map(serializeAgentDefinition);
  });

  app.get<{ Params: { repoId: string } }>('/api/repositories/:repoId/skills', async (req) => {
    const skills = await prisma.skillDefinition.findMany({ where: { repositoryId: req.params.repoId } });
    return skills.map(serializeSkillDefinition);
  });

  app.get<{ Params: { repoId: string }; Querystring: { workflowId?: string; status?: string } }>(
    '/api/repositories/:repoId/runs',
    async (req) => {
      return prisma.workflowRun.findMany({
        where: {
          repositoryId: req.params.repoId,
          ...(req.query.workflowId ? { workflowDefinitionId: req.query.workflowId } : {}),
          ...(req.query.status ? { status: req.query.status } : {}),
        },
        orderBy: { startTime: 'desc' },
      });
    },
  );

  app.get<{ Params: { repoId: string } }>('/api/repositories/:repoId/overview', async (req) => {
    const repositoryId = req.params.repoId;
    const [runs, agentDefCount, skillDefCount, workflowDefCount] = await Promise.all([
      prisma.workflowRun.findMany({
        where: { repositoryId },
        orderBy: { startTime: 'desc' },
        take: 50,
      }),
      prisma.agentDefinition.count({ where: { repositoryId } }),
      prisma.skillDefinition.count({ where: { repositoryId } }),
      prisma.workflowDefinition.count({ where: { repositoryId } }),
    ]);

    const completed = runs.filter((r) => r.status === 'success' || r.status === 'failure');
    const successCount = runs.filter((r) => r.status === 'success').length;
    const successRate = completed.length > 0 ? successCount / completed.length : null;
    const durations = runs
      .map((r) => r.durationMs)
      .filter((d): d is number => typeof d === 'number');
    const averageDurationMs =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    const [toolCallCount, fileOpCount, prCount, handoffCount] = await Promise.all([
      prisma.toolInvocation.count({ where: { run: { repositoryId } } }),
      prisma.fileOperation.count({ where: { run: { repositoryId } } }),
      prisma.pullRequest.count({ where: { run: { repositoryId } } }),
      prisma.agentHandoff.count({ where: { fromAgentRun: { run: { repositoryId } } } }),
    ]);

    return {
      recentRuns: runs.slice(0, 10),
      totalRuns: runs.length,
      successRate,
      averageDurationMs,
      workflowDefCount,
      agentDefCount,
      skillDefCount,
      toolCallCount,
      fileOpCount,
      pullRequestCount: prCount,
      handoffCount,
      failingRuns: runs.filter((r) => r.status === 'failure').slice(0, 5),
    };
  });

  app.get<{ Params: { repoId: string } }>('/api/repositories/:repoId/files', async (req) => {
    const fileOps = await prisma.fileOperation.findMany({
      where: { run: { repositoryId: req.params.repoId } },
      include: { run: { select: { id: true, workflowName: true, status: true } } },
    });

    const byPath = new Map<
      string,
      { path: string; runIds: Set<string>; workflows: Set<string>; failureCount: number; totalOps: number }
    >();
    for (const op of fileOps) {
      const entry = byPath.get(op.path) ?? {
        path: op.path,
        runIds: new Set<string>(),
        workflows: new Set<string>(),
        failureCount: 0,
        totalOps: 0,
      };
      entry.runIds.add(op.runId);
      entry.workflows.add(op.run.workflowName);
      entry.totalOps += 1;
      if (op.run.status === 'failure') entry.failureCount += 1;
      byPath.set(op.path, entry);
    }

    return Array.from(byPath.values())
      .map((e) => ({
        path: e.path,
        runCount: e.runIds.size,
        workflows: Array.from(e.workflows),
        totalOps: e.totalOps,
        failureCount: e.failureCount,
      }))
      .sort((a, b) => b.runCount - a.runCount);
  });

  app.get<{ Params: { repoId: string } }>(
    '/api/repositories/:repoId/relationships',
    async (req) => {
      return prisma.definitionRelationship.findMany({
        where: { repositoryId: req.params.repoId },
      });
    },
  );

  // Static architecture graph: every discovered definition across all kinds
  // as a node, every DefinitionRelationship as an edge. Purely a read-model
  // over data that already exists — no new discovery logic here.
  app.get<{ Params: { repoId: string } }>(
    '/api/repositories/:repoId/architecture',
    async (req) => {
      const repositoryId = req.params.repoId;
      const [workflows, agents, skills, instructions, prompts, hooks, mcpServers, relationships] =
        await Promise.all([
          prisma.workflowDefinition.findMany({ where: { repositoryId } }),
          prisma.agentDefinition.findMany({ where: { repositoryId } }),
          prisma.skillDefinition.findMany({ where: { repositoryId } }),
          prisma.instructionDefinition.findMany({ where: { repositoryId } }),
          prisma.promptDefinition.findMany({ where: { repositoryId } }),
          prisma.hookDefinition.findMany({ where: { repositoryId } }),
          prisma.mcpServerDefinition.findMany({ where: { repositoryId } }),
          prisma.definitionRelationship.findMany({ where: { repositoryId } }),
        ]);
      const compiledWorkflows = await prisma.compiledWorkflow.findMany({
        where: { workflowDefinitionId: { in: workflows.map((w) => w.id) } },
      });

      const nodes = [
        ...workflows.map((w) => ({ id: w.id, kind: 'workflow', name: w.name, path: w.path })),
        ...compiledWorkflows.map((c) => ({
          id: c.id,
          kind: 'compiled-workflow',
          name: c.path.split('/').pop() ?? c.path,
          path: c.path,
        })),
        ...agents.map((a) => ({ id: a.id, kind: 'agent', name: a.name, path: a.path })),
        ...skills.map((s) => ({ id: s.id, kind: 'skill', name: s.name, path: s.path })),
        ...instructions.map((i) => ({
          id: i.id,
          kind: 'instruction',
          name: i.path.split('/').pop() ?? i.path,
          path: i.path,
        })),
        ...prompts.map((p) => ({ id: p.id, kind: 'prompt', name: p.name, path: p.path })),
        ...hooks.map((h) => ({
          id: h.id,
          kind: 'hook',
          name: h.path.split('/').pop() ?? h.path,
          path: h.path,
        })),
        ...mcpServers.map((m) => ({ id: m.id, kind: 'mcp-server', name: m.name, path: m.path })),
      ];

      const edges = relationships.map((r) => ({
        id: r.id,
        source: r.sourceDefinitionId,
        target: r.targetDefinitionId,
        sourceKind: r.sourceKind,
        targetKind: r.targetKind,
        relationshipType: r.relationshipType,
        evidenceSource: r.evidenceSource,
        evidenceConfidence: r.evidenceConfidence,
        evidenceNote: r.evidenceNote,
      }));

      return { nodes, edges };
    },
  );

  // Discovers static repo artifacts (workflows/agents/skills/instructions/
  // prompts/hooks/mcp servers) from a checkout on disk and persists them.
  // Live GitHub-API-backed sync (cloning/fetching a remote repo) is a
  // later phase; this endpoint operates on an already-present local path.
  app.post<{ Params: { repoId: string } }>(
    '/api/repositories/:repoId/sync',
    async (req, reply) => {
      const repository = await prisma.repository.findUnique({ where: { id: req.params.repoId } });
      if (!repository) {
        return reply.code(404).send({ error: 'repository_not_found' });
      }
      const parsed = SyncBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      try {
        const summary = await syncRepositoryFromDisk(
          prisma,
          req.params.repoId,
          parsed.data.checkoutDir,
        );
        return { ok: true, ...summary };
      } catch (err) {
        return reply.code(500).send({
          error: 'sync_failed',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
}
