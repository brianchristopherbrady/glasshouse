// record_story_beat — lets an agent declare the two session-level beats no
// VS Code hook can observe on its own: an agent/persona taking up a case
// ("agent.started"), and a real unit of work being genuinely complete
// ("task.completed"). Both are the "declared" provenance path, same as
// trace_decision -- these are self-reported facts, not something AGENTARIUM
// inferred. Without this tool, shared/story.ts's flowchart (Story mode) can
// only ever populate agent/milestone nodes from prerecorded demo traces,
// because the live hook pipeline (scripts/agentarium-hook.mjs) has no event
// source for either type. Named without a dot for the same reason as
// trace_decision: MCP tool names must match [a-z0-9_-]+.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createEvent } from "../../shared/events.js";
import { recordAndNotify } from "../../shared/emit.js";
import { resolveSessionId } from "../telemetry.js";

const InputShape = {
  kind: z.enum(["agent", "milestone"]),
  label: z.string().min(1),
  actorId: z.string().optional(),
  actorName: z.string().optional(),
  reason: z.string().optional(),
  sessionId: z.string().optional(),
};

export function registerRecordStoryBeat(server: McpServer): void {
  server.registerTool(
    "record_story_beat",
    {
      title: "Record Story Beat",
      description:
        'Declare a session-level story beat: kind "agent" when a custom agent/persona genuinely takes up the case (label like "Mote took up the case"), or kind "milestone" when a real unit of work is genuinely complete (label like "Tomas Vale correction completed"). Use sparingly, at true transitions -- not once per turn, and not as a substitute for trace_decision.',
      inputSchema: InputShape,
      annotations: { readOnlyHint: false, idempotentHint: false },
    },
    async (args: {
      kind: "agent" | "milestone";
      label: string;
      actorId?: string;
      actorName?: string;
      reason?: string;
      sessionId?: string;
    }) => {
      const sessionId = await resolveSessionId(args.sessionId);
      const type = args.kind === "agent" ? ("agent.started" as const) : ("task.completed" as const);
      const event = createEvent({
        sessionId,
        type,
        source: "agent-declared",
        evidence: "declared",
        label: args.label,
        actor: { id: args.actorId ?? "agent", kind: "agent", ...(args.actorName !== undefined && { name: args.actorName }) },
        ...(args.reason !== undefined && { metadata: { reason: args.reason } }),
      });
      const stored = await recordAndNotify(event);
      return {
        content: [
          {
            type: "text" as const,
            text: `Recorded ${args.kind} beat: "${stored.label}" (session ${stored.sessionId})`,
          },
        ],
      };
    },
  );
}
