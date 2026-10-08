import type { PrismaClient, Repository, WorkflowRun } from '@prisma/client';
import type { GithubCommitFile, GithubWorkflowRun } from './github.js';

const MAX_PATCH_CHARS = 20_000;

export function mapGithubStatus(
  status: string,
  conclusion: string | null,
): 'success' | 'failure' | 'running' {
  if (status !== 'completed') return 'running';
  return conclusion === 'success' ? 'success' : 'failure';
}

/**
 * Idempotently upserts one GitHub Actions run, keyed by (repositoryId,
 * providerRunId). The workflow definition is linked only when the run's
 * workflow file matches an already-discovered compiled workflow — never
 * guessed. Also upgrades a telemetry-created placeholder run in place.
 */
export async function upsertGithubRun(
  prisma: PrismaClient,
  repository: Repository,
  run: GithubWorkflowRun,
): Promise<{ record: WorkflowRun; created: boolean }> {
  const compiled = await prisma.compiledWorkflow.findFirst({
    where: { path: run.path, workflowDefinition: { repositoryId: repository.id } },
    select: { workflowDefinitionId: true },
  });
  const startTime = new Date(run.run_started_at ?? run.created_at);
  const endTime = run.status === 'completed' ? new Date(run.updated_at) : null;
  const data = {
    workflowDefinitionId: compiled?.workflowDefinitionId ?? null,
    workflowName: run.name,
    trigger: run.event,
    branch: run.head_branch,
    commitSha: run.head_sha,
    status: mapGithubStatus(run.status, run.conclusion),
    startTime,
    endTime,
    durationMs: endTime ? endTime.getTime() - startTime.getTime() : null,
    engine: 'github-actions',
  };
  const providerRunId = String(run.id);
  const existing = await prisma.workflowRun.findUnique({
    where: { repositoryId_providerRunId: { repositoryId: repository.id, providerRunId } },
    select: { id: true },
  });
  const record = await prisma.workflowRun.upsert({
    where: { repositoryId_providerRunId: { repositoryId: repository.id, providerRunId } },
    create: { repositoryId: repository.id, providerRunId, ...data },
    update: data,
  });
  return { record, created: !existing };
}

const OPERATION_BY_STATUS: Record<string, string> = {
  added: 'created',
  copied: 'created',
  modified: 'modified',
  changed: 'modified',
  removed: 'deleted',
  renamed: 'renamed',
};

/**
 * Replaces a run's GitHub-API-sourced file operations with the files changed
 * by its head commit. The evidence note is explicit that these are the
 * commit the run executed against — not proof the run itself wrote them.
 */
export async function replaceCommitFileOperations(
  prisma: PrismaClient,
  runId: string,
  sha: string,
  files: GithubCommitFile[],
): Promise<number> {
  const note =
    `Changed by commit ${sha.slice(0, 7)}, the commit this run executed against ` +
    '(GitHub commits API). Not necessarily modified by the run itself.';
  const rows = files
    .filter((f) => OPERATION_BY_STATUS[f.status])
    .map((f) => ({
      runId,
      path: f.filename,
      previousPath: f.previous_filename ?? null,
      operation: OPERATION_BY_STATUS[f.status]!,
      additions: f.additions,
      deletions: f.deletions,
      afterSha: sha,
      diff:
        f.patch && f.patch.length > MAX_PATCH_CHARS
          ? `${f.patch.slice(0, MAX_PATCH_CHARS)}\n… [diff truncated]`
          : (f.patch ?? null),
      evidenceSource: 'github-api',
      evidenceConfidence: 'observed',
      evidenceNote: note,
    }));
  await prisma.$transaction([
    prisma.fileOperation.deleteMany({ where: { runId, evidenceSource: 'github-api' } }),
    prisma.fileOperation.createMany({ data: rows }),
  ]);
  return rows.length;
}
