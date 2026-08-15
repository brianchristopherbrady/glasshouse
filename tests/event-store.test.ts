import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { appendEvent, readSessionEvents, listSessionIds, eventsUpTo } from "../shared/event-store.js";
import { createEvent } from "../shared/events.js";

describe("event store", () => {
  let storeDir: string;

  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "agentarium-test-"));
  });

  afterEach(async () => {
    await rm(storeDir, { recursive: true, force: true });
  });

  it("appends and reads back events for a session in order", async () => {
    const e1 = createEvent({
      sessionId: "s1",
      type: "session.started",
      source: "hook",
      evidence: "observed",
      label: "Session started",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const e2 = createEvent({
      sessionId: "s1",
      type: "task.completed",
      source: "hook",
      evidence: "observed",
      label: "Task completed",
      timestamp: "2026-01-01T00:01:00.000Z",
    });

    await appendEvent(e1, storeDir);
    await appendEvent(e2, storeDir);

    const events = await readSessionEvents("s1", storeDir);
    expect(events).toHaveLength(2);
    expect(events[0]!.id).toBe(e1.id);
    expect(events[1]!.id).toBe(e2.id);
  });

  it("returns an empty array for an unknown session instead of throwing", async () => {
    const events = await readSessionEvents("does-not-exist", storeDir);
    expect(events).toEqual([]);
  });

  it("lists known session ids from disk", async () => {
    await appendEvent(
      createEvent({
        sessionId: "session-a",
        type: "session.started",
        source: "hook",
        evidence: "observed",
        label: "start",
      }),
      storeDir,
    );
    await appendEvent(
      createEvent({
        sessionId: "session-b",
        type: "session.started",
        source: "hook",
        evidence: "observed",
        label: "start",
      }),
      storeDir,
    );

    const ids = await listSessionIds(storeDir);
    expect(ids).toEqual(["session-a", "session-b"]);
  });

  it("reconstructs events up to a given timestamp for replay", async () => {
    await appendEvent(
      createEvent({
        sessionId: "s1",
        type: "session.started",
        source: "hook",
        evidence: "observed",
        label: "start",
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      storeDir,
    );
    await appendEvent(
      createEvent({
        sessionId: "s1",
        type: "task.completed",
        source: "hook",
        evidence: "observed",
        label: "done",
        timestamp: "2026-01-01T00:05:00.000Z",
      }),
      storeDir,
    );

    const partial = await eventsUpTo("s1", "2026-01-01T00:02:00.000Z", storeDir);
    expect(partial).toHaveLength(1);
    expect(partial[0]!.type).toBe("session.started");
  });
});
