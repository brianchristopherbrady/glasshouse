#!/usr/bin/env node
// flowbook hook pipeline entry point.
//
// Wired into every VS Code agent lifecycle hook (see
// .github/hooks/flowbook.json). This script MUST fail gracefully:
// a broken or unreachable dashboard must never break or slow down the
// actual agent session.
//
// This file is deliberately a thin shell: it owns only stdin/stdout/exit-
// code I/O. All normalize/correlate/route/persist logic lives in
// scripts/hook-pipeline.mjs (see that file's header comment for the full
// pipeline design, the correlation-state model, and the documented VS Code
// limitations). It's split out specifically because this file's `#!`
// shebang line makes Vite's import-analysis (used by Vitest) refuse to
// parse it if imported directly -- Node runs shebang'd files fine, but
// Vite's transform does not, so the shebang stays confined to this
// never-imported-in-tests entry point.
//
// Kept dependency-free (Node core modules only) so it starts fast and never
// depends on node_modules being installed or a TS toolchain being available.
import { pathToFileURL } from "node:url";
import { processHookInput } from "./hook-pipeline.mjs";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  let hookName = "Unknown";
  try {
    const raw = await readStdin();
    const input = raw.trim().length > 0 ? JSON.parse(raw) : {};
    hookName = input.hook_event_name ?? "Unknown";
    await processHookInput(input);
  } catch (err) {
    process.stderr.write(`flowbook-hook: non-fatal error (${hookName}): ${err}\n`);
  }

  // Always let the agent continue; this hook is observability-only.
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

// Only run main() when this file is executed directly (as the VS Code hook
// command does) -- not when imported.
const isDirectRun = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main();
}
