// link_workspaces — lets an agent declare that touching one workspace
// package genuinely required touching another, during THIS session. This is
// the "declared" provenance path, same as trace_decision: flowbook never
// infers a causal link between two packages just because both were edited
// in the same session -- co-occurrence is not causation, and silently
// treating it as one would be exactly the kind of guess-presented-as-fact
// this tool exists to avoid. Without a call here, the Workspace Map only
// ever shows the mechanical package.json dependency graph plus which
// packages were independently touched -- never why.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createEvent } from "../../shared/events.js";
import { recordAndNotify } from "../../shared/emit.js";
import { resolveSessionId, resolveRunId } from "../telemetry.js";

const InputShape = {
  from: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().min(1),
  actorId: z.string().optional(),
  actorName: z.string().optional(),
  sessionId: z.string().optional(),
};

export function registerLinkWorkspaces(server: McpServer): void {
  server.registerTool(
    "link_workspaces",
    {
      title: "Link Workspaces",
      description:
        'Declare that a change in workspace package "from" required a change in workspace package "to" during this session (e.g. updating a web-component package required updating its React wrapper). Always requires a real reason -- never call this for packages that merely happened to both be edited without one causing the other.',
      inputSchema: InputShape,
      annotations: { readOnlyHint: false, idempotentHint: false },
    },
    async (args: { from: string; to: string; reason: string; actorId?: string; actorName?: string; sessionId?: string }) => {
      const sessionId = await resolveSessionId(args.sessionId);
      const runId = await resolveRunId();
      const event = createEvent({
        sessionId,
        type: "workspace.linked",
        source: "agent-declared",
        evidence: "declared",
        label: `${args.from} → ${args.to}`,
        actor: { id: args.actorId ?? "agent", kind: "agent", ...(args.actorName !== undefined && { name: args.actorName }) },
        metadata: { from: args.from, to: args.to, reason: args.reason, ...(runId !== undefined && { runId }) },
      });
      const stored = await recordAndNotify(event);
      return {
        content: [
          {
            type: "text" as const,
            text: `Workspace link recorded: "${stored.label}" (session ${stored.sessionId})`,
          },
        ],
      };
    },
  );
}
