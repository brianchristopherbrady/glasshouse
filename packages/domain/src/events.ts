import { z } from 'zod';
import { IdSchema } from './ids.js';
import { EvidenceSchema } from './evidence.js';

export const EventKindSchema = z.enum([
  'workflow.started',
  'workflow.completed',
  'workflow.failed',
  'job.started',
  'job.completed',
  'agent.started',
  'agent.completed',
  'agent.handoff.started',
  'agent.handoff.completed',
  'skill.available',
  'skill.configured',
  'skill.loaded',
  'skill.referenced',
  'tool.started',
  'tool.completed',
  'mcp.called',
  'shell.executed',
  'file.read',
  'file.created',
  'file.modified',
  'file.deleted',
  'git.commit',
  'github.pr.created',
  'github.pr.updated',
  'github.issue.created',
  'github.issue.updated',
  'github.comment.created',
  'test.started',
  'test.completed',
  'model.started',
  'model.completed',
  'error',
  'retry',
  'artifact.created',
]);
export type EventKind = z.infer<typeof EventKindSchema>;

export const ActorTypeSchema = z.enum(['workflow', 'agent', 'subagent', 'tool', 'system']);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const ActorSchema = z.object({
  type: ActorTypeSchema,
  id: IdSchema.optional(),
  name: z.string().optional(),
});
export type Actor = z.infer<typeof ActorSchema>;

/**
 * Identifies a run by its GitHub Actions identity instead of an internal id
 * — what a producer running inside a workflow actually knows
 * (GITHUB_REPOSITORY + GITHUB_RUN_ID). The server resolves it to a
 * WorkflowRun, creating a placeholder if the Actions run hasn't synced yet.
 */
export const RunCorrelationSchema = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'expected "owner/repo"'),
  providerRunId: z.string().regex(/^\d+$/, 'expected a numeric GitHub Actions run id'),
});
export type RunCorrelation = z.infer<typeof RunCorrelationSchema>;

/** Normalized event stream entry. Evidence provenance is always attached. */
export const AgentEventSchema = z
  .object({
    id: IdSchema,
    runId: IdSchema.optional(),
    correlation: RunCorrelationSchema.optional(),
    spanId: IdSchema.optional(),
    parentSpanId: IdSchema.optional(),
    timestamp: z.string().datetime(),
    kind: EventKindSchema,
    actor: ActorSchema.optional(),
    data: z.record(z.string(), z.unknown()),
    evidence: EvidenceSchema,
  })
  .refine((e) => e.runId !== undefined || e.correlation !== undefined, {
    message: 'either runId or correlation is required',
    path: ['runId'],
  });
export type AgentEvent = z.infer<typeof AgentEventSchema>;
