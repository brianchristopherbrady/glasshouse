// Turns a raw AgentariumEvent into a short, human, story-like sentence.
// Every sentence is built ONLY from fields already present on the event --
// nothing here is invented or guessed. This is presentation, not inference:
// the event's `evidence` level is untouched by narration.
import type { AgentariumEvent } from "./events.js";

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

function relativeToRepo(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const marker = "/glasshouse/";
  const idx = norm.indexOf(marker);
  return idx >= 0 ? norm.slice(idx + marker.length) : basename(p);
}

function metaStr(event: AgentariumEvent, key: string): string | undefined {
  const v = event.metadata?.[key];
  return typeof v === "string" ? v : undefined;
}

function inputField(event: AgentariumEvent, key: string): string | undefined {
  const input = event.metadata?.input;
  if (!input || typeof input !== "object") return undefined;
  const v = (input as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

// Tool calls carry the actual file/path they touched in metadata.input, under
// different field names per tool. Pulling this out lets narration say "read
// world/anomalies.json" instead of just "used read_file".
const FILE_INPUT_FIELDS = ["filePath", "path", "query", "includePattern"] as const;

function inputFilePath(event: AgentariumEvent): string | undefined {
  for (const field of FILE_INPUT_FIELDS) {
    const v = inputField(event, field);
    if (v) return v;
  }
  return undefined;
}

const ACTOR_NOUN: Record<string, string> = {
  agent: "The agent",
  subagent: "the specialist",
  user: "You",
  system: "The system",
  hook: "A hook",
  tool: "A tool",
  skill: "A skill",
};

function who(event: AgentariumEvent): string {
  if (event.actor?.name) return event.actor.name;
  return ACTOR_NOUN[event.actor?.kind ?? "system"] ?? "Something";
}

/** One-line narration, suitable for a graph node, timeline row, or detail card. */
export function narrate(event: AgentariumEvent): string {
  switch (event.type) {
    case "session.started":
      return "A new Float session began.";
    case "prompt.received": {
      const prompt = metaStr(event, "prompt");
      return prompt ? `You asked: "${prompt.length > 80 ? prompt.slice(0, 80) + "..." : prompt}"` : "You sent a request.";
    }
    case "agent.started":
      return `${who(event)} took up the case.`;
    case "agent.stopped":
      return `${who(event)} stepped back.`;
    case "subagent.started": {
      const desc = inputField(event, "description");
      return desc ? `${who(event)} was summoned to: ${desc}.` : `${who(event)} was summoned.`;
    }
    case "subagent.stopped":
      return `${who(event)} reported back and stood down.`;
    case "decision.declared": {
      const reason = metaStr(event, "reason");
      return reason ? `Decided: ${event.label}. Reason: ${reason}` : `Decided: ${event.label}.`;
    }
    case "skill.discovered":
      return `${who(event)} found a relevant Skill: ${metaStr(event, "skill") ?? "unknown"}.`;
    case "skill.accessed":
      return `${who(event)} consulted the ${metaStr(event, "skill") ?? "unknown"} Skill.`;
    case "skill.inferred":
      return `Looks like ${metaStr(event, "skill") ?? "a Skill"} was used, though this is a guess.`;
    case "file.read": {
      const path = metaStr(event, "path");
      return path ? `${who(event)} read ${relativeToRepo(path)}.` : `${who(event)} read a file.`;
    }
    case "file.written": {
      const path = metaStr(event, "path");
      return path ? `${who(event)} edited ${relativeToRepo(path)}.` : `${who(event)} edited a file.`;
    }
    case "file.searched": {
      const path = metaStr(event, "path");
      return path ? `${who(event)} searched for "${path}".` : `${who(event)} searched the repo.`;
    }
    case "tool.requested": {
      const tool = metaStr(event, "tool") ?? "a tool";
      if (tool === "runSubagent") {
        const target = inputField(event, "agentName");
        return target ? `${who(event)} summoned ${target}.` : `${who(event)} summoned a specialist.`;
      }
      const filePath = inputFilePath(event);
      if (filePath) return `${who(event)} is about to look at ${relativeToRepo(filePath)}.`;
      const explanation = inputField(event, "explanation") ?? inputField(event, "goal");
      return explanation ? `${who(event)} is about to ${explanation.toLowerCase()}.` : `${who(event)} reached for ${tool}.`;
    }
    case "tool.completed": {
      const tool = metaStr(event, "tool") ?? "a tool";
      if (tool === "runSubagent") return `${who(event)} finished a delegated investigation.`;
      const filePath = inputFilePath(event);
      if (filePath) return `${who(event)} looked at ${relativeToRepo(filePath)}.`;
      const explanation = inputField(event, "explanation") ?? inputField(event, "goal");
      return explanation ? `${who(event)} finished: ${explanation.toLowerCase()}.` : `${who(event)} finished using ${tool}.`;
    }
    case "tool.failed":
      return `${who(event)}'s attempt with ${metaStr(event, "tool") ?? "a tool"} failed.`;
    case "mcp.tool.called":
      return `${who(event)} called the ${metaStr(event, "tool") ?? "MCP"} tool on the world server.`;
    case "mcp.resource.read":
      return `${who(event)} read the ${metaStr(event, "uri") ?? "world"} resource.`;
    case "hook.started":
      return `Hook fired: ${metaStr(event, "hookName") ?? event.label}.`;
    case "hook.completed":
      return `Hook finished: ${metaStr(event, "hookName") ?? event.label}.`;
    case "validation.started":
      return "The world validator began checking reality for consistency.";
    case "validation.passed":
      return "Reality checked out: the validator found no contradictions.";
    case "validation.failed": {
      const issues = event.metadata?.issues;
      const count = Array.isArray(issues) ? issues.length : undefined;
      return count ? `The validator found ${count} contradiction${count === 1 ? "" : "s"} in reality.` : "The validator found a contradiction in reality.";
    }
    case "context.changed":
      return event.label;
    case "world.changed":
      return "The world's on-disk files changed.";
    case "task.completed":
      return "The task was marked complete.";
    default:
      return event.label;
  }
}

/** Short present-tense fragment for compact spaces like graph node subtitles. */
export function narrateShort(event: AgentariumEvent): string {
  const full = narrate(event);
  return full.length > 60 ? full.slice(0, 57) + "..." : full;
}
