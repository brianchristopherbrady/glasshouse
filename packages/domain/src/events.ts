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

/** Normalized event stream entry. Evidence provenance is always attached. */
export const AgentEventSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  spanId: IdSchema.optional(),
  parentSpanId: IdSchema.optional(),
  timestamp: z.string().datetime(),
  kind: EventKindSchema,
  actor: ActorSchema.optional(),
  data: z.record(z.string(), z.unknown()),
  evidence: EvidenceSchema,
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;
