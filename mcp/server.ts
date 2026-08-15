#!/usr/bin/env node
// impossible-world MCP server — a small local MCP server exposing the Bureau
// of Impossible Geography's world data as resources, plus a handful of tools
// for inspecting, validating, and simulating changes to it, and for agents to
// record decision telemetry. See charter.md "MCP SERVER" / "DECISION
// TELEMETRY". Deliberately small: this demonstrates what MCP contributes, it
// does not replace normal filesystem access.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerInspectWorld } from "./tools/inspectWorld.js";
import { registerValidateWorld } from "./tools/validateWorld.js";
import { registerFindDependencies } from "./tools/findDependencies.js";
import { registerTraceDecision } from "./tools/traceDecision.js";
import { registerRecordStoryBeat } from "./tools/recordStoryBeat.js";
import { registerSimulateChange } from "./tools/simulateChange.js";
import { registerWorldResources } from "./resources/worldResources.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "impossible-world", version: "0.1.0" });

  registerInspectWorld(server);
  registerValidateWorld(server);
  registerFindDependencies(server);
  registerTraceDecision(server);
  registerRecordStoryBeat(server);
  registerSimulateChange(server);
  registerWorldResources(server);

  return server;
}

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("impossible-world MCP server running on stdio");
}

main().catch((err) => {
  console.error("impossible-world MCP server failed to start:", err);
  process.exit(1);
});
