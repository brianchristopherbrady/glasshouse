import { z } from 'zod';
import { IdSchema, ProviderIdSchema } from './ids.js';
import { EvidenceSchema } from './evidence.js';
import { SpanStatusSchema } from './spans.js';

export const RunTriggerSchema = z.enum([
  'push',
  'pull_request',
  'issue',
  'issue_comment',
  'schedule',
  'workflow_dispatch',
  'manual',
  'unknown',
]);
export type RunTrigger = z.infer<typeof RunTriggerSchema>;

/** A single execution of a workflow. Root of a Span tree. */
export const WorkflowRunSchema = z.object({
  id: IdSchema,
  repositoryId: IdSchema,
  workflowDefinitionId: IdSchema.nullable(),
  workflowName: z.string(),
  providerId: ProviderIdSchema.optional(),
  runAttempt: z.number().int().positive().default(1),
  trigger: RunTriggerSchema,
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  pullRequestNumber: z.number().int().optional(),
  status: SpanStatusSchema,
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable(),
  durationMs: z.number().nonnegative().nullable(),
  engine: z.string().optional(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

/** An individual agent's participation within a run (maps to an agent-kind Span). */
export const AgentRunSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  spanId: IdSchema,
  agentDefinitionId: IdSchema.nullable(),
  name: z.string(),
  parentAgentRunId: IdSchema.nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable(),
  status: SpanStatusSchema,
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const AgentHandoffSchema = z.object({
  id: IdSchema,
  fromAgentRunId: IdSchema,
  toAgentRunId: IdSchema,
  timestamp: z.string().datetime(),
  reason: z.string().optional(),
  inputSummary: z.string().optional(),
  outputSummary: z.string().optional(),
  evidence: EvidenceSchema,
});
export type AgentHandoff = z.infer<typeof AgentHandoffSchema>;

export const ToolInvocationSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  spanId: IdSchema,
  agentRunId: IdSchema.nullable(),
  category: z.enum(['shell', 'github', 'mcp', 'filesystem', 'network', 'custom']),
  toolName: z.string(),
  argumentsPreview: z.string().optional(),
  resultPreview: z.string().optional(),
  status: SpanStatusSchema,
  durationMs: z.number().nonnegative().nullable(),
});
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;

export const SkillUsageSchema = z.object({
  id: IdSchema,
  skillDefinitionId: IdSchema,
  agentRunId: IdSchema,
  available: z.boolean(),
  configured: z.boolean(),
  loaded: z.union([z.boolean(), z.literal('unknown')]),
  referenced: z.union([z.boolean(), z.literal('unknown')]),
  executionEvidence: z.union([z.boolean(), z.literal('unknown')]),
  evidence: z.array(EvidenceSchema),
});
export type SkillUsage = z.infer<typeof SkillUsageSchema>;

export const FileOperationTypeSchema = z.enum([
  'read',
  'created',
  'modified',
  'deleted',
  'renamed',
  'committed',
]);
export type FileOperationType = z.infer<typeof FileOperationTypeSchema>;

export const FileOperationSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  spanId: IdSchema.nullable(),
  path: z.string(),
  previousPath: z.string().optional(),
  operation: FileOperationTypeSchema,
  additions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
  beforeSha: z.string().optional(),
  afterSha: z.string().optional(),
  diff: z.string().optional(),
  actorId: IdSchema.nullable(),
  evidence: EvidenceSchema,
});
export type FileOperation = z.infer<typeof FileOperationSchema>;

export const GitCommitSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  sha: z.string(),
  message: z.string(),
  authorName: z.string(),
  authoredAt: z.string().datetime(),
});
export type GitCommit = z.infer<typeof GitCommitSchema>;

export const PullRequestOperationSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  action: z.enum(['created', 'updated']),
  number: z.number().int(),
  title: z.string(),
  url: z.string().url(),
  timestamp: z.string().datetime(),
});
export type PullRequestOperation = z.infer<typeof PullRequestOperationSchema>;

export const IssueOperationSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  action: z.enum(['created', 'updated', 'commented']),
  number: z.number().int(),
  title: z.string(),
  url: z.string().url(),
  timestamp: z.string().datetime(),
});
export type IssueOperation = z.infer<typeof IssueOperationSchema>;

export const CheckOperationSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  name: z.string(),
  status: SpanStatusSchema,
  detailsUrl: z.string().url().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable(),
});
export type CheckOperation = z.infer<typeof CheckOperationSchema>;

export const ModelInvocationSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  spanId: IdSchema,
  model: z.string(),
  tokensInput: z.number().int().nonnegative().optional(),
  tokensOutput: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  durationMs: z.number().nonnegative().nullable(),
});
export type ModelInvocation = z.infer<typeof ModelInvocationSchema>;

export const ArtifactSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  name: z.string(),
  sizeBytes: z.number().int().nonnegative().optional(),
  url: z.string().url().optional(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const LogRecordSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  spanId: IdSchema.nullable(),
  source: z.enum(['actions', 'runtime', 'shell', 'tool', 'application']),
  timestamp: z.string().datetime(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
});
export type LogRecord = z.infer<typeof LogRecordSchema>;
