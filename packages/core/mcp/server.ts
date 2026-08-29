#!/usr/bin/env node
// flowbook MCP server — exposes decision-telemetry tools so any
// agent working in any consuming repo can declare a real decision or story
// beat. Deliberately small: this demonstrates what MCP contributes, it does
// not replace normal filesystem access. A consuming repo can extend this
// file with its own domain-specific tools/resources without touching the
// telemetry plumbing in mcp/telemetry.ts.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTraceDecision } from "./tools/traceDecision.js";
import { registerRecordStoryBeat } from "./tools/recordStoryBeat.js";
import { registerDiscoverWorkspaces } from "./tools/discoverWorkspaces.js";
import { registerLinkWorkspaces } from "./tools/linkWorkspaces.js";
import { registerHandoffAgent } from "./tools/handoffAgent.js";
import { registerStartRun } from "./tools/startRun.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "flowbook", version: "0.1.0" });

  registerTraceDecision(server);
  registerRecordStoryBeat(server);
  registerDiscoverWorkspaces(server);
  registerLinkWorkspaces(server);
  registerHandoffAgent(server);
  registerStartRun(server);

  return server;
}

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("flowbook MCP server running on stdio");
}

main().catch((err) => {
  console.error("flowbook MCP server failed to start:", err);
  process.exit(1);
});
