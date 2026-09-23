import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { serializeAgentDefinition, serializeSkillDefinition, serializeWorkflowDefinition } from '../serialize.js';

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
}
