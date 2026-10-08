import type { FastifyInstance } from 'fastify';
import type { PrismaClient, Repository } from '@prisma/client';
import { z } from 'zod';
import { syncRepositoryFromDisk } from '../sync.js';
import {
  cleanupClone,
  cloneRepoShallow,
  fetchCommitFiles,
  fetchRecentWorkflowRuns,
  fetchRepoMeta,
  GithubApiError,
} from '../github.js';
import type { GithubTokenResolver } from '../githubAuth.js';
import { replaceCommitFileOperations, upsertGithubRun } from '../githubRuns.js';

const RegisterBodySchema = z.object({ owner: z.string().min(1), repo: z.string().min(1) });

export interface GithubRouteOptions {
  prisma: PrismaClient;
  resolveGithubToken: GithubTokenResolver;
}

/**
 * Imports changed files for a run's head commit unless already imported.
 * Commits shared by several runs are fetched once per call via `cache`.
 */
export async function importChangedFiles(
  prisma: PrismaClient,
  repository: Repository,
  run: { id: string; commitSha: string | null },
  token: string | undefined,
  cache = new Map<string, Awaited<ReturnType<typeof fetchCommitFiles>>>(),
): Promise<number> {
  if (!run.commitSha) return 0;
  const already = await prisma.fileOperation.count({
    where: { runId: run.id, evidenceSource: 'github-api' },
  });
  if (already > 0) return 0;
  let files = cache.get(run.commitSha);
  if (!files) {
    files = await fetchCommitFiles(repository.owner, repository.name, run.commitSha, token);
    cache.set(run.commitSha, files);
  }
  return replaceCommitFileOperations(prisma, run.id, run.commitSha, files);
}

export async function githubRoutes(
  app: FastifyInstance,
  { prisma, resolveGithubToken }: GithubRouteOptions,
): Promise<void> {
  // Registers (or re-syncs) a real GitHub repository: fetches its metadata,
  // sparse-clones the discovery paths, and runs packages/parser against it.
  // POST /api/repositories/:repoId/sync remains for already-local checkouts.
  app.post(
    '/api/repositories/github',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = RegisterBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const { owner: requestedOwner, repo: requestedRepo } = parsed.data;

      let meta;
      let token: string | undefined;
      try {
        token = await resolveGithubToken(requestedOwner, requestedRepo);
        meta = await fetchRepoMeta(requestedOwner, requestedRepo, token);
      } catch (err) {
        if (err instanceof GithubApiError) {
          return reply.code(err.status).send({ error: 'github_api_error', message: err.message });
        }
        throw err;
      }
      // GitHub's canonical casing, so webhook payloads (which use full_name) match.
      const [owner, repo] = meta.fullName.split('/') as [string, string];

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
        update: {
          owner,
          name: repo,
          defaultBranch: meta.defaultBranch,
          providerRepoId: String(meta.id),
        },
      });

      let cloneDir: string;
      try {
        cloneDir = await cloneRepoShallow(owner, repo, token);
      } catch (err) {
        req.log.warn({ err }, 'git clone failed');
        return reply
          .code(502)
          .send({
            error: 'clone_failed',
            message: err instanceof Error ? err.message : String(err),
          });
      }
      try {
        const summary = await syncRepositoryFromDisk(prisma, repository.id, cloneDir);
        return { ok: true, repository, sync: summary };
      } finally {
        await cleanupClone(cloneDir);
      }
    },
  );

  // Pulls recent GitHub Actions runs (idempotent by providerRunId) and the
  // files changed by each run's head commit. Webhooks keep this current
  // automatically; this route backfills or recovers from missed deliveries.
  app.post<{ Params: { repoId: string } }>(
    '/api/repositories/:repoId/github-runs/sync',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const repository = await prisma.repository.findUnique({ where: { id: req.params.repoId } });
      if (!repository) {
        return reply.code(404).send({ error: 'repository_not_found' });
      }

      let runs;
      let token: string | undefined;
      try {
        token = await resolveGithubToken(repository.owner, repository.name);
        runs = await fetchRecentWorkflowRuns(repository.owner, repository.name, token);
      } catch (err) {
        if (err instanceof GithubApiError) {
          return reply.code(err.status).send({ error: 'github_api_error', message: err.message });
        }
        throw err;
      }

      let created = 0;
      let updated = 0;
      let changedFiles = 0;
      const fileErrors: string[] = [];
      const commitCache = new Map<string, Awaited<ReturnType<typeof fetchCommitFiles>>>();
      for (const run of runs) {
        const { record, created: isNew } = await upsertGithubRun(prisma, repository, run);
        if (isNew) created += 1;
        else updated += 1;
        try {
          changedFiles += await importChangedFiles(prisma, repository, record, token, commitCache);
        } catch (err) {
          // One unreachable commit (e.g. force-pushed away) shouldn't fail the whole sync.
          if (!(err instanceof GithubApiError)) throw err;
          fileErrors.push(err.message);
        }
      }

      return { ok: true, created, updated, total: runs.length, changedFiles, fileErrors };
    },
  );
}
