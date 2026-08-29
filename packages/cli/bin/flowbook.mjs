#!/usr/bin/env node
// flowbook CLI: `flowbook start` runs the real workflow orchestrator +
// dashboard against a target repo (default: cwd); `flowbook init`
// scaffolds an empty `flowbook.config.mjs` so that repo can declare its
// own workflow modules for discovery (see server/runner/discovery.ts).
//
// Kept dependency-free (Node core modules only) so the CLI itself never
// needs a build step to run -- only the server it spawns (via tsx) needs
// the package's own node_modules.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

// This file lives at packages/cli/bin/ -- the monorepo root (where
// node_modules/ and packages/core/ live) is three levels up.
const MONOREPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CORE_ROOT = path.join(MONOREPO_ROOT, "packages", "core");

// Invoke tsx's own JS CLI entry via `node` directly (rather than the
// node_modules/.bin/tsx(.cmd) shim) so spawn() never needs shell: true --
// that option would otherwise concatenate args unescaped on Windows,
// which Node's child_process itself warns is a real injection risk.
function tsxCliPath() {
  return path.join(MONOREPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") args.repo = argv[++i];
    else if (a === "--port") args.port = argv[++i];
    else if (a === "--client-port") args.clientPort = argv[++i];
    else args._.push(a);
  }
  return args;
}

async function cmdStart(args) {
  const repoRoot = path.resolve(args.repo ?? process.cwd());
  const serverEntry = path.join(CORE_ROOT, "server", "index.ts");
  const env = { ...process.env, FLOWBOOK_REPO_ROOT: repoRoot };
  if (args.port) env.FLOWBOOK_COLLECTOR_PORT = args.port;
  if (args.clientPort) env.FLOWBOOK_CLIENT_PORT = args.clientPort;

  console.log(`flowbook watching: ${repoRoot}`);
  const child = spawn(process.execPath, [tsxCliPath(), serverEntry], { stdio: "inherit", env });
  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (err) => {
    console.error("Failed to start flowbook server:", err);
    process.exit(1);
  });
}

async function cmdInit(args) {
  const repoRoot = path.resolve(args.repo ?? process.cwd());

  // Config scaffold: lets this repo declare its own workflow modules
  // (server/runner/discovery.ts glob-discovers and imports them for their
  // registerWorkflow() side effect) instead of only ever showing this
  // package's own built-in demo workflow. Never overwrites an existing
  // config -- a repo that already has one has presumably customized it.
  const configPath = path.join(repoRoot, "flowbook.config.mjs");
  let configWritten = false;
  try {
    await readFile(configPath, "utf-8");
  } catch {
    await writeFile(
      configPath,
      `// See node_modules/@flowbook/core/shared/flowbook-config.ts for the full schema.
export default {
  // Glob patterns (relative to this file) for modules that call
  // registerWorkflow() when imported -- e.g. "src/workflows/**/*.workflow.ts".
  workflows: [],
};
`,
      "utf-8",
    );
    configWritten = true;
  }

  console.log(`flowbook initialized in ${repoRoot}`);
  if (configWritten) {
    console.log(`  wrote ${path.relative(repoRoot, configPath)}`);
  } else {
    console.log(`  ${path.relative(repoRoot, configPath)} already exists, left unchanged`);
  }
  console.log("");
  console.log("Next: run `npx flowbook start` from this repo to open the dashboard.");
}

function printHelp() {
  console.log(`flowbook -- a Storybook for agentic AI: explore, run, and debug agentic workflows.

Usage:
  flowbook start [--repo <path>] [--port <n>] [--client-port <n>]
      Start the orchestrator + dashboard, watching <path> (default: cwd).

  flowbook init [--repo <path>]
      Scaffold an empty flowbook.config.mjs in <path> (default: cwd) so
      flowbook can discover this repo's own workflow modules.
`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (cmd) {
    case "start":
      await cmdStart(args);
      break;
    case "init":
      await cmdInit(args);
      break;
    case undefined:
    case "--help":
    case "-h":
    case "help":
      printHelp();
      process.exit(0);
      break;
    default:
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
