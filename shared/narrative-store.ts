// Node-only persistence for the generic narrative layer (see
// shared/narrative-types.ts): Storyboards and Books, one file per session
// under .agentarium/, plus the repo's agentarium.config.json narration
// style. Mirrors shared/event-store.ts's read/write conventions so this
// stays consistent with how sessions are already stored.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_STORE_DIR } from "./event-store.js";
import type { NarrationConfig, NarrativeBook, Storyboard } from "./narrative-types.js";

const REPO_ROOT = path.resolve(process.cwd());
const CONFIG_FILE = path.join(REPO_ROOT, "agentarium.config.json");

export const DEFAULT_NARRATION_CONFIG: NarrationConfig = {
  style: "technical-spec",
  description:
    "No agentarium.config.json narration style was found, so Book falls back to a plain, precise written spec of what the agentic flow did -- no invented voice, no assumed audience.",
};

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ENOENT";
}

function storyboardPath(sessionId: string, storeDir: string): string {
  return path.join(storeDir, "storyboards", `${sessionId}.json`);
}

function bookPath(sessionId: string, storeDir: string): string {
  return path.join(storeDir, "books", `${sessionId}.json`);
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

export async function readNarrativeBook(sessionId: string, storeDir: string = DEFAULT_STORE_DIR): Promise<NarrativeBook | null> {
  return readJson<NarrativeBook>(bookPath(sessionId, storeDir));
}

export async function writeNarrativeBook(book: NarrativeBook, storeDir: string = DEFAULT_STORE_DIR): Promise<void> {
  await writeJson(bookPath(book.sessionId, storeDir), book);
}

/** Reads the consuming repo's own agentarium.config.json (repo root, next to
 * package.json) for its Book narration style. Falls back to a plain
 * technical-spec default when absent or malformed -- a missing config must
 * never be a hard error, since most consuming repos won't have one. */
export async function readNarrationConfig(): Promise<NarrationConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { narration?: Partial<NarrationConfig> };
    if (!parsed.narration || typeof parsed.narration.style !== "string") return DEFAULT_NARRATION_CONFIG;
    return { ...DEFAULT_NARRATION_CONFIG, ...parsed.narration };
  } catch {
    return DEFAULT_NARRATION_CONFIG;
  }
}
