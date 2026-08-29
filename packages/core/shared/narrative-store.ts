// Node-only persistence for the generic narrative layer (see
// shared/narrative-types.ts): Storyboards, one file per session under
// .flowbook/. Mirrors shared/event-store.ts's read/write conventions so
// this stays consistent with how sessions are already stored.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_STORE_DIR } from "./event-store.js";
import type { Storyboard } from "./narrative-types.js";

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ENOENT";
}

function storyboardPath(sessionId: string, storeDir: string): string {
  return path.join(storeDir, "storyboards", `${sessionId}.json`);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

export async function readStoryboard(sessionId: string, storeDir: string = DEFAULT_STORE_DIR): Promise<Storyboard | null> {
  return readJson<Storyboard>(storyboardPath(sessionId, storeDir));
}

export async function writeStoryboard(storyboard: Storyboard, storeDir: string = DEFAULT_STORE_DIR): Promise<void> {
  await writeJson(storyboardPath(storyboard.sessionId, storeDir), storyboard);
}
