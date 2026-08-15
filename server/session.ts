// Tracks which session id is "current" (i.e. the most recently active live
// session), mirroring the file the hook script writes to on SessionStart.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_STORE_DIR } from "../shared/event-store.js";

const CURRENT_SESSION_FILE = path.join(DEFAULT_STORE_DIR, "current-session.json");

export async function getCurrentSessionId(): Promise<string | null> {
  try {
    const raw = await readFile(CURRENT_SESSION_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { sessionId?: string };
    return parsed.sessionId ?? null;
  } catch {
    return null;
  }
}

export async function setCurrentSessionId(sessionId: string): Promise<void> {
  await mkdir(DEFAULT_STORE_DIR, { recursive: true });
  await writeFile(
    CURRENT_SESSION_FILE,
    JSON.stringify({ sessionId, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}
