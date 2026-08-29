// Unit tests for the hook pipeline's pure logic (scripts/hook-pipeline.mjs,
// imported by the thin shebang'd entry point scripts/flowbook-hook.mjs).
// These test the normalize/correlate/route functions directly -- no stdin,
// no disk, no network -- per .github/instructions/tests.instructions.md.
// The entry point's stdin/stdout/exit-code shell is deliberately NOT
// exercised here since it's a thin wrapper; everything with actual
// branching logic is exported from hook-pipeline.mjs and pure.
import { describe, it, expect } from "vitest";
import {
  buildEventsForHook,
  classifyFileTool,
  createInitialState,
  detectToolOutcome,
  normalizeHookEvent,
  sanitizeSessionId,
} from "../scripts/hook-pipeline.mjs";

const SESSION_ID = "s1";
const TS = "2026-01-01T00:00:00.000Z";

function run(hookName: string, input: Record<string, unknown>, state = createInitialState(SESSION_ID)) {
  return buildEventsForHook(hookName, input, SESSION_ID, state, TS);
}

describe("normalizeHookEvent", () => {
  it("pulls known fields off the raw VS Code payload without inventing any", () => {
    const norm = normalizeHookEvent("PreToolUse", { tool_name: "read_file", tool_use_id: "call-1" });
    expect(norm.toolName).toBe("read_file");
    expect(norm.toolCallId).toBe("call-1");
    expect(norm.agentId).toBeUndefined();
  });
});

describe("buildEventsForHook: SessionStart", () => {
  it("emits session.started with source metadata", () => {
    const { events, nextState } = run("SessionStart", { source: "resume" });
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("session.started");
    expect(events[0]!.metadata!.source).toBe("resume");
    expect(nextState.turnSeq).toBe(0);
  });
});

describe("buildEventsForHook: UserPromptSubmit", () => {
  it("emits prompt.received and advances the turn counter", () => {
    const { events, nextState } = run("UserPromptSubmit", { prompt: "hello" });
    expect(events[0]!.type).toBe("prompt.received");
    expect(events[0]!.metadata!.prompt).toBe("hello");
    expect(nextState.turnSeq).toBe(1);
    expect(nextState.currentTurnId).toBe("turn-1");
  });

  it("increments turnSeq again on a second prompt in the same session", () => {
    const first = run("UserPromptSubmit", { prompt: "one" });
    const second = run("UserPromptSubmit", { prompt: "two" }, first.nextState);
    expect(second.nextState.turnSeq).toBe(2);
    expect(second.nextState.currentTurnId).toBe("turn-2");
  });
});

describe("buildEventsForHook: PreToolUse (tool start)", () => {
  it("emits tool.requested carrying the tool call id for correlation", () => {
    const { events } = run("PreToolUse", { tool_name: "read_file", tool_use_id: "call-42", tool_input: { filePath: "a.ts" } });
    expect(events[0]!.type).toBe("tool.requested");
    expect(events[0]!.metadata!.tool).toBe("read_file");
    expect(events[0]!.metadata!.toolCallId).toBe("call-42");
  });
});

describe("buildEventsForHook: PostToolUse (tool success)", () => {
  it("emits tool.completed and a file.read event for a known read tool", () => {
    const { events } = run("PostToolUse", {
      tool_name: "read_file",
      tool_use_id: "call-42",
      tool_input: { filePath: "a.ts" },
      tool_response: { content: [{ type: "text", text: "ok" }] },
    });
    const types = events.map((e) => e.type);
    expect(types).toContain("tool.completed");
    expect(types).toContain("file.read");
    const completed = events.find((e) => e.type === "tool.completed")!;
    expect(completed.metadata!.ok).toBe(true);
    expect(completed.metadata!.toolCallId).toBe("call-42");
  });

  it("does not emit a file.* event for a tool with no file classification", () => {
    const { events } = run("PostToolUse", { tool_name: "run_in_terminal", tool_response: {} });
    expect(events.map((e) => e.type)).toEqual(["tool.completed"]);
  });
});

describe("buildEventsForHook: PostToolUse (tool failure) -- best-effort, VS Code has no dedicated failure hook", () => {
  it("emits tool.failed when tool_response reports isError", () => {
    const { events } = run("PostToolUse", {
      tool_name: "read_file",
      tool_response: { isError: true, content: [{ type: "text", text: "ENOENT" }] },
    });
    expect(events[0]!.type).toBe("tool.failed");
    expect(events[0]!.metadata!.ok).toBe(false);
  });

  it("does not emit a file.* event when the tool call failed", () => {
    const { events } = run("PostToolUse", {
      tool_name: "read_file",
      tool_input: { filePath: "a.ts" },
      tool_response: { isError: true },
    });
    expect(events.map((e) => e.type)).toEqual(["tool.failed"]);
  });
});

describe("detectToolOutcome", () => {
  it("treats a missing/empty tool_response as success", () => {
    expect(detectToolOutcome(undefined)).toEqual({ failed: false });
  });
  it("detects a string error field", () => {
    expect(detectToolOutcome({ error: "boom" })).toEqual({ failed: true, reason: "boom" });
  });
});

