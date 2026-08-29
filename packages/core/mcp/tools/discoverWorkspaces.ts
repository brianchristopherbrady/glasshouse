// discover_workspaces — read-only tool returning the real member graph
// (packages, folders, chapters, or whatever the repo's own
// flowbook.members.json/package-manager config/folder layout produces)
// for the repo currently being watched. Lets an agent check, before calling
// link_workspaces, whether two members already have a declared dependency
// relationship or are genuinely independent -- and check `source` to see
// whether this repo has already been explicitly mapped (`config`) or is
// still running on a package-manager or folder-heuristic readout.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { discoverWorkspaceGraph } from "../../shared/workspace-graph.js";
import { REPO_ROOT } from "../../shared/paths.js";
import { withToolTelemetry, type ToolResult } from "../telemetry.js";

const InputShape = { sessionId: z.string().optional() };

export function registerDiscoverWorkspaces(server: McpServer): void {
  server.registerTool(
    "discover_workspaces",
    {
      title: "Discover Workspaces",
      description:
        "Read the current repo's real member structure (from its flowbook.members.json config, or failing that its package-manager workspaces config, or failing that a top-level-folder heuristic) and return every discovered member plus their real dependency edges. Check `source` to see which of those three actually produced the result.",
      inputSchema: InputShape,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    withToolTelemetry("discover_workspaces", async (_args: { sessionId?: string }) => {
      const graph = await discoverWorkspaceGraph(REPO_ROOT);
      const result: ToolResult = { content: [{ type: "text", text: JSON.stringify(graph, null, 2) }] };
      return {
        ok: true,
        summary: `source=${graph.source}, ${graph.members.length} member(s), ${graph.edges.length} dependency edge(s)`,
        result,
      };
    }),
  );
}
