// validate_world — runs the same deterministic validator used by
// `npm run validate:world`, over MCP. Emits real validation.started /
// validation.passed / validation.failed events, since this call genuinely
// performs the check (not a guess about whether it would pass).
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadWorld } from "../../shared/world-loader.js";
import { validateWorld } from "../../shared/world-validator.js";
import { createEvent } from "../../shared/events.js";
import { recordAndNotify } from "../../shared/emit.js";
import { resolveSessionId, withToolTelemetry, type ToolResult } from "../telemetry.js";

const InputShape = { sessionId: z.string().optional() };

export function registerValidateWorld(server: McpServer): void {
  server.registerTool(
    "validate_world",
    {
      title: "Validate World",
      description:
        "Run the deterministic validator against the current on-disk world data and return { valid, issues, checkedAt }.",
      inputSchema: InputShape,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    withToolTelemetry("validate_world", async (args: { sessionId?: string }) => {
      const sessionId = await resolveSessionId(args.sessionId);

      await recordAndNotify(
        createEvent({
          sessionId,
          type: "validation.started",
          source: "mcp",
          evidence: "observed",
          label: "World validation started (via MCP)",
          actor: { id: "mcp-server", kind: "tool", name: "validate_world" },
        }),
      );

      const world = await loadWorld();
      const result = validateWorld(world);

      await recordAndNotify(
        createEvent({
          sessionId,
          type: result.valid ? "validation.passed" : "validation.failed",
          source: "mcp",
          evidence: "observed",
          label: result.valid
            ? "World validation passed"
            : `World validation failed (${result.issues.length} issue${result.issues.length === 1 ? "" : "s"})`,
          actor: { id: "mcp-server", kind: "tool", name: "validate_world" },
          metadata: { issues: result.issues },
        }),
      );

      const toolResult: ToolResult = { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      return {
        ok: result.valid,
        summary: result.valid ? "world valid" : `${result.issues.length} issue(s)`,
        result: toolResult,
      };
    }),
  );
}
