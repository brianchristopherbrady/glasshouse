import type { Prisma, PrismaClient, WorkflowRun } from '@prisma/client';
import type { AgentEvent } from '@agentic-flows/domain';

type Tx = Prisma.TransactionClient;

export class IngestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface IngestScope {
  /** When set, events may only target runs in this repository. */
  repositoryId: string | null;
}

const MAX_DIFF_CHARS = 20_000;
const PLACEHOLDER_WORKFLOW_NAME = 'Awaiting GitHub Actions sync';
const FILE_OPERATION_BY_KIND: Record<string, string> = {
  'file.created': 'created',
  'file.modified': 'modified',
  'file.deleted': 'deleted',
};

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// External producers choose their own span ids, which only need to be unique
// within a run — namespace them so they can never collide across runs.
function internalSpanId(runId: string, spanId: string): string {
  return `${runId}:${spanId}`;
}

function spanPhase(kind: string): 'start' | 'end' | 'instant' {
  if (kind.endsWith('.started')) return 'start';
  if (kind.endsWith('.completed') || kind === 'workflow.failed') return 'end';
  return 'instant';
}

function spanType(event: AgentEvent): string {
  if (event.kind.startsWith('agent.handoff')) return 'handoff';
  const prefix = event.kind.split('.')[0]!;
  if (prefix === 'agent') return event.actor?.type === 'subagent' ? 'subagent' : 'agent';
  if (prefix === 'mcp') return 'tool';
  if (prefix === 'error' || prefix === 'retry') return 'tool';
  return prefix;
}

function eventStatus(event: AgentEvent): 'success' | 'failure' {
  const status = str(event.data.status);
  return event.kind === 'workflow.failed' ||
    event.kind === 'error' ||
    status === 'failure' ||
    status === 'error'
    ? 'failure'
    : 'success';
}

async function resolveRun(tx: Tx, event: AgentEvent, scope: IngestScope): Promise<WorkflowRun> {
  let run: WorkflowRun | null;
  if (event.runId) {
    run = await tx.workflowRun.findUnique({ where: { id: event.runId } });
    if (!run) throw new IngestError(422, 'unknown_run', `no run with id "${event.runId}"`);
  } else {
    const { repository, providerRunId } = event.correlation!;
    const repo = await tx.repository.findUnique({ where: { fullName: repository } });
    if (!repo) {
      throw new IngestError(
        422,
        'unknown_repository',
        `repository "${repository}" is not registered`,
      );
    }
    // The Actions run may not have synced yet: create a placeholder that a
    // later sync/webhook upgrades in place (same repositoryId+providerRunId).
    run = await tx.workflowRun.upsert({
      where: { repositoryId_providerRunId: { repositoryId: repo.id, providerRunId } },
      create: {
        repositoryId: repo.id,
        providerRunId,
        workflowName: PLACEHOLDER_WORKFLOW_NAME,
        trigger: 'unknown',
        status: 'running',
        startTime: new Date(event.timestamp),
        engine: 'github-actions',
      },
      update: {},
    });
  }
  if (scope.repositoryId && run.repositoryId !== scope.repositoryId) {
    throw new IngestError(
      403,
      'forbidden',
      'this token may only ingest events for its own repository',
    );
  }
  return run;
}

async function applySpan(tx: Tx, runId: string, event: AgentEvent): Promise<string | null> {
  if (!event.spanId) return null;
  const id = internalSpanId(runId, event.spanId);
  const ts = new Date(event.timestamp);
  const phase = spanPhase(event.kind);
  const existing = await tx.span.findUnique({ where: { id } });

  if (!existing) {
    const name =
      str(event.data.name) ??
      str(event.data.toolName) ??
      str(event.data.path) ??
      event.actor?.name ??
      event.kind;
    await tx.span.create({
      data: {
        id,
        runId,
        parentSpanId: event.parentSpanId ? internalSpanId(runId, event.parentSpanId) : null,
        type: spanType(event),
        name,
        actorId: event.actor?.id ?? null,
        startTime: ts,
        endTime: phase === 'start' ? null : ts,
        durationMs: phase === 'start' ? null : 0,
        status: phase === 'start' ? 'running' : eventStatus(event),
        attributes: JSON.stringify(event.data),
        source: event.evidence.source,
        confidence: event.evidence.confidence,
      },
    });
    return id;
  }

  // Events can arrive out of order: widen the span to cover every timestamp seen.
  if (phase === 'instant') return id;
  const startTime = phase === 'start' && ts < existing.startTime ? ts : existing.startTime;
  const endTime =
    phase === 'end'
      ? existing.endTime && existing.endTime > ts
        ? existing.endTime
        : ts
      : existing.endTime;
  await tx.span.update({
    where: { id },
    data: {
      startTime,
      endTime,
      durationMs: endTime ? endTime.getTime() - startTime.getTime() : null,
      ...(phase === 'end' ? { status: eventStatus(event) } : {}),
    },
  });
  return id;
}

