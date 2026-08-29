// Tracks which session/run id is "current" (i.e. the most recently active
// live session), sharing the same file scripts/hook-pipeline.mjs writes its
// turn/agent correlation state to.
//
// IMPORTANT: this file's on-disk shape also carries scripts/hook-pipeline.mjs's
// own correlation fields (turnSeq, currentTurnId, agentStack) and, now,
// runId/runLabel. Every write here must read-modify-write (preserve
// whatever's already on disk) rather than replacing the file wholesale --
// a previous version of setCurrentSessionId() did a bare overwrite with
// only {sessionId, updatedAt}, which silently wiped the hook pipeline's
// turn/agent state on every single event ingested (collector.ts calls it
// unconditionally for every event), making the turn counter reset to
// turn-1 almost every time instead of actually incrementing. Read-modify-
// write fixes that without either side needing to know about the other's
// fields.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_STORE_DIR } from "../shared/event-store.js";

function currentSessionFilePath(storeDir: string): string {
  return path.join(storeDir, "current-session.json");
}

interface CurrentSessionFile {
  sessionId?: string;
  runId?: string;
  runLabel?: string;
  [key: string]: unknown;
}

async function readCurrentSessionFile(storeDir: string): Promise<CurrentSessionFile> {
  try {
    const raw = await readFile(currentSessionFilePath(storeDir), "utf-8");
    const parsed = JSON.parse(raw) as CurrentSessionFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCurrentSessionFile(patch: Partial<CurrentSessionFile>, storeDir: string): Promise<void> {
  await mkdir(storeDir, { recursive: true });
  const current = await readCurrentSessionFile(storeDir);
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await writeFile(currentSessionFilePath(storeDir), JSON.stringify(next, null, 2), "utf-8");
}

export async function getCurrentSessionId(storeDir: string = DEFAULT_STORE_DIR): Promise<string | null> {
  const parsed = await readCurrentSessionFile(storeDir);
  return parsed.sessionId ?? null;
}

/** Sets the current session id. A session change always clears any
 * in-progress run -- a run cannot outlive the session it started in. */
export async function setCurrentSessionId(sessionId: string, storeDir: string = DEFAULT_STORE_DIR): Promise<void> {
  const current = await readCurrentSessionFile(storeDir);
  if (current.sessionId === sessionId) {
    // Same session as already recorded: preserve runId/runLabel and any
    // other correlation fields untouched, just refresh updatedAt.
    await writeCurrentSessionFile({}, storeDir);
    return;
  }
  await writeCurrentSessionFile({ sessionId, runId: undefined, runLabel: undefined }, storeDir);
}

/** The currently-declared run within the current session, if any (see
 * `run.started` events / mcp/tools/startRun.ts). Null if no run has been
 * declared since the session started, or since the session changed. */
export async function getCurrentRun(
  storeDir: string = DEFAULT_STORE_DIR,
): Promise<{ runId: string; runLabel?: string } | null> {
  const parsed = await readCurrentSessionFile(storeDir);
  return parsed.runId ? { runId: parsed.runId, runLabel: parsed.runLabel } : null;
}

export async function setCurrentRun(
  runId: string,
  runLabel?: string,
  storeDir: string = DEFAULT_STORE_DIR,
): Promise<void> {
  await writeCurrentSessionFile({ runId, runLabel }, storeDir);
}
