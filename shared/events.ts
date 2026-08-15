// The single normalized event shape all of AGENTARIUM is built from.
// Every event must be honest about its provenance — see `evidence`.
import { z } from "zod";
import { randomUUID } from "node:crypto";

export const AgentEventTypeSchema = z.enum([
  "session.started",
  "prompt.received",

  "agent.started",
  "agent.stopped",

  "subagent.started",
  "subagent.stopped",

  "decision.declared",

  "skill.discovered",
  "skill.accessed",
  "skill.inferred",

  "file.read",
  "file.written",
  "file.searched",

  "tool.requested",
  "tool.started",
  "tool.completed",
  "tool.failed",

  "mcp.resource.read",
  "mcp.tool.called",

  "hook.started",
  "hook.completed",

  "validation.started",
  "validation.passed",
  "validation.failed",

  "context.changed",

  "world.changed",

  "task.completed",
]);
export type AgentEventType = z.infer<typeof AgentEventTypeSchema>;

export const ActorKindSchema = z.enum([
  "agent",
  "subagent",
  "skill",
  "tool",
  "hook",
  "user",
  "system",
]);
export type ActorKind = z.infer<typeof ActorKindSchema>;

export const EventSourceSchema = z.enum([
  "hook",
  "mcp",
  "filesystem",
  "agent-declared",
  "system",
  "demo",
]);
export type EventSource = z.infer<typeof EventSourceSchema>;

export const EvidenceLevelSchema = z.enum(["observed", "declared", "inferred"]);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

export const ActorSchema = z.object({
  id: z.string(),
  kind: ActorKindSchema,
  name: z.string().optional(),
});

export const AgentariumEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),

  timestamp: z.string(),
  durationMs: z.number().optional(),

  type: AgentEventTypeSchema,

  actor: ActorSchema.optional(),

  parentId: z.string().optional(),

  source: EventSourceSchema,
  evidence: EvidenceLevelSchema,

  label: z.string(),

  metadata: z.record(z.string(), z.unknown()).optional(),

  raw: z.unknown().optional(),
});
export type AgentariumEvent = z.infer<typeof AgentariumEventSchema>;

/**
 * `demo` events are a fourth provenance label shown in the UI, but they are
 * always carried by `evidence: "observed"` (or whatever the recording used)
 * plus `source: "demo"` — the two fields compose rather than duplicate.
 */
export function isDemoEvent(event: AgentariumEvent): boolean {
  return event.source === "demo";
}

export interface CreateEventInput {
  sessionId: string;
  type: AgentEventType;
  source: EventSource;
  evidence: EvidenceLevel;
  label: string;
  actor?: z.infer<typeof ActorSchema>;
  parentId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  raw?: unknown;
  timestamp?: string;
  id?: string;
}

// Event types whose evidence level is fixed by definition. These guard
// against the single most dangerous observability bug: an inferred guess
// silently being displayed as a directly-observed fact.
const INFERRED_ONLY_TYPES: ReadonlySet<AgentEventType> = new Set(["skill.inferred"]);
const NEVER_INFERRED_TYPES: ReadonlySet<AgentEventType> = new Set([
  "session.started",
  "prompt.received",
  "agent.started",
  "agent.stopped",
  "subagent.started",
  "subagent.stopped",
  "file.read",
  "file.written",
  "file.searched",
  "tool.requested",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "mcp.resource.read",
  "mcp.tool.called",
  "hook.started",
  "hook.completed",
  "validation.started",
  "validation.passed",
  "validation.failed",
  "task.completed",
]);

/**
 * Returns a list of provenance problems with an event, e.g. an `agent.started`
 * event (always directly observed via a hook) incorrectly marked "inferred".
 * Empty array means the event's evidence level is internally consistent.
 */
export function checkEvidenceConsistency(event: Pick<AgentariumEvent, "type" | "evidence">): string[] {
  const issues: string[] = [];
  if (INFERRED_ONLY_TYPES.has(event.type) && event.evidence !== "inferred") {
    issues.push(`${event.type} events must use evidence "inferred", got "${event.evidence}".`);
  }
  if (NEVER_INFERRED_TYPES.has(event.type) && event.evidence === "inferred") {
    issues.push(`${event.type} is directly observed and must never be marked "inferred".`);
  }
  if (event.type === "decision.declared" && event.evidence !== "declared") {
    issues.push(`decision.declared events must use evidence "declared", got "${event.evidence}".`);
  }
  return issues;
}

/** Builds a fully-formed, schema-valid event, filling in id/timestamp defaults. */
export function createEvent(input: CreateEventInput): AgentariumEvent {
  const event: AgentariumEvent = {
    id: input.id ?? randomUUID(),
    sessionId: input.sessionId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    type: input.type,
    source: input.source,
    evidence: input.evidence,
    label: input.label,
    ...(input.actor !== undefined && { actor: input.actor }),
    ...(input.parentId !== undefined && { parentId: input.parentId }),
    ...(input.durationMs !== undefined && { durationMs: input.durationMs }),
    ...(input.metadata !== undefined && { metadata: input.metadata }),
    ...(input.raw !== undefined && { raw: input.raw }),
  };
  const parsed = AgentariumEventSchema.parse(event);
  const provenanceIssues = checkEvidenceConsistency(parsed);
  if (provenanceIssues.length > 0) {
    throw new Error(`Refusing to create event with inconsistent provenance: ${provenanceIssues.join(" ")}`);
  }
  return parsed;
}
