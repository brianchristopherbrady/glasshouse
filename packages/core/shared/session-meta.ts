// Per-session metadata (a friendly label + an explicit "saved" flag) layered
// on top of the append-only JSONL event log. Every session already persists
// forever in .flowbook/sessions/*.jsonl regardless of this file -- this
// only adds the human-friendly "give it a name" / "mark it worth keeping"
// layer Replay and Compare read from.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_STORE_DIR } from "./event-store.js";

export interface SessionMeta {
  label?: string;
  saved: boolean;
  savedAt?: string;
}

export interface SessionSummary extends SessionMeta {
  id: string;
}

type SessionMetaFile = Record<string, SessionMeta>;

function metaFilePath(storeDir: string): string {
  return path.join(storeDir, "session-meta.json");
}

async function readMetaFile(storeDir: string): Promise<SessionMetaFile> {
  try {
    const raw = await readFile(metaFilePath(storeDir), "utf-8");
    return JSON.parse(raw) as SessionMetaFile;
  } catch {
    return {};
  }
}

async function writeMetaFile(storeDir: string, data: SessionMetaFile): Promise<void> {
  await mkdir(storeDir, { recursive: true });
  await writeFile(metaFilePath(storeDir), JSON.stringify(data, null, 2), "utf-8");
}

/** Reads metadata for every session that has any (unlabeled/unsaved sessions simply aren't present). */
export async function getAllSessionMeta(storeDir: string = DEFAULT_STORE_DIR): Promise<SessionMetaFile> {
  return readMetaFile(storeDir);
}

export async function getSessionMeta(sessionId: string, storeDir: string = DEFAULT_STORE_DIR): Promise<SessionMeta> {
  const all = await readMetaFile(storeDir);
  return all[sessionId] ?? { saved: false };
}

/** Merges a label and/or saved-flag change into a session's metadata. */
export async function updateSessionMeta(
  sessionId: string,
  patch: Partial<Pick<SessionMeta, "label" | "saved">>,
  storeDir: string = DEFAULT_STORE_DIR,
): Promise<SessionMeta> {
  const all = await readMetaFile(storeDir);
  const current = all[sessionId] ?? { saved: false };
  const next: SessionMeta = { ...current };

  if (patch.label !== undefined) next.label = patch.label;
  if (patch.saved !== undefined) {
    next.saved = patch.saved;
    next.savedAt = patch.saved ? current.savedAt ?? new Date().toISOString() : undefined;
  }

  all[sessionId] = next;
  await writeMetaFile(storeDir, all);
  return next;
}
