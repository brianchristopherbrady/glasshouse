// The repo-level `flowbook.config.{ts,mjs,js}` -- lets a consuming repo
// declare where its own workflow modules live, so they're discovered
// (dynamically imported for their `registerWorkflow()` side effect)
// instead of needing to be hand-wired into this package's own
// server/runner/index.ts. Deliberately minimal compared to plan.md's full
// config sketch (agents/skills/prompts glob lists, adapters[]) -- those
// are declared inline by a workflow module itself today (see
// server/runner/workflows/document-refactor), not discovered separately,
// so only `workflows` is real here. Extend this file's schema when a
// second, genuinely independent discovery axis exists.
import { z } from "zod";
import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FlowbookConfigSchema = z.object({
  /** Glob patterns (relative to the repo root, `*`/`**` supported) for
   * files that register one or more workflows via `registerWorkflow()`
   * when imported. Never inferred/scanned beyond these explicit patterns. */
  workflows: z.array(z.string()).default([]),
});
export type FlowbookConfig = z.infer<typeof FlowbookConfigSchema>;

/** Identity helper (same purpose as Vite's `defineConfig`): gives a
 * consuming repo's `flowbook.config.ts` real type-checking and
 * autocomplete for its config object without this package needing to
 * parse TS syntax -- the returned value IS the input, unchanged. */
export function defineFlowbook(config: FlowbookConfig): FlowbookConfig {
  return config;
}

const CONFIG_FILENAMES = ["flowbook.config.ts", "flowbook.config.mts", "flowbook.config.mjs", "flowbook.config.js"];

async function firstExistingConfigPath(repoRoot: string): Promise<string | null> {
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(repoRoot, filename);
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/** Loads a repo's `flowbook.config.*`, if present. Returns `null` (not an
 * error) when no config file exists -- that's the common, honest case for
 * a repo that only uses this package's own built-in demo workflow, not a
 * failure to find one. Relies on the current process already having a
 * TypeScript-capable ESM loader installed (tsx, in practice) to import a
 * `.ts`/`.mts` config directly -- this module does not install one itself. */
export async function loadFlowbookConfig(repoRoot: string): Promise<FlowbookConfig | null> {
  const configPath = await firstExistingConfigPath(repoRoot);
  if (!configPath) return null;

  const mod = (await import(pathToFileURL(configPath).href)) as { default?: unknown };
  const parsed = FlowbookConfigSchema.safeParse(mod.default);
  if (!parsed.success) {
    throw new Error(`${configPath}: default export does not match the expected FlowbookConfig shape (${parsed.error.message})`);
  }
  return parsed.data;
}
