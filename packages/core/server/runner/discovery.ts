// Discovers and loads a repo's OWN workflow modules, per its
// flowbook.config.* `workflows` glob patterns -- each matched file is
// dynamically imported purely for its `registerWorkflow()` side effect
// (same mechanism server/runner/index.ts already uses for this package's
// own built-in document-refactor workflow, just driven by config instead
// of a hardcoded import list). A single module that throws during import
// is isolated (logged, skipped) rather than crashing the whole server --
// one broken workflow file should never take down every other real
// workflow's Blueprint/Run functionality.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadFlowbookConfig } from "../../shared/flowbook-config.js";
import { expandFileGlob } from "../../shared/glob.js";

export interface DiscoveryResult {
  /** Absolute paths of workflow files that were found and imported without error. */
  loaded: string[];
  /** Files that matched a glob but threw during import, with the real error message. */
  failed: { file: string; error: string }[];
}

/** Loads `repoRoot`'s flowbook.config.* (if present) and imports every file
 * matched by its `workflows` glob patterns. Returns `{loaded: [], failed:
 * []}` (not an error) when there's no config at all -- a repo with no
 * config just runs whatever workflows are already registered elsewhere
 * (e.g. this package's own built-in demo). */
export async function discoverWorkflows(repoRoot: string): Promise<DiscoveryResult> {
  const config = await loadFlowbookConfig(repoRoot);
  if (!config) return { loaded: [], failed: [] };

  const relativePaths = new Set<string>();
  for (const pattern of config.workflows) {
    for (const match of await expandFileGlob(repoRoot, pattern)) relativePaths.add(match);
  }

  const loaded: string[] = [];
  const failed: { file: string; error: string }[] = [];
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    try {
      await import(pathToFileURL(absolutePath).href);
      loaded.push(absolutePath);
    } catch (err) {
      failed.push({ file: absolutePath, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { loaded, failed };
}
