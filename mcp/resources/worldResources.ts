// Read-only MCP resources exposing the example world's data as context.
// Each read emits a real mcp.resource.read event (source "mcp", evidence
// "observed") — this really happened, it's not a guess.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadWorld, DEFAULT_WORLD_DIR } from "../../shared/world-loader.js";
import { summarizeWorld } from "../worldSummary.js";
import { resolveSessionId, emitResourceRead } from "../telemetry.js";

async function readWorldFile(name: string): Promise<unknown> {
  const raw = await readFile(path.join(DEFAULT_WORLD_DIR, name), "utf-8");
  return JSON.parse(raw);
}

export function registerWorldResources(server: McpServer): void {
  server.registerResource(
    "world-summary",
    "world://summary",
    { title: "World Summary", description: "Compact counts/ids summary of the current world state.", mimeType: "application/json" },
    async (uri) => {
      const sessionId = await resolveSessionId();
      await emitResourceRead({ sessionId, uri: uri.href });
      const world = await loadWorld();
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(summarizeWorld(world), null, 2) }] };
    },
  );

  server.registerResource(
    "world-institutions",
    "world://institutions",
    { title: "World Institutions", description: "The governing and executing institutions, and their correction permissions, biases, and authorizations.", mimeType: "application/json" },
    async (uri) => {
      const sessionId = await resolveSessionId();
      await emitResourceRead({ sessionId, uri: uri.href });
      const institutions = await readWorldFile("institutions.json");
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(institutions, null, 2) }] };
    },
  );

  server.registerResource(
    "world-relationships",
    "world://relationships",
    { title: "World Relationships", description: "Every recognized relationship currently holding the world's structure together.", mimeType: "application/json" },
    async (uri) => {
      const sessionId = await resolveSessionId();
      await emitResourceRead({ sessionId, uri: uri.href });
      const relationships = await readWorldFile("relationships.json");
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(relationships, null, 2) }] };
    },
  );

  server.registerResource(
    "world-history",
    "world://history",
    { title: "World History", description: "Recorded historical snapshots of the world.", mimeType: "application/json" },
    async (uri) => {
      const sessionId = await resolveSessionId();
      await emitResourceRead({ sessionId, uri: uri.href });
      const historyDir = path.join(DEFAULT_WORLD_DIR, "history");
      let files: string[] = [];
      try {
        files = (await readdir(historyDir)).filter((f) => f.endsWith(".json")).sort();
      } catch {
        files = [];
      }
      const entries = await Promise.all(
        files.map(async (file) => ({
          file,
          content: JSON.parse(await readFile(path.join(historyDir, file), "utf-8")),
        })),
      );
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(entries, null, 2) }] };
    },
  );
}
