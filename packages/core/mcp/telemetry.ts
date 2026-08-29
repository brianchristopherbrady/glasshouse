// Shared plumbing for the flowbook MCP server: session id
// resolution and telemetry events describing the server's own tool calls /
// resource reads. Kept separate from tool logic so each tool file stays
// focused on its actual behavior.
import { createEvent } from "../shared/events.js";
import { recordAndNotify } from "../shared/emit.js";
import { getCurrentSessionId, getCurrentRun } from "../server/session.js";

const STANDALONE_SESSION_ID = "mcp-standalone";

/** Minimal shape tool handlers return, compatible with the MCP SDK's
 * CallToolResult. Kept as an explicit interface (rather than inferring an
 * inline literal) so branches with/without `isError` unify cleanly. */
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Resolves the session an MCP call should be attributed to. Falls back to a
 * fixed pseudo-session when no flowbook session is currently active, so
 * calls made outside a live agent session still persist somewhere. */
export async function resolveSessionId(explicit?: string): Promise<string> {
  if (explicit && explicit.trim().length > 0) return explicit;
  const current = await getCurrentSessionId();
  return current ?? STANDALONE_SESSION_ID;
}

/** The currently-declared run's id, if any (see mcp/tools/startRun.ts) --
 * every MCP-declared event should carry this in `metadata.runId` the same
 * way scripts/hook-pipeline.mjs stamps it on hook-observed events, so a
 * declared decision/handoff/link/beat doesn't silently fall outside the
 * dashboard's run filter just because it came from the MCP server instead
 * of a hook. */
export async function resolveRunId(): Promise<string | undefined> {
  const run = await getCurrentRun();
  return run?.runId;
}

export async function emitToolCall(opts: {
  sessionId: string;
  tool: string;
  args: unknown;
  durationMs: number;
  ok: boolean;
  summary?: string;
}): Promise<void> {
  const runId = await resolveRunId();
  const event = createEvent({
    sessionId: opts.sessionId,
    type: "mcp.tool.called",
    source: "mcp",
    evidence: "observed",
    label: `MCP tool called: ${opts.tool}`,
    actor: { id: "mcp-server", kind: "tool", name: opts.tool },
    metadata: {
      tool: opts.tool,
      args: opts.args,
      ok: opts.ok,
      ...(opts.summary !== undefined && { summary: opts.summary }),
      ...(runId !== undefined && { runId }),
    },
    durationMs: opts.durationMs,
  });
  await recordAndNotify(event);
}

export async function emitResourceRead(opts: { sessionId: string; uri: string }): Promise<void> {
  const runId = await resolveRunId();
  const event = createEvent({
    sessionId: opts.sessionId,
    type: "mcp.resource.read",
    source: "mcp",
    evidence: "observed",
    label: `MCP resource read: ${opts.uri}`,
    actor: { id: "mcp-server", kind: "tool", name: opts.uri },
    metadata: { uri: opts.uri, ...(runId !== undefined && { runId }) },
  });
  await recordAndNotify(event);
}

/** Wraps a tool handler so every call (success or failure) is recorded as a
 * `mcp.tool.called` event with real timing and a real success flag. */
export function withToolTelemetry<Args, Result>(
  toolName: string,
  handler: (args: Args) => Promise<{ ok: boolean; summary?: string; result: Result }>,
): (args: Args) => Promise<Result> {
  return async (args: Args) => {
    const sessionId = await resolveSessionId(
      (args as { sessionId?: string } | undefined)?.sessionId,
    );
    const start = Date.now();
    try {
      const { ok, summary, result } = await handler(args);
      await emitToolCall({ sessionId, tool: toolName, args, durationMs: Date.now() - start, ok, summary });
      return result;
    } catch (err) {
      await emitToolCall({
        sessionId,
        tool: toolName,
        args,
        durationMs: Date.now() - start,
        ok: false,
        summary: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}
