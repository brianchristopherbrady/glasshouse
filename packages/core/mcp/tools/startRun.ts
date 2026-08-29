// start_run — lets an agent declare that a new, distinct unit of work
// ("run") is beginning within the current session. This is the "declared"
// provenance path, same as trace_decision: VS Code has no concept of a run
// narrower than a whole chat session, so this is entirely self-reported.
// Without this tool, a single long-running chat session (which can easily
// span many unrelated tasks) has no way to be filtered down to just the
// events belonging to one task -- see server/session.ts's
// getCurrentRun()/setCurrentRun(). Call this at the start of a genuinely
// new task within the current session, not for every prompt/turn.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createEvent } from "../../shared/events.js";
import { recordAndNotify } from "../../shared/emit.js";
import { resolveSessionId } from "../telemetry.js";
import { setCurrentRun } from "../../server/session.js";

const InputShape = {
  label: z.string().min(1),
  reason: z.string().optional(),
  sessionId: z.string().optional(),
};

export function registerStartRun(server: McpServer): void {
  server.registerTool(
    "start_run",
    {
      title: "Start Run",
      description:
        'Declare that a new, distinct unit of work ("run") is beginning within the current session, e.g. the user starting a new task unrelated to what came before in this same chat. Call once per genuinely new task, not per prompt/turn -- lets the dashboard filter this session down to just this run\'s events.',
      inputSchema: InputShape,
      annotations: { readOnlyHint: false, idempotentHint: false },
    },
    async (args: { label: string; reason?: string; sessionId?: string }) => {
      const sessionId = await resolveSessionId(args.sessionId);
      const event = createEvent({
        sessionId,
        type: "run.started",
        source: "agent-declared",
        evidence: "declared",
        label: args.label,
        actor: { id: "agent", kind: "agent" },
        ...(args.reason !== undefined && { metadata: { reason: args.reason } }),
      });
      const stored = await recordAndNotify(event);
      await setCurrentRun(stored.id, args.label);
      return {
        content: [
          {
            type: "text" as const,
            text: `Run started: "${stored.label}" (session ${stored.sessionId}, run ${stored.id})`,
          },
        ],
      };
    },
  );
}
