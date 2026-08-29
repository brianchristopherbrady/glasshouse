#!/usr/bin/env node
// flowbook CLI: `flowbook start` runs the collector +
// dashboard against a target repo (default: cwd); `flowbook init`
// scaffolds the VS Code hook + MCP wiring into a target repo so it can be
// observed at all.
//
// Kept dependency-free (Node core modules only), same rule as
// scripts/flowbook-hook.mjs, so the CLI itself never needs a build
// step to run -- only the server it spawns (via tsx) needs the package's
// own node_modules.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile, readdir, cp } from "node:fs/promises";

// This file lives at packages/cli/bin/ -- the monorepo root (where
// node_modules/, .github/, and packages/core/ all live) is three levels up.
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

const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "Stop",
];

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

async function cmdInit(args) {
  const repoRoot = path.resolve(args.repo ?? process.cwd());
  const hooksDir = path.join(repoRoot, ".github", "hooks");
  const vscodeDir = path.join(repoRoot, ".vscode");
  await mkdir(hooksDir, { recursive: true });
  await mkdir(vscodeDir, { recursive: true });

  // Hook wiring: every lifecycle event runs the same dependency-free script,
  // resolved via npx so it works whether flowbook is a local
  // devDependency or a global install.
  const hookConfigPath = path.join(hooksDir, "flowbook.json");
  const hookCommand = { type: "command", command: "npx flowbook-hook", timeout: 5 };
  const hooksFile = await readJsonIfExists(hookConfigPath, { hooks: {} });
  hooksFile.hooks ??= {};
  for (const evt of HOOK_EVENTS) {
    hooksFile.hooks[evt] ??= [];
    const already = hooksFile.hooks[evt].some((h) => h && h.command === hookCommand.command);
    if (!already) hooksFile.hooks[evt].push(hookCommand);
  }
  await writeFile(hookConfigPath, JSON.stringify(hooksFile, null, 2) + "\n", "utf-8");

  // MCP wiring: registers the decision-telemetry tools (trace_decision,
  // record_story_beat) so agents working in this repo can declare decisions.
  const mcpConfigPath = path.join(vscodeDir, "mcp.json");
  const mcpFile = await readJsonIfExists(mcpConfigPath, { servers: {} });
  mcpFile.servers ??= {};
  if (!mcpFile.servers["flowbook"]) {
    mcpFile.servers["flowbook"] = { command: "npx", args: ["flowbook-mcp"] };
  }
  await writeFile(mcpConfigPath, JSON.stringify(mcpFile, null, 2) + "\n", "utf-8");

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

  // Skill wiring: copies this package's own generic Skills (the ones that
  // populate the Workspace Map / Storyboard / Book from real telemetry)
  // into the target repo's .github/skills/, since Skills are discovered
  // per-repo, not from this package's own install directory. Never
  // overwrites a Skill the target repo already has (e.g. a customized copy).
  const sourceSkillsDir = path.join(MONOREPO_ROOT, ".github", "skills");
  const targetSkillsDir = path.join(repoRoot, ".github", "skills");
  const skillsWritten = [];
  let skillDirs = [];
  try {
    skillDirs = (await readdir(sourceSkillsDir, { withFileTypes: true })).filter((d) => d.isDirectory());
  } catch {
    skillDirs = [];
  }
  for (const dir of skillDirs) {
    const dest = path.join(targetSkillsDir, dir.name);
    let alreadyExists = true;
    try {
      await readFile(path.join(dest, "SKILL.md"), "utf-8");
    } catch {
      alreadyExists = false;
    }
    if (alreadyExists) continue;
    await mkdir(dest, { recursive: true });
    await cp(path.join(sourceSkillsDir, dir.name), dest, { recursive: true });
    skillsWritten.push(dir.name);
  }

  // Agent wiring: copies this package's own cartographer agent (the one
  // whose job is deciding whether this repo's Workspace Map needs an
  // explicit flowbook.members.json, and writing/revising one) into the
  // target repo's .github/agents/. Same never-overwrite rule as Skills.
  // Excludes demo-*.agent.md -- those are testing-only agents for
  // exercising this package's OWN dashboard against its OWN
  // demo-workspaces/mini-monorepo (see their frontmatter: "Testing-only,
  // not a real project agent") and would be meaningless/broken in any
  // other repo, which has no demo-workspaces directory at all.
  const sourceAgentsDir = path.join(MONOREPO_ROOT, ".github", "agents");
  const targetAgentsDir = path.join(repoRoot, ".github", "agents");
  const agentsWritten = [];
  let agentFiles = [];
  try {
    agentFiles = (await readdir(sourceAgentsDir)).filter(
      (f) => f.endsWith(".agent.md") && !f.startsWith("demo-"),
    );
  } catch {
    agentFiles = [];
  }
  await mkdir(targetAgentsDir, { recursive: true });
  for (const file of agentFiles) {
    const dest = path.join(targetAgentsDir, file);
    let alreadyExists = true;
    try {
      await readFile(dest, "utf-8");
    } catch {
      alreadyExists = false;
    }
    if (alreadyExists) continue;
    await cp(path.join(sourceAgentsDir, file), dest);
    agentsWritten.push(file);
  }

  console.log(`flowbook initialized in ${repoRoot}`);
  console.log(`  wrote ${path.relative(repoRoot, hookConfigPath)}`);
  console.log(`  wrote ${path.relative(repoRoot, mcpConfigPath)}`);
  if (configWritten) console.log(`  wrote ${path.relative(repoRoot, configPath)}`);
  for (const name of skillsWritten) console.log(`  wrote .github/skills/${name}/`);
  for (const name of agentsWritten) console.log(`  wrote .github/agents/${name}`);
  console.log("");
  console.log("Next: run `npx flowbook start` from this repo to open the dashboard.");
  if (agentsWritten.includes("cartographer.agent.md")) {
    console.log("Consider running the cartographer agent first, to check whether this repo needs its own flowbook.members.json.");
  }
}

function printHelp() {
  console.log(`flowbook -- a glass-box laboratory for watching AI coding agents work.

Usage:
  flowbook start [--repo <path>] [--port <n>] [--client-port <n>]
      Start the collector + dashboard, watching <path> (default: cwd).

  flowbook init [--repo <path>]
      Scaffold VS Code hook + MCP wiring into <path> (default: cwd) so
      flowbook can observe agent sessions there.
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
