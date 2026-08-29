// Real per-run artifact sandbox: each Run gets its own directory under
// .flowbook/artifacts/<runId>/, seeded by copying the workflow's fixture
// files, so a workflow can genuinely read/write/diff real files on disk
// without ever touching the watched repo itself. Diffs shown in the UI
// come from real before/after file content (shared/text-diff.ts), not a
// simulated change count.
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_STORE_DIR } from "../../shared/event-store.js";

export function artifactRootFor(runId: string, storeDir: string = DEFAULT_STORE_DIR): string {
  return path.join(storeDir, "artifacts", runId);
}

/** Seeds a run's artifact sandbox by copying a workflow's fixture
 * directory (its "before" state) into the run's own root. */
export async function seedArtifacts(runId: string, fixturesDir: string, storeDir: string = DEFAULT_STORE_DIR): Promise<string> {
  const root = artifactRootFor(runId, storeDir);
  await mkdir(root, { recursive: true });
  await cp(fixturesDir, root, { recursive: true });
  return root;
}

export async function readArtifact(artifactRoot: string, relativePath: string): Promise<string> {
  return readFile(path.join(artifactRoot, relativePath), "utf-8");
}

export async function writeArtifact(artifactRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(artifactRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}
