// Deterministic session metrics, derived purely from the event log.
// No LLM involvement — every number here must be reproducible from the JSONL.
import type { AgentariumEvent } from "./events.js";

export interface SessionMetrics {
  sessionId: string;
  eventCount: number;
  durationMs: number;
  agentsUsed: string[];
  subagentsSpawned: number;
  filesRead: string[];
  filesWritten: string[];
  toolsUsed: string[];
  toolCallCount: number;
  hooksFired: number;
  skillsAccessed: string[];
  skillsInferred: string[];
  validationFailures: number;
  validationPasses: number;
  repairLoops: number;
  finalStatus: "completed" | "failed" | "in-progress";
}

function emptyMetrics(sessionId: string): SessionMetrics {
  return {
    sessionId,
    eventCount: 0,
    durationMs: 0,
    agentsUsed: [],
    subagentsSpawned: 0,
    filesRead: [],
    filesWritten: [],
    toolsUsed: [],
    toolCallCount: 0,
    hooksFired: 0,
    skillsAccessed: [],
    skillsInferred: [],
    validationFailures: 0,
    validationPasses: 0,
    repairLoops: 0,
    finalStatus: "in-progress",
  };
}

function metadataString(event: AgentariumEvent, key: string): string | undefined {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

export function computeSessionMetrics(events: AgentariumEvent[]): SessionMetrics {
  if (events.length === 0) return emptyMetrics("unknown");

  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const sessionId = sorted[0]!.sessionId;
  const start = Date.parse(sorted[0]!.timestamp);
  const end = Date.parse(sorted[sorted.length - 1]!.timestamp);

  const agentsUsed = new Set<string>();
  const subagentIds = new Set<string>();
  const filesRead = new Set<string>();
  const filesWritten = new Set<string>();
  const toolsUsed = new Set<string>();
  const skillsAccessed = new Set<string>();
  const skillsInferred = new Set<string>();

  let hooksFired = 0;
  let validationFailures = 0;
  let validationPasses = 0;
  let toolCallCount = 0;
  let finalStatus: SessionMetrics["finalStatus"] = "in-progress";

  // A "repair loop" is one contiguous stretch that starts with a validation
  // failure and is later resolved by a validation pass. Consecutive failures
  // before that pass count as a single loop, not one loop each.
  let repairLoops = 0;
  let awaitingRepair = false;

  for (const event of sorted) {
    switch (event.type) {
      case "agent.started":
        agentsUsed.add(event.actor?.name ?? event.actor?.id ?? "unknown-agent");
        break;
      case "subagent.started":
        subagentIds.add(event.actor?.id ?? event.id);
        break;
      case "file.read": {
        const filePath = metadataString(event, "path");
        if (filePath) filesRead.add(filePath);
        break;
      }
      case "file.written": {
        const filePath = metadataString(event, "path");
        if (filePath) filesWritten.add(filePath);
        break;
      }
      case "tool.completed": {
        const tool = metadataString(event, "tool");
        if (tool) toolsUsed.add(tool);
        toolCallCount += 1;
        break;
      }
      case "hook.started":
        hooksFired += 1;
        break;
      case "skill.accessed": {
        const skill = metadataString(event, "skill");
        if (skill) skillsAccessed.add(skill);
        break;
      }
      case "skill.inferred": {
        const skill = metadataString(event, "skill");
        if (skill) skillsInferred.add(skill);
        break;
      }
      case "validation.failed":
        validationFailures += 1;
        awaitingRepair = true;
        break;
      case "validation.passed":
        validationPasses += 1;
        if (awaitingRepair) {
          repairLoops += 1;
          awaitingRepair = false;
        }
        break;
      case "task.completed":
        finalStatus = "completed";
        break;
      default:
        break;
    }
  }

  if (finalStatus !== "completed" && awaitingRepair) {
    finalStatus = "failed";
  }

  return {
    sessionId,
    eventCount: sorted.length,
    durationMs: Number.isFinite(end - start) ? end - start : 0,
    agentsUsed: [...agentsUsed].sort(),
    subagentsSpawned: subagentIds.size,
    filesRead: [...filesRead].sort(),
    filesWritten: [...filesWritten].sort(),
    toolsUsed: [...toolsUsed].sort(),
    toolCallCount,
    hooksFired,
    skillsAccessed: [...skillsAccessed].sort(),
    skillsInferred: [...skillsInferred].sort(),
    validationFailures,
    validationPasses,
    repairLoops,
    finalStatus,
  };
}
