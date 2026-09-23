import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { buildSpanTree } from '../trace.js';
import { serializeAgentDefinition, serializeEvent, serializeSkillDefinition, serializeSkillUsage } from '../serialize.js';

export async function runsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { runId: string } }>('/api/runs/:runId', async (req, reply) => {
    const run = await prisma.workflowRun.findUnique({ where: { id: req.params.runId } });
    if (!run) {
      return reply.code(404).send({ error: 'run_not_found' });
    }
    return run;
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/trace', async (req, reply) => {
    const run = await prisma.workflowRun.findUnique({ where: { id: req.params.runId } });
    if (!run) {
      return reply.code(404).send({ error: 'run_not_found' });
    }
    const spans = await prisma.span.findMany({ where: { runId: req.params.runId } });
    return { run, trace: buildSpanTree(spans) };
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/events', async (req) => {
    const events = await prisma.event.findMany({
      where: { runId: req.params.runId },
      orderBy: { timestamp: 'asc' },
    });
    return events.map(serializeEvent);
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/files', async (req) => {
    return prisma.fileOperation.findMany({ where: { runId: req.params.runId } });
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/agents', async (req) => {
    const agentRuns = await prisma.agentRun.findMany({
      where: { runId: req.params.runId },
      include: { agentDefinition: true },
    });
    const handoffs = await prisma.agentHandoff.findMany({
      where: { fromAgentRun: { runId: req.params.runId } },
    });
    return {
      agentRuns: agentRuns.map((a) => ({
        ...a,
        agentDefinition: a.agentDefinition ? serializeAgentDefinition(a.agentDefinition) : null,
      })),
      handoffs,
    };
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/skills', async (req) => {
    const agentRunIds = (
      await prisma.agentRun.findMany({ where: { runId: req.params.runId }, select: { id: true } })
    ).map((a) => a.id);
    const usages = await prisma.skillUsage.findMany({
      where: { agentRunId: { in: agentRunIds } },
      include: { skillDefinition: true },
    });
    return usages.map((u) => ({
      ...serializeSkillUsage(u),
      skillDefinition: serializeSkillDefinition(u.skillDefinition),
    }));
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/tools', async (req) => {
    return prisma.toolInvocation.findMany({ where: { runId: req.params.runId } });
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/logs', async (req) => {
    return prisma.logRecord.findMany({
      where: { runId: req.params.runId },
      orderBy: { timestamp: 'asc' },
    });
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/github', async (req) => {
    const [pullRequests, issues, checks, commits] = await Promise.all([
      prisma.pullRequest.findMany({ where: { runId: req.params.runId } }),
      prisma.issueOperation.findMany({ where: { runId: req.params.runId } }),
      prisma.checkOperation.findMany({ where: { runId: req.params.runId } }),
      prisma.commit.findMany({ where: { runId: req.params.runId } }),
    ]);
    return { pullRequests, issues, checks, commits };
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/metrics', async (req) => {
    const [modelInvocations, toolInvocations, fileOps, run] = await Promise.all([
      prisma.modelInvocation.findMany({ where: { runId: req.params.runId } }),
      prisma.toolInvocation.count({ where: { runId: req.params.runId } }),
      prisma.fileOperation.count({ where: { runId: req.params.runId } }),
      prisma.workflowRun.findUnique({ where: { id: req.params.runId } }),
    ]);
    const tokensInput = modelInvocations.reduce((sum, m) => sum + (m.tokensInput ?? 0), 0);
    const tokensOutput = modelInvocations.reduce((sum, m) => sum + (m.tokensOutput ?? 0), 0);
    const costUsd = modelInvocations.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
    return {
      durationMs: run?.durationMs ?? null,
      modelCallCount: modelInvocations.length,
      tokensInput: modelInvocations.length > 0 ? tokensInput : null,
      tokensOutput: modelInvocations.length > 0 ? tokensOutput : null,
      costUsd: modelInvocations.some((m) => m.costUsd != null) ? costUsd : null,
      toolCallCount: toolInvocations,
      filesChanged: fileOps,
    };
  });

  app.get<{ Params: { runId: string } }>('/api/runs/:runId/drift', async (req) => {
    return prisma.driftFinding.findMany({ where: { runId: req.params.runId } });
  });
}
