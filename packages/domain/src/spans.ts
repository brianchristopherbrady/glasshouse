import { z } from 'zod';
import { IdSchema } from './ids.js';
import { EvidenceSourceSchema, ConfidenceSchema } from './evidence.js';

export const SpanTypeSchema = z.enum([
  'workflow',
  'job',
  'step',
  'agent',
  'subagent',
  'skill',
  'model',
  'tool',
  'mcp',
  'shell',
  'file',
  'git',
  'test',
  'http',
  'github',
  'custom',
]);
export type SpanType = z.infer<typeof SpanTypeSchema>;

export const SpanStatusSchema = z.enum(['pending', 'running', 'success', 'failure', 'unknown']);
export type SpanStatus = z.infer<typeof SpanStatusSchema>;

/**
 * A span is a unit of work within a WorkflowRun's execution tree, modeled
 * on OpenTelemetry-style tracing semantics.
 */
export const SpanSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  parentSpanId: IdSchema.nullable(),
  type: SpanTypeSchema,
  name: z.string(),
  actorId: IdSchema.nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable(),
  durationMs: z.number().nonnegative().nullable(),
  status: SpanStatusSchema,
  attributes: z.record(z.string(), z.unknown()),
  source: EvidenceSourceSchema,
  confidence: ConfidenceSchema,
});
export type Span = z.infer<typeof SpanSchema>;
