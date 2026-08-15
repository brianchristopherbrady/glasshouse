// Append-only JSONL event store. One file per session under .agentarium/sessions/.
// This is the single source of truth events are reconstructed from (replay,
// live view after reload, run comparison all read through here).
import { mkdir, appendFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { AgentariumEventSchema, type AgentariumEvent } from "./events.js";

export const DEFAULT_STORE_DIR = path.resolve(process.cwd(), ".agentarium");

function sessionsDir(storeDir: string): string {
  return path.join(storeDir, "sessions");
}

export function sessionFilePath(sessionId: string, storeDir: string = DEFAULT_STORE_DIR): string {
  return path.join(sessionsDir(storeDir), `${sessionId}.jsonl`);
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ENOENT";
}

/** Appends one validated event to its session's JSONL file. Creates the file/dir if needed. */
export async function appendEvent(
  event: AgentariumEvent,
  storeDir: string = DEFAULT_STORE_DIR,
): Promise<AgentariumEvent> {
  const validated = AgentariumEventSchema.parse(event);
  const filePath = sessionFilePath(validated.sessionId, storeDir);
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, JSON.stringify(validated) + "\n", "utf-8");
  return validated;
}

/** Reads and parses every event for a session, in file order (append order). */
export async function readSessionEvents(
  sessionId: string,
  storeDir: string = DEFAULT_STORE_DIR,
): Promise<AgentariumEvent[]> {
  const filePath = sessionFilePath(sessionId, storeDir);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => AgentariumEventSchema.parse(JSON.parse(line)));
}

/** Lists known session ids, derived from files on disk (no separate index to go stale). */
export async function listSessionIds(storeDir: string = DEFAULT_STORE_DIR): Promise<string[]> {
  try {
    const files = await readdir(sessionsDir(storeDir));
    return files
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.replace(/\.jsonl$/, ""))
      .sort();
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
}

/** Reconstructs the event list as it would have looked at (or before) a given timestamp. Used by replay. */
export async function eventsUpTo(
  sessionId: string,
  isoTimestamp: string,
  storeDir: string = DEFAULT_STORE_DIR,
): Promise<AgentariumEvent[]> {
  const events = await readSessionEvents(sessionId, storeDir);
  return events.filter((e) => e.timestamp <= isoTimestamp);
}
