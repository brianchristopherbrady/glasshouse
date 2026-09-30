import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { syncRepositoryFromDisk } from '../sync.js';
import {
  cleanupClone,
  cloneRepoShallow,
  fetchRecentWorkflowRuns,
  fetchRepoMeta,
  GithubApiError,
} from '../github.js';

const RegisterBodySchema = z.object({ owner: z.string().min(1), repo: z.string().min(1) });

function githubToken(): string | undefined {
  return process.env.AGENTIC_FLOWS_GITHUB_TOKEN;
}

function mapGithubStatus(status: string, conclusion: string | null): 'success' | 'failure' | 'running' {
  if (status !== 'completed') return 'running';
  return conclusion === 'success' ? 'success' : 'failure';
}

export async function githubRoutes(app: FastifyInstance): Promise<void> {
  // Registers (or re-syncs) a REAL GitHub repository: fetches its metadata
  // via the GitHub API, shallow-clones it, and runs the existing static-
  // discovery pipeline (packages/parser) against the clone — this is the
  // "live GitHub API sync" capability the README previously marked as not
  // built; local-checkout-only sync (POST /api/repositories/:repoId/sync)
  // is unchanged and still the right tool when a checkout already exists.
  app.post('/api/repositories/github', async (req, reply) => {
    const parsed = RegisterBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const { owner, repo } = parsed.data;
    const token = githubToken();

    let meta;
    try {
      meta = await fetchRepoMeta(owner, repo, token);
    } catch (err) {
      if (err instanceof GithubApiError) {
        return reply.code(err.status).send({ error: 'github_api_error', message: err.message });
      }
      throw err;
    }

    const repository = await prisma.repository.upsert({
      where: { fullName: meta.fullName },
      create: {
        owner,
        name: repo,
        fullName: meta.fullName,
        defaultBranch: meta.defaultBranch,
        provider: 'github',
        providerRepoId: String(meta.id),
      },
      update: { defaultBranch: meta.defaultBranch, providerRepoId: String(meta.id) },
    });

    let cloneDir: string;
    try {
      cloneDir = await cloneRepoShallow(owner, repo, token);
    } catch (err) {
      return reply
        .code(502)
        .send({ error: 'clone_failed', message: err instanceof Error ? err.message : String(err) });
    }
    try {
      const summary = await syncRepositoryFromDisk(prisma, repository.id, cloneDir);
      return { ok: true, repository, sync: summary };
    } finally {
      await cleanupClone(cloneDir);
    }
  });

  // Fetches recent GitHub Actions runs and upserts them as WorkflowRun rows
  // (idempotent by providerRunId). A run whose workflow file doesn't
  // resolve to an already-discovered WorkflowDefinition is stored with
  // workflowDefinitionId: null — never guessed, matching this product's
  // "unresolved reference" convention used elsewhere (e.g. Agents page).
  app.post<{ Params: { repoId: string } }>(
    '/api/repositories/:repoId/github-runs/sync',
    async (req, reply) => {
      const repository = await prisma.repository.findUnique({ where: { id: req.params.repoId } });
      if (!repository) {
        return reply.code(404).send({ error: 'repository_not_found' });
      }

      let runs;
      try {
        runs = await fetchRecentWorkflowRuns(repository.owner, repository.name, githubToken());
      } catch (err) {
        if (err instanceof GithubApiError) {
          return reply.code(err.status).send({ error: 'github_api_error', message: err.message });
        }
        throw err;
      }

      const workflowDefs = await prisma.workflowDefinition.findMany({
        where: { repositoryId: repository.id },
        include: { compiledWorkflow: true },
      });
      const defIdByCompiledPath = new Map(
        workflowDefs
          .filter((w) => w.compiledWorkflow)
          .map((w) => [w.compiledWorkflow!.path, w.id] as const),
      );

      let created = 0;
      let updated = 0;
      for (const run of runs) {
        const status = mapGithubStatus(run.status, run.conclusion);
        const startTime = new Date(run.run_started_at ?? run.created_at);
        const endTime = run.conclusion ? new Date(run.updated_at) : null;
        const data = {
          repositoryId: repository.id,
          workflowDefinitionId: defIdByCompiledPath.get(run.path) ?? null,
          workflowName: run.name,
          providerRunId: String(run.id),
          trigger: run.event,
          branch: run.head_branch,
          commitSha: run.head_sha,
          status,
          startTime,
          endTime,
          durationMs: endTime ? endTime.getTime() - startTime.getTime() : null,
          engine: 'github-actions',
        };
        const existing = await prisma.workflowRun.findFirst({
          where: { repositoryId: repository.id, providerRunId: String(run.id) },
        });
        if (existing) {
          await prisma.workflowRun.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await prisma.workflowRun.create({ data });
          created += 1;
        }
      }

      return { ok: true, created, updated, total: runs.length };
    },
  );
}