async function applyDerivedRecords(
  tx: Tx,
  run: WorkflowRun,
  event: AgentEvent,
  spanId: string | null,
): Promise<void> {
  const operation = FILE_OPERATION_BY_KIND[event.kind];
  const path = str(event.data.path);
  if (operation && path) {
    const diff = str(event.data.diff);
    await tx.fileOperation.create({
      data: {
        runId: run.id,
        spanId,
        path,
        previousPath: str(event.data.previousPath) ?? null,
        operation,
        additions: int(event.data.additions),
        deletions: int(event.data.deletions),
        diff:
          diff && diff.length > MAX_DIFF_CHARS
            ? `${diff.slice(0, MAX_DIFF_CHARS)}\n… [diff truncated]`
            : (diff ?? null),
        actorId: event.actor?.id ?? null,
        evidenceSource: event.evidence.source,
        evidenceConfidence: event.evidence.confidence,
        evidenceNote:
          event.evidence.note ?? 'Reported by runtime telemetry while the run was executing.',
      },
    });
  }

  if (event.kind === 'tool.completed') {
    await tx.toolInvocation.create({
      data: {
        runId: run.id,
        spanId: spanId ?? event.id,
        category: str(event.data.category) ?? 'custom',
        toolName: str(event.data.toolName) ?? str(event.data.name) ?? 'unknown',
        argumentsPreview: str(event.data.argumentsPreview) ?? null,
        resultPreview: str(event.data.resultPreview) ?? null,
        status: eventStatus(event),
        durationMs: int(event.data.durationMs),
      },
    });
  }

  if (event.kind === 'model.completed') {
    await tx.modelInvocation.create({
      data: {
        runId: run.id,
        spanId: spanId ?? event.id,
        model: str(event.data.model) ?? 'unknown',
        tokensInput: int(event.data.tokensInput),
        tokensOutput: int(event.data.tokensOutput),
        costUsd: num(event.data.costUsd),
        durationMs: int(event.data.durationMs),
      },
    });
  }

  // Telemetry may finish a run GitHub hasn't reported yet; a later sync or
  // webhook (the authoritative source) overwrites this.
  if (
    (event.kind === 'workflow.completed' || event.kind === 'workflow.failed') &&
    run.status === 'running'
  ) {
    const endTime = new Date(event.timestamp);
    await tx.workflowRun.update({
      where: { id: run.id },
      data: {
        status: eventStatus(event),
        endTime,
        durationMs: Math.max(0, endTime.getTime() - run.startTime.getTime()),
      },
    });
  }
}

/**
 * Correlates one telemetry event to a run and derives spans, changed files,
 * tool calls, and model calls from it — atomically, and idempotently by
 * event id (a retried delivery is acknowledged, never double-counted).
 */
export async function ingestEvent(
  prisma: PrismaClient,
  event: AgentEvent,
  scope: IngestScope,
): Promise<{ status: 'ingested' | 'duplicate'; runId: string }> {
  return prisma.$transaction(async (tx) => {
    const run = await resolveRun(tx, event, scope);
    const duplicate = await tx.event.findUnique({
      where: { id: event.id },
      select: { runId: true },
    });
    if (duplicate) return { status: 'duplicate' as const, runId: duplicate.runId };

    const spanId = await applySpan(tx, run.id, event);
    await tx.event.create({
      data: {
        id: event.id,
        runId: run.id,
        spanId,
        parentSpanId: event.parentSpanId ? internalSpanId(run.id, event.parentSpanId) : null,
        timestamp: new Date(event.timestamp),
        kind: event.kind,
        actorType: event.actor?.type ?? null,
        actorId: event.actor?.id ?? null,
        actorName: event.actor?.name ?? null,
        data: JSON.stringify(event.data),
        evidenceSource: event.evidence.source,
        evidenceConfidence: event.evidence.confidence,
        evidenceNote: event.evidence.note ?? null,
      },
    });
    await applyDerivedRecords(tx, run, event, spanId);
    return { status: 'ingested' as const, runId: run.id };
  });
}
