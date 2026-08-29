// handoff_agent — lets an agent declare that it finished its part of a task
// and is passing the rest to a named successor agent (VS Code's real
// `handoffs:` custom-agent frontmatter feature -- see
// .github/agents/*.agent.md `handoffs:` lists). This is the "declared"
// provenance path, same as trace_decision: VS Code has no dedicated hook
// for a whole-chat agent handoff (SubagentStart/SubagentStop is a
// different mechanism -- in-turn delegation to a subagent that reports
// back in the same turn), so this is self-reported, not observed. Emits
// one real `agent.handoff` event carrying both agents' names/ids, so
// shared/story.ts can draw a real handoff chain instead of flattening
// every agent onto one "main" lane.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createEvent } from "../../shared/events.js";
import { recordAndNotify } from "../../shared/emit.js";
import { resolveSessionId, resolveRunId } from "../telemetry.js";

const InputShape = {
  fromAgent: z.string().min(1),
  toAgent: z.string().min(1),
  reason: z.string().min(1),
  summary: z.string().optional(),
  sessionId: z.string().optional(),
};

export function registerHandoffAgent(server: McpServer): void {
  server.registerTool(
    "handoff_agent",
    {
      title: "Handoff Agent",
      description:
        'Declare that agent "fromAgent" finished its part of the task and is passing it to agent "toAgent" for a real, specific reason (e.g. "planner" handing off to "implementer" once a plan is written). Call this once per genuine handoff, not per turn -- never call it just because two different custom agents were both active in a session without one actually finishing and passing work to the other.',
      inputSchema: InputShape,
      annotations: { readOnlyHint: false, idempotentHint: false },
    },
    async (args: { fromAgent: string; toAgent: string; reason: string; summary?: string; sessionId?: string }) => {
      const sessionId = await resolveSessionId(args.sessionId);
      const runId = await resolveRunId();
      const event = createEvent({
        sessionId,
        type: "agent.handoff",
        source: "agent-declared",
        evidence: "declared",
        label: `${args.fromAgent} → ${args.toAgent}`,
        actor: { id: args.fromAgent, kind: "agent", name: args.fromAgent },
        metadata: {
          fromAgent: args.fromAgent,
          toAgent: args.toAgent,
          reason: args.reason,
          ...(args.summary !== undefined && { summary: args.summary }),
          ...(runId !== undefined && { runId }),
        },
      });
      const stored = await recordAndNotify(event);
      return {
        content: [
          {
            type: "text" as const,
            text: `Handoff recorded: "${stored.label}" (session ${stored.sessionId})`,
          },
        ],
      };
    },
  );
}
