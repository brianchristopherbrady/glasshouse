// Append-only Run persistence: one JSON file per Run under .flowbook/runs/,
// stay durable across server restarts.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_STORE_DIR } from "../../shared/store-dir.js";
import { RunSchema, type Run } from "../../shared/flowbook-types.js";

function runsDir(storeDir: string): string {
  return path.join(storeDir, "runs");
}

function runFilePath(runId: string, storeDir: string): string {
  return path.join(runsDir(storeDir), `${runId}.json`);
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ENOENT";
}

export async function persistRun(run: Run, storeDir: string = DEFAULT_STORE_DIR): Promise<void> {
  const filePath = runFilePath(run.id, storeDir);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(run, null, 2) + "\n", "utf-8");
}

export async function readRun(runId: string, storeDir: string = DEFAULT_STORE_DIR): Promise<Run | null> {
  try {
    const raw = await readFile(runFilePath(runId, storeDir), "utf-8");
    return RunSchema.parse(JSON.parse(raw));
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

export async function listRuns(storeDir: string = DEFAULT_STORE_DIR): Promise<Run[]> {
  try {
    const files = await readdir(runsDir(storeDir));
    const runs = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map((f) => readFile(path.join(runsDir(storeDir), f), "utf-8").then((raw) => RunSchema.parse(JSON.parse(raw)))),
    );
    return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
}
