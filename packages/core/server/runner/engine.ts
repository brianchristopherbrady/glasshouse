// The real orchestrator: executes a registered Workflow function against a
// Scenario, producing a genuine Run made of real Spans -- not a scripted
// animation. A workflow's own code (server/runner/workflows/*.ts) calls
// `ctx.span(kind, label, fn)` around real work (write real files, run a
// real check, branch on real results); this module is what turns those
// calls into real Span records with real start/end times, real status,
// and real input/output, persisted and broadcast as they happen.
import { randomUUID } from "node:crypto";
import type { Run, RunStatus, Scenario, Span, SpanKind, SpanStatus } from "../../shared/flowbook-types.js";
import { DEFAULT_STORE_DIR } from "../../shared/store-dir.js";
import { getWorkflow } from "./registry.js";
import { publishRunUpdate } from "./runBus.js";
import { persistRun } from "./runStore.js";

export class RunFailure extends Error {}

/** What a workflow function receives to do real work and have it recorded.
 * Every method here creates a real Span, runs the real callback, and
 * records real success/failure -- there is no separate "fake" path. */
export interface RunContext {
  runId: string;
  input: Record<string, unknown>;
  scenario: Scenario | undefined;
  /** Root data directory for this run's persistence/artifacts -- defaults
   * to the real .flowbook/, overridable (see startRun's `storeDir` option)
   * so tests never touch real on-disk state, per
   * .github/instructions/tests.instructions.md. */
  storeDir: string;
  span<T>(
    kind: SpanKind,
    label: string,
    fn: (span: { setOutput: (output: unknown) => void }) => Promise<T> | T,
    opts?: { resourceId?: string; input?: unknown; parentId?: string },
  ): Promise<T>;
  currentSpanId(): string | undefined;
}

export type WorkflowFn = (ctx: RunContext) => Promise<void>;

function now(): number {
  return Date.now();
}

class RunExecution {
  readonly run: Run;
  private spanStack: string[] = [];

  constructor(run: Run) {
    this.run = run;
  }

  private emit(span?: Span) {
    publishRunUpdate({ run: { ...this.run, spans: [...this.run.spans] }, span });
  }

  private pushSpan(span: Span) {
    this.run.spans.push(span);
    this.spanStack.push(span.id);
    this.emit(span);
  }

  private closeSpan(id: string, status: SpanStatus, output?: unknown) {
    const span = this.run.spans.find((s) => s.id === id);
    if (!span) return;
    span.endTime = now();
    span.status = status;
    if (output !== undefined) span.output = output;
    this.spanStack = this.spanStack.filter((s) => s !== id);
    this.emit(span);
  }

  currentSpanId(): string | undefined {
    return this.spanStack.at(-1);
  }

  async span<T>(
    kind: SpanKind,
    label: string,
    fn: (span: { setOutput: (output: unknown) => void }) => Promise<T> | T,
    opts: { resourceId?: string; input?: unknown; parentId?: string } = {},
  ): Promise<T> {
    const span: Span = {
      id: randomUUID(),
      traceId: this.run.id,
      parentId: opts.parentId ?? this.currentSpanId(),
      resourceId: opts.resourceId,
      kind,
      label,
      startTime: now(),
      input: opts.input,
      status: "running",
    };
    this.pushSpan(span);
    let output: unknown;
    const setOutput = (value: unknown) => {
      output = value;
    };
    try {
      const result = await fn({ setOutput });
      this.closeSpan(span.id, "success", output !== undefined ? output : (result as unknown));
      return result;
    } catch (err) {
      this.closeSpan(span.id, "failure", { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }
}

/** Kicks off a registered workflow's real execution and returns the run
 * record immediately (`status: "running"`, no spans yet) -- callers that
 * need to respond to an HTTP request right away (see server/runnerRoutes.ts)
 * use this, then follow progress via subscribeToRuns()/the SSE stream.
 * Actual execution continues in the background; `whenDone` resolves once
 * the workflow (and its persistence) has actually finished. */
export function startRun(opts: {
  workflowId: string;
  scenario?: Scenario;
  input?: Record<string, unknown>;
  storeDir?: string;
}): { run: Run; whenDone: Promise<Run> } {
  const workflow = getWorkflow(opts.workflowId);
  if (!workflow) throw new RunFailure(`Unknown workflow: ${opts.workflowId}`);
  const storeDir = opts.storeDir ?? DEFAULT_STORE_DIR;

  const run: Run = {
    id: randomUUID(),
    workflowId: opts.workflowId,
    scenarioId: opts.scenario?.id,
    input: opts.input ?? opts.scenario?.input ?? {},
    startedAt: new Date().toISOString(),
    status: "running",
    spans: [],
  };

  const execution = new RunExecution(run);
  publishRunUpdate({ run: { ...run, spans: [] } });

  const ctx: RunContext = {
    runId: run.id,
    input: run.input,
    scenario: opts.scenario,
    storeDir,
    span: (kind, label, fn, spanOpts) => execution.span(kind, label, fn, spanOpts),
    currentSpanId: () => execution.currentSpanId(),
  };

  const whenDone = (async (): Promise<Run> => {
    let status: RunStatus = "success";
    try {
      await execution.span("workflow", workflow.label, async () => {
        await workflow.run(ctx);
      });
    } catch {
      status = "failure";
    }

    run.status = status;
    run.endedAt = new Date().toISOString();
    publishRunUpdate({ run: { ...run, spans: [...run.spans] } });
    await persistRun(run, storeDir);
    return run;
  })();

  return { run: { ...run }, whenDone };
}

/** Awaits a full run to completion -- convenience for tests and any
 * caller that genuinely wants to block until the workflow finishes. */
export async function executeRun(opts: {
  workflowId: string;
  scenario?: Scenario;
  input?: Record<string, unknown>;
  storeDir?: string;
}): Promise<Run> {
  return startRun(opts).whenDone;
}
