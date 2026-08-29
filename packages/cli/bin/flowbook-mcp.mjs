#!/usr/bin/env node
// Thin launcher so `npx flowbook-mcp` (as wired into a target
// repo's .vscode/mcp.json by `flowbook init`) runs @flowbook/core's
// real MCP server (packages/core/mcp/server.ts) via tsx, regardless of
// which repo it's invoked from.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This file lives at packages/cli/bin/ -- the monorepo root is three
// levels up.
const MONOREPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const tsxCliPath = path.join(MONOREPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const serverEntry = path.join(MONOREPO_ROOT, "packages", "core", "mcp", "server.ts");

const child = spawn(process.execPath, [tsxCliPath, serverEntry], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to start flowbook MCP server:", err);
  process.exit(1);
});