describe("buildEventsForHook: SubagentStart / SubagentStop (agent hierarchy)", () => {
  it("subagent start pushes a stack frame and subagent stop pops it", () => {
    const started = run("SubagentStart", { agent_type: "building-inspector", agent_id: "agent-1" });
    expect(started.events[0]!.type).toBe("subagent.started");
    expect(started.nextState.agentStack).toHaveLength(1);

    const stopped = run("SubagentStop", { agent_type: "building-inspector", agent_id: "agent-1" }, started.nextState);
    expect(stopped.events[0]!.type).toBe("subagent.stopped");
    expect(stopped.nextState.agentStack).toHaveLength(0);
  });

  it("attributes a tool call made while a subagent is active to that subagent, with parentId set (does not assume all agents are root)", () => {
    const started = run("SubagentStart", { agent_type: "city-planner", agent_id: "agent-1" });
    const subagentEventId = started.events[0]!.id;

    const toolCall = run("PreToolUse", { tool_name: "read_file", tool_use_id: "call-1" }, started.nextState);
    expect(toolCall.events[0]!.actor!.kind).toBe("subagent");
    expect(toolCall.events[0]!.actor!.id).toBe("agent-1");
    expect(toolCall.events[0]!.parentId).toBe(subagentEventId);
  });

  it("nests a second subagent under the first (subagent-of-a-subagent), not flattened to main", () => {
    const outer = run("SubagentStart", { agent_type: "mayor", agent_id: "outer-1" });
    const outerEventId = outer.events[0]!.id;
    const inner = run("SubagentStart", { agent_type: "city-clerk", agent_id: "inner-1" }, outer.nextState);
    expect(inner.events[0]!.parentId).toBe(outerEventId);
    expect(inner.nextState.agentStack).toHaveLength(2);
  });
});

describe("buildEventsForHook: PreCompact", () => {
  it("emits a context.changed event with the trigger reason", () => {
    const { events } = run("PreCompact", { trigger: "auto" });
    expect(events[0]!.type).toBe("context.changed");
    expect(events[0]!.metadata!.trigger).toBe("auto");
  });
});

describe("buildEventsForHook: Stop (turn stop, NOT session end)", () => {
  it("emits agent.stopped and does not clear turn/agent state", () => {
    const prompted = run("UserPromptSubmit", { prompt: "hi" });
    const started = run("SubagentStart", { agent_type: "x", agent_id: "a-1" }, prompted.nextState);
    const { events, nextState } = run("Stop", { stop_hook_active: false }, started.nextState);
    expect(events[0]!.type).toBe("agent.stopped");
    // Stop is a turn boundary, not a session boundary: turnId and any
    // still-open agent stack survive it (only SessionStart resets state).
    expect(nextState.currentTurnId).toBe("turn-1");
    expect(nextState.agentStack).toHaveLength(1);
  });
});

describe("buildEventsForHook: unrecognized hook name", () => {
  it("falls back to a labeled context.changed event instead of throwing", () => {
    const { events } = run("SomeFutureHook", {});
    expect(events[0]!.type).toBe("context.changed");
    expect(events[0]!.metadata!.hookName).toBe("SomeFutureHook");
  });
});

describe("buildEventsForHook: missing optional fields", () => {
  it("handles PreToolUse with no tool_name/tool_input gracefully", () => {
    const { events } = run("PreToolUse", {});
    expect(events[0]!.label).toContain("unknown");
    expect(events[0]!.metadata!.tool).toBeUndefined();
  });

  it("handles SubagentStop with no matching open frame (falls back instead of throwing)", () => {
    const { events, nextState } = run("SubagentStop", { agent_type: "ghost" });
    expect(events[0]!.type).toBe("subagent.stopped");
    expect(nextState.agentStack).toHaveLength(0);
  });
});

describe("buildEventsForHook: run stamping", () => {
  it("does not stamp metadata.runId when no run is active", () => {
    const { events } = run("UserPromptSubmit", { prompt: "hi" });
    expect(events[0]!.metadata!.runId).toBeUndefined();
  });

  it("stamps metadata.runId on every event once a run is active in state", () => {
    const state = { ...createInitialState(SESSION_ID), runId: "run-1", runLabel: "Widget work" };
    const { events } = run("UserPromptSubmit", { prompt: "hi" }, state);
    expect(events[0]!.metadata!.runId).toBe("run-1");
  });

  it("preserves runId/runLabel across a non-SessionStart hook (round-trips via loadState shape)", () => {
    const state = { ...createInitialState(SESSION_ID), runId: "run-1", runLabel: "Widget work" };
    const { nextState } = run("PreToolUse", { tool_name: "read_file" }, state);
    expect(nextState.runId).toBe("run-1");
    expect(nextState.runLabel).toBe("Widget work");
  });

  it("createInitialState starts with no active run (a new session cannot inherit a prior run)", () => {
    const state = createInitialState(SESSION_ID);
    expect(state.runId).toBeNull();
    expect(state.runLabel).toBeNull();
  });
});

describe("sanitizeSessionId", () => {
  it("strips characters that would be unsafe in a filename", () => {
    expect(sanitizeSessionId("2026-01-01T00:00:00.000Z")).not.toContain(":");
  });
});

describe("classifyFileTool", () => {
  it("classifies known read/write/search tools deterministically", () => {
    expect(classifyFileTool("read_file", { filePath: "a.ts" })).toEqual({ type: "file.read", path: "a.ts" });
    expect(classifyFileTool("create_file", { filePath: "b.ts" })?.type).toBe("file.written");
    expect(classifyFileTool("grep_search", { query: "foo" })?.type).toBe("file.searched");
  });

  it("returns null for unrelated tools", () => {
    expect(classifyFileTool("run_in_terminal", {})).toBeNull();
  });
});

// Copilot CLI lifecycle events (postToolUseFailure as an authoritative
// failure source, a real sessionEnd hook) are NOT covered here: this repo
// has no Copilot CLI integration to exercise (confirmed during inspection --
// no CLI runtime, no CLI hook configuration anywhere in this repo). The
// extension points are documented in scripts/hook-pipeline.mjs's
// "future: Copilot CLI lifecycle extensibility" comment; tests should be
// added there once a real CLI source exists to observe.
