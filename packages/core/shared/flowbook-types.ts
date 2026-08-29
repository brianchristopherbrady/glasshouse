// Flowbook's canonical Blueprint/Run data model -- deliberately separate
// from shared/events.ts's FlowbookEvent (which observes a real VS Code
// coding agent via hooks/MCP). This model is for a different, second
// source: workflows this package itself can actually EXECUTE on demand
// (press Run), not just observe. See docs/flowbook-vision.md.
//
// Blueprint = design-time resources (Workflow/Agent/Skill/Tool/Artifact/
// Evaluation), read from a workflow's own registration -- stable, not
// per-run. Run = one real execution of a Workflow+Scenario, made of Spans
// (a real trace/span model, matching the observability-ecosystem shape the
// vision calls for) -- one Run's spans are its history, immutable once
// recorded.
import { z } from "zod";

export const ResourceKindSchema = z.enum([
  "workflow",
  "agent",
  "prompt",
  "instruction",
  "skill",
  "tool",
  "artifact",
  "evaluation",
  "humanGate",
]);
export type ResourceKind = z.infer<typeof ResourceKindSchema>;

/** A design-time capability declaration -- what an Agent CAN do, not what
 * it did in any particular run. Real data a Blueprint graph renders
 * directly, not inferred from execution. */
export const AgentResourceSchema = z.object({
  kind: z.literal("agent"),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  model: z.string().optional(),
  /** Prompt/instruction resource ids this agent references, per its own
   * registration -- distinct from `skills`/`tools` (capabilities it can
   * invoke) since a prompt/instruction is read, not invoked. */
  prompt: z.string().optional(),
  instructions: z.string().optional(),
  /** Skill/tool ids this agent can invoke, per its own registration. */
  skills: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  /** Agent ids this agent can hand off to. */
  handoffs: z.array(z.string()).default([]),
});
export type AgentResource = z.infer<typeof AgentResourceSchema>;

/** A prompt template: source text with real `{{variable}}` placeholders,
 * plus (once a Run has used it) the exact resolved text a model actually
 * received -- see `resolvedFor()` in server/runner and Span.metadata's
 * `resolvedTemplate` field on the span that rendered it. Per
 * docs/flowbook-vision.md: developers need to see the actual model input,
 * not merely the template. */
export const PromptResourceSchema = z.object({
  kind: z.literal("prompt"),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  version: z.number().default(1),
  /** The real source template, e.g. "Refactor {{document}} to satisfy:\n{{request}}". */
  template: z.string(),
  /** `{{name}}` placeholders the template actually contains -- derived
   * mechanically from the template text, never hand-maintained separately
   * (see `extractTemplateVariables` in shared/prompt-template.ts). */
  variables: z.array(z.string()).default([]),
});
export type PromptResource = z.infer<typeof PromptResourceSchema>;

/** System/developer-level instructions attached to an agent -- same
 * Template/Resolved distinction as Prompt, but instructions are typically
 * static per run (no per-run variables) rather than rendered against
 * per-run input. */
export const InstructionResourceSchema = z.object({
  kind: z.literal("instruction"),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  version: z.number().default(1),
  template: z.string(),
});
export type InstructionResource = z.infer<typeof InstructionResourceSchema>;

export const SkillResourceSchema = z.object({
  kind: z.literal("skill"),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  version: z.number().default(1),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
});
export type SkillResource = z.infer<typeof SkillResourceSchema>;

export const ToolResourceSchema = z.object({
  kind: z.literal("tool"),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});
export type ToolResource = z.infer<typeof ToolResourceSchema>;

export const ArtifactResourceSchema = z.object({
  kind: z.literal("artifact"),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  /** Path relative to the workflow's own artifact root -- real file on
   * disk, not a synthetic placeholder (see server/runner/artifacts.ts). */
  path: z.string(),
});
export type ArtifactResource = z.infer<typeof ArtifactResourceSchema>;

export const EvaluationResourceSchema = z.object({
  kind: z.literal("evaluation"),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});
