// inspect_world — read-only tool that returns a compact summary of the
// current world state. Real filesystem reads, real Zod parsing; nothing
// fabricated.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadWorld } from "../../shared/world-loader.js";
import { summarizeWorld } from "../worldSummary.js";
import { withToolTelemetry, type ToolResult } from "../telemetry.js";

const InputShape = { sessionId: z.string().optional() };

export function registerInspectWorld(server: McpServer): void {
  server.registerTool(
    "inspect_world",
    {
      title: "Inspect World",
      description:
        "Load the world data (relationships, corrections, anomalies, characters, institutions) and return a compact summary: counts and status breakdowns for relationships, corrections, anomalies (including systemic candidates/confirmed), characters (including open-provenance identities), and institutions.",
      inputSchema: InputShape,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    withToolTelemetry("inspect_world", async (_args: { sessionId?: string }) => {
      const world = await loadWorld();
      const summary = summarizeWorld(world);
      const result: ToolResult = { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      return {
        ok: true,
        summary: `${summary.relationships.count} relationships, ${summary.corrections.count} corrections, ${summary.anomalies.count} anomalies, ${summary.characters.count} characters`,
        result,
      };
    }),
  );
}
