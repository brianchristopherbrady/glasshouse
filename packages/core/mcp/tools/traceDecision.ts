// trace_decision — lets an agent deliberately emit a concise decision
// summary. This is the "declared" provenance path: the agent is
// self-reporting a real decision it made, not something flowbook
// inferred. This should be used sparingly, at meaningful transitions --
// not before every tool call. Named without a dot: MCP tool names must
// match [a-z0-9_-]+, so a dotted name is invalid as an actual registered
// tool name.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createEvent } from "../../shared/events.js";
import { recordAndNotify } from "../../shared/emit.js";
import { resolveSessionId, resolveRunId } from "../telemetry.js";

const InputShape = {
  decision: z.string().min(1),
  reason: z.string().min(1),
  next: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  sessionId: z.string().optional(),
};

export function registerTraceDecision(server: McpServer): void {
  server.registerTool(
    "trace_decision",
    {
      title: "Trace Decision",
      description:
        "Record a concise, honest decision summary at a meaningful transition (interpretation, specialist selection, plan change, failure diagnosis, or completion). Do not call this before every tool use.",
      inputSchema: InputShape,
      annotations: { readOnlyHint: false, idempotentHint: false },
    },
    async (args: {
      decision: string;
      reason: string;
      next?: string;
      alternatives?: string[];
      confidence?: number;
      sessionId?: string;
    }) => {
      const sessionId = await resolveSessionId(args.sessionId);
      const runId = await resolveRunId();
      const event = createEvent({
        sessionId,
        type: "decision.declared",
        source: "agent-declared",
        evidence: "declared",
        label: args.decision,
        actor: { id: "agent", kind: "agent" },
        metadata: {
          reason: args.reason,
          ...(args.next !== undefined && { next: args.next }),
          ...(args.alternatives !== undefined && { alternatives: args.alternatives }),
          ...(args.confidence !== undefined && { confidence: args.confidence }),
          ...(runId !== undefined && { runId }),
        },
      });
      const stored = await recordAndNotify(event);
      return {
        content: [
          {
            type: "text" as const,
            text: `Decision recorded: "${stored.label}" (session ${stored.sessionId})`,
          },
        ],
      };
    },
  );
}