export type EvaluationResource = z.infer<typeof EvaluationResourceSchema>;

/** An explicit human approval/input step -- a real gate a workflow can
 * pause at, not merely an evaluation (which is automated). No workflow
 * uses this yet (document-refactor has no human-in-the-loop step), but
 * it's part of the declared Resource union per docs/flowbook-vision.md so
 * the schema doesn't silently omit a kind the vision calls first-class. */
export const HumanGateResourceSchema = z.object({
  kind: z.literal("humanGate"),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});
export type HumanGateResource = z.infer<typeof HumanGateResourceSchema>;

export const WorkflowResourceSchema = z.object({
  kind: z.literal("workflow"),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  /** Agent ids that participate in this workflow, in their Blueprint
   * declaration order (not execution order -- that's a Run's spans). */
  agents: z.array(z.string()).default([]),
});
export type WorkflowResource = z.infer<typeof WorkflowResourceSchema>;

export const ResourceSchema = z.discriminatedUnion("kind", [
  WorkflowResourceSchema,
  AgentResourceSchema,
  PromptResourceSchema,
  InstructionResourceSchema,
  SkillResourceSchema,
  ToolResourceSchema,
  ArtifactResourceSchema,
  EvaluationResourceSchema,
  HumanGateResourceSchema,
]);
export type Resource = z.infer<typeof ResourceSchema>;

export const RelationshipTypeSchema = z.enum([
  "references",
  "uses",
  "invokes",
  "reads",
  "writes",
  "modifies",
  "produces",
  "validates",
  "handsOff",
  "branchesTo",
  "dependsOn",
]);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

/** One Blueprint edge -- always declared by the workflow's own
 * registration (shared/flowbook-registry.ts's REGISTERED_WORKFLOWS), never
 * inferred from a run. */
export const RelationshipSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: RelationshipTypeSchema,
  label: z.string().optional(),
});
export type Relationship = z.infer<typeof RelationshipSchema>;

/** A Blueprint is one workflow's full declared architecture: its resources
 * plus the relationships between them. Stable across runs. */
export interface Blueprint {
  workflowId: string;
  resources: Resource[];
  relationships: Relationship[];
}

/** A reproducible input configuration for a workflow -- the Storybook
 * "story" equivalent. Scenarios are registered alongside a workflow (see
 * shared/flowbook-registry.ts), not invented at run time. */
export const ScenarioSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  /** Injected failure mode, if any -- lets a scenario deterministically
   * reproduce a branch (e.g. "testFailure" makes run-tests fail once
   * before the agent revises and it passes). Real branching logic reads
   * this, nothing about it is faked after the fact. */
  failureInjection: z.string().optional(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const RunStatusSchema = z.enum(["queued", "running", "success", "failure"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const SpanStatusSchema = z.enum(["running", "success", "failure"]);
export type SpanStatus = z.infer<typeof SpanStatusSchema>;

export const SpanKindSchema = z.enum([
  "workflow",
  "agent",
  "prompt",
  "skill",
  "tool",
  "handoff",
  "artifact",
  "evaluation",
  "custom",
]);
export type SpanKind = z.infer<typeof SpanKindSchema>;

/** One real unit of execution within a Run -- matches conventional
 * trace/span shapes (id/traceId/parentId/start/end) so this composes with
 * the wider observability ecosystem instead of inventing a proprietary
 * model, per docs/flowbook-vision.md. Every field here is produced by the
 * orchestrator actually executing (server/runner/engine.ts) -- nothing is
 * synthesized after the fact. */
export const SpanSchema = z.object({
  id: z.string(),
  traceId: z.string(),
  parentId: z.string().optional(),
  resourceId: z.string().optional(),
  kind: SpanKindSchema,
  label: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  status: SpanStatusSchema,
});
export type Span = z.infer<typeof SpanSchema>;

export const RunSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  scenarioId: z.string().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  status: RunStatusSchema,
  spans: z.array(SpanSchema).default([]),
});
export type Run = z.infer<typeof RunSchema>;
