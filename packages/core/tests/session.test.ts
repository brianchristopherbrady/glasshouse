// Unit tests for server/session.ts, in particular the read-modify-write fix
// to .flowbook/current-session.json: this file is shared, mutable state
// also written by scripts/hook-pipeline.mjs (turn/agent correlation), so a
// bare overwrite here would silently wipe that pipeline's state on every
// event ingested. Uses a temp dir per .github/instructions/tests.instructions.md.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  getCurrentSessionId,
  setCurrentSessionId,
  getCurrentRun,
  setCurrentRun,
} from "../server/session.js";

describe("server/session.ts", () => {
  let storeDir: string;

  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "flowbook-session-test-"));
  });

  afterEach(async () => {
    await rm(storeDir, { recursive: true, force: true });
  });

  it("returns null for session and run when no file exists yet", async () => {
    expect(await getCurrentSessionId(storeDir)).toBeNull();
    expect(await getCurrentRun(storeDir)).toBeNull();
  });

  it("round-trips a session id", async () => {
    await setCurrentSessionId("s1", storeDir);
    expect(await getCurrentSessionId(storeDir)).toBe("s1");
  });

  it("does not wipe fields written by another process (e.g. hook-pipeline's turnSeq) when setting the session id", async () => {
    // Simulate scripts/hook-pipeline.mjs having already written its own
    // correlation state for this session.
    const filePath = path.join(storeDir, "current-session.json");
    await writeFile(
      filePath,
      JSON.stringify({ sessionId: "s1", turnSeq: 5, currentTurnId: "turn-5", agentStack: [{ id: "a-1" }] }),
      "utf-8",
    );

    await setCurrentSessionId("s1", storeDir);

    const raw = JSON.parse(await readFile(filePath, "utf-8"));
    expect(raw.turnSeq).toBe(5);
    expect(raw.currentTurnId).toBe("turn-5");
    expect(raw.agentStack).toEqual([{ id: "a-1" }]);
  });

  it("clears any in-progress run when the session id actually changes", async () => {
    await setCurrentSessionId("s1", storeDir);
    await setCurrentRun("run-1", "Widget work", storeDir);
    expect(await getCurrentRun(storeDir)).toEqual({ runId: "run-1", runLabel: "Widget work" });

    await setCurrentSessionId("s2", storeDir);
    expect(await getCurrentRun(storeDir)).toBeNull();
  });

  it("preserves the current run when setCurrentSessionId is called again for the same session", async () => {
    await setCurrentSessionId("s1", storeDir);
    await setCurrentRun("run-1", "Widget work", storeDir);

    // Simulates collector.ts calling setCurrentSessionId on every ingested
    // event for the same, unchanged session -- must not clobber the run.
    await setCurrentSessionId("s1", storeDir);

    expect(await getCurrentRun(storeDir)).toEqual({ runId: "run-1", runLabel: "Widget work" });
  });

  it("round-trips a run without a label", async () => {
    await setCurrentSessionId("s1", storeDir);
    await setCurrentRun("run-1", undefined, storeDir);
    expect(await getCurrentRun(storeDir)).toEqual({ runId: "run-1", runLabel: undefined });
  });
});
