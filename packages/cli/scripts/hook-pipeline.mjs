// flowbook hook pipeline: normalize -> correlate/route -> record.
//
// Split out from scripts/flowbook-hook.mjs (which stays a thin
// shebang'd entry point) purely so this file can be imported directly in
// unit tests. Bundlers/dev-servers that use Vite's import-analysis (as
// Vitest does) fail to parse a module starting with a `#!` shebang line --
// Node itself handles shebangs fine, but Vite's transform does not -- so
// keeping the shebang out of the file that carries the actual logic avoids
// that entirely rather than working around it per-test.
//
// Kept dependency-free (Node core modules only) so it starts fast and never
// depends on node_modules being installed or a TS toolchain being available.
//
// --- Pipeline shape ---------------------------------------------------
// Each hook invocation is one process. Inside that process, everything
// flows through a single deterministic pipeline instead of one
// independent code path per hook:
//
//   normalizeHookEvent()   raw VS Code hook JSON -> a plain lifecycle
//                          descriptor (hook name, tool/agent identifiers,
//                          timestamps) with no state and no side effects.
//   correlate + route      buildEventsForHook() combines that descriptor
//   (buildEventsForHook)   with the session's persisted turn/agent state
//                          (see "Correlation state" below) to decide which
//                          FlowbookEvent(s) this hook firing produces,
//                          and how the session/turn/agent state should
//                          change as a result. Pure function: same inputs
//                          always produce the same events + next state.
//   finalizeEvent()        fills in id/timestamp defaults and redacts.
//   appendEvents()/        the existing dual-write persistence: append to
//   postToCollector()      this session's JSONL (durable, source of
//                          truth), then best-effort notify a live
//                          collector for immediate UI updates.
//
// --- Correlation state (.flowbook/current-session.json) -------------
// This file already existed purely as a "which session is current"
// pointer (read by server/session.ts). It is extended here -- not
// replaced, and not moved to a new file/database -- to also carry:
//   - turnSeq / currentTurnId: a hook-local turn counter. VS Code does not
//     supply its own turn id, so this is deliberately named/documented as
//     locally derived, not something observed from VS Code itself.
//   - agentStack: the stack of currently-open subagents (pushed on
//     SubagentStart, popped on SubagentStop), each frame carrying the real
//     event id of its own subagent.started event. This is what lets a
//     nested subagent-of-a-subagent (or a tool call made while a subagent
//     is active) carry a real `parentId` back to the event that actually
//     spawned it, instead of every subagent/tool event being silently
//     attributed to a single flat "main agent" lane. `parentId` is an
//     existing FlowbookEventSchema field that had no producer before
//     this change (see shared/events.ts) -- no schema migration needed.
//   - runId / runLabel: set by server/session.ts's setCurrentRun(), called
//     from the `start_run` MCP tool when an agent declares a new distinct
//     unit of work beginning within the current session. Not written by
//     this script itself (there is no VS Code hook for it), but this
//     script must know both field names so loadState()/saveState() round-
//     trip them intact instead of silently dropping them the next time a
//     hook fires. Every event this script builds gets `metadata.runId`
//     stamped on if a run is currently active, so the UI can filter one
//     session's events down to a single run.
// server/session.ts reads `sessionId` and now also `runId`/`runLabel` back
// out of this file; both sides do a read-modify-write against the same
// file rather than a blind overwrite, so neither side's fields get wiped
// by the other's write (a real bug this fixes -- see server/session.ts).
//
// --- Known VS Code limitations (documented, not silently papered over) --
// - There is no dedicated tool-FAILURE hook: PostToolUse fires uniformly
//   whether the tool call succeeded or failed. This script best-effort
//   detects failure by inspecting common error-shaped fields on
//   `tool_response` (`isError`/`is_error`/`error`) -- see
//   detectToolOutcome(). This is NOT authoritative: a tool can fail
//   without producing an error-shaped response, in which case this will
//   still (correctly, honestly) emit `tool.completed`.
// - There is no true session-END hook. `Stop` fires when the agent's
//   current turn/response finishes, NOT when the chat session itself
//   ends -- a session can have many `Stop`s. This script never resets
//   turn/agent state on `Stop`; only `SessionStart` does that.
// - VS Code does not report which agent/subagent is issuing a given tool
//   call. The agentStack correlation above is this script's own derived
//   bookkeeping from the SubagentStart/SubagentStop events it already
//   observes, not something VS Code told it directly -- it is exact as
//   long as hook invocations for one session are processed in the order
//   VS Code fired them (true today; documented here as an assumption, not
//   asserted as an unconditional guarantee).
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const STORE_DIR = path.resolve(process.cwd(), ".flowbook");
export const SESSIONS_DIR = path.join(STORE_DIR, "sessions");
export const CURRENT_SESSION_FILE = path.join(STORE_DIR, "current-session.json");
// Points at the broadcast-only endpoint: this script already appends events
// to disk itself (appendEvents below), so posting to /api/events would
// double-persist them. /api/events/notify only republishes on the live SSE
// bus without writing to the JSONL file again.
const COLLECTOR_URL = process.env.FLOWBOOK_COLLECTOR_URL ?? "http://localhost:4317/api/events/notify";
const POST_TIMEOUT_MS = 1200;

// --- redaction (kept intentionally in sync with shared/redaction.ts) --------

const SENSITIVE_KEY_PATTERN =
  /(api[-_]?key|token|secret|password|passwd|authorization|auth|cookie|bearer|private[-_]?key|access[-_]?key|client[-_]?secret)/i;

const SECRET_VALUE_PATTERNS = [
  /bearer\s+[a-z0-9._-]+/gi,
  /sk-[a-zA-Z0-9]{16,}/g,
  /ghp_[a-zA-Z0-9]{20,}/g,
  /gh[oprsu]_[a-zA-Z0-9]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export const REDACTED = "[REDACTED]";
const MAX_STRING_LENGTH = 4000;
const TRUNCATED_SUFFIX = "…[payload truncated]";

export function redactString(value) {
  let result = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  if (result.length > MAX_STRING_LENGTH) {
    result = result.slice(0, MAX_STRING_LENGTH) + TRUNCATED_SUFFIX;
  }
  return result;
}

export function redact(value, keyHint) {
  if (typeof value === "string") {
    if (keyHint && SENSITIVE_KEY_PATTERN.test(keyHint)) return REDACTED;
    return redactString(value);
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) out[key] = redact(nested, key);
    return out;
  }
  return value;
}

// --- session id + correlation state --------------------------------------

export function sanitizeSessionId(id) {
  return id.replace(/[:.]/g, "-");
}

/** A fresh, empty correlation state for a session that has just started
 * (or that we've never seen before). A new session always starts with no
 * active run -- a run cannot outlive the session it began in. */
export function createInitialState(sessionId) {
  return {
    sessionId,
    updatedAt: new Date().toISOString(),
    turnSeq: 0,
    currentTurnId: null,
    agentStack: [],
    runId: null,
    runLabel: null,
  };
}

export async function loadState() {
  try {
    const raw = await readFile(CURRENT_SESSION_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.sessionId !== "string") return null;
    return {
      sessionId: parsed.sessionId,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      turnSeq: typeof parsed.turnSeq === "number" ? parsed.turnSeq : 0,
      currentTurnId: typeof parsed.currentTurnId === "string" ? parsed.currentTurnId : null,
      agentStack: Array.isArray(parsed.agentStack) ? parsed.agentStack : [],
      runId: typeof parsed.runId === "string" ? parsed.runId : null,
      runLabel: typeof parsed.runLabel === "string" ? parsed.runLabel : null,
    };
  } catch {
    return null;
  }
}

export async function saveState(state) {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(
    CURRENT_SESSION_FILE,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

/** Resolves which session this hook invocation belongs to, and the
 * correlation state to build events against: reuses the persisted state if
 * it's for the same session, otherwise starts fresh. `SessionStart` always
 * starts fresh regardless (a real session boundary), handled by the caller. */
export async function resolveSessionAndState(input) {
  const explicit = input.session_id ? sanitizeSessionId(String(input.session_id)) : null;
  const existing = await loadState();
  if (explicit) {
    if (existing && existing.sessionId === explicit) return { sessionId: explicit, state: existing };
    return { sessionId: explicit, state: createInitialState(explicit) };
  }
  if (existing) return { sessionId: existing.sessionId, state: existing };
  const generated = sanitizeSessionId(new Date().toISOString());
  return { sessionId: generated, state: createInitialState(generated) };
}

// --- file-operation classification ---------------------------------------
// Maps well-known VS Code tool names to the more specific file.* event
// types. This is a deterministic lookup (not a guess), so these events are
// still "observed", never "inferred".
const FILE_READ_TOOLS = new Set(["read_file", "get_errors"]);
const FILE_WRITTEN_TOOLS = new Set([
  "create_file",
  "replace_string_in_file",
  "multi_replace_string_in_file",
  "edit_notebook_file",
]);
const FILE_SEARCHED_TOOLS = new Set(["grep_search", "file_search", "semantic_search", "list_dir"]);

export function classifyFileTool(toolName, toolInput) {
  if (!toolName) return null;
  let type = null;
  if (FILE_READ_TOOLS.has(toolName)) type = "file.read";
  else if (FILE_WRITTEN_TOOLS.has(toolName)) type = "file.written";
  else if (FILE_SEARCHED_TOOLS.has(toolName)) type = "file.searched";
  if (!type) return null;

  const input = toolInput ?? {};
  const filePath = input.filePath ?? input.path ?? input.query ?? input.includePattern ?? undefined;
  return { type, path: filePath };
}

// --- best-effort tool success/failure detection ---------------------------
// VS Code has no dedicated tool-failure hook: PostToolUse fires the same
// way whether the tool call succeeded or failed. This inspects common
// error-shaped fields on tool_response (the same isError convention this
// repo's own MCP tools use -- see mcp/telemetry.ts's ToolResult). This is
// deliberately best-effort and non-authoritative: absence of an
// error-shaped response is treated as success, which can be wrong for a
// tool that fails silently/without that shape.
export function detectToolOutcome(toolResponse) {
  if (toolResponse == null || typeof toolResponse !== "object") return { failed: false };
  if (toolResponse.isError === true || toolResponse.is_error === true) {
    return { failed: true, reason: "tool_response reported isError" };
  }
  if (typeof toolResponse.error === "string" && toolResponse.error.length > 0) {
    return { failed: true, reason: toolResponse.error };
  }
  if (toolResponse.error && typeof toolResponse.error === "object") {
    return { failed: true, reason: "tool_response included an error object" };
  }
  return { failed: false };
}

// --- normalize -------------------------------------------------------------
// Turns raw VS Code hook JSON into a plain, state-free lifecycle descriptor.
// No correlation, no event construction -- just pulling out the fields each
// hook name actually carries.
export function normalizeHookEvent(hookName, input) {
  return {
    hookName,
    timestamp: input.timestamp ?? new Date().toISOString(),
    prompt: input.prompt,
    toolName: input.tool_name,
    toolCallId: input.tool_use_id,
    toolInput: input.tool_input,
    toolResponse: input.tool_response,
    agentType: input.agent_type,
    agentId: input.agent_id,
    stopHookActive: input.stop_hook_active,
    trigger: input.trigger,
    source: input.source,
  };
}

// --- correlate + route -----------------------------------------------------
// The core of the pipeline: combines a normalized descriptor with the
// session's current turn/agent state to decide (a) which FlowbookEvent(s)
// this hook firing produces and (b) how state should change going forward.
// Pure: given the same (hookName, input, sessionId, state, timestamp) it
// always returns the same result, so it's fully unit-testable without stdin,
// disk, or network.
export function buildEventsForHook(hookName, input, sessionId, state, timestamp = new Date().toISOString()) {
  const norm = normalizeHookEvent(hookName, input);
  const base = { sessionId, timestamp: norm.timestamp, source: "hook", evidence: "observed" };
  const events = [];
  // Shallow-clone so callers can treat this as pure (no mutation of the
  // state object they passed in).
  const next = { ...state, agentStack: [...state.agentStack] };

  const activeFrame = next.agentStack[next.agentStack.length - 1] ?? null;
  const actorForCurrentAgent = activeFrame
    ? { id: activeFrame.id, kind: "subagent", name: activeFrame.name ?? undefined }
    : { id: "agent", kind: "agent" };
  const parentIdForCurrentAgent = activeFrame ? activeFrame.eventId : undefined;

  switch (hookName) {
    case "SessionStart": {
      events.push({
        ...base,
        type: "session.started",
        label: "Agent session started",
        actor: { id: "user", kind: "user" },
        metadata: { source: norm.source ?? "new", turnId: next.currentTurnId },
      });
      break;
    }

    case "UserPromptSubmit": {
      next.turnSeq += 1;
      next.currentTurnId = `turn-${next.turnSeq}`;
      events.push({
        ...base,
        type: "prompt.received",
        label: "Prompt received",
        actor: { id: "user", kind: "user" },
        metadata: { prompt: norm.prompt, turnId: next.currentTurnId },
      });
      break;
    }

    case "PreToolUse": {
      events.push({
        ...base,
        type: "tool.requested",
        label: `Tool requested: ${norm.toolName ?? "unknown"}`,
        actor: actorForCurrentAgent,
        ...(parentIdForCurrentAgent !== undefined && { parentId: parentIdForCurrentAgent }),
        metadata: {
          tool: norm.toolName,
          toolCallId: norm.toolCallId,
          input: norm.toolInput,
          turnId: next.currentTurnId,
        },
      });
      break;
    }

    case "PostToolUse": {
      const outcome = detectToolOutcome(norm.toolResponse);
      events.push({
        ...base,
        type: outcome.failed ? "tool.failed" : "tool.completed",
        label: `Tool ${outcome.failed ? "failed" : "completed"}: ${norm.toolName ?? "unknown"}`,
        actor: actorForCurrentAgent,
        ...(parentIdForCurrentAgent !== undefined && { parentId: parentIdForCurrentAgent }),
        metadata: {
          tool: norm.toolName,
          toolCallId: norm.toolCallId,
          input: norm.toolInput,
          response: norm.toolResponse,
          ok: !outcome.failed,
          ...(outcome.reason !== undefined && { failureReason: outcome.reason }),
          turnId: next.currentTurnId,
        },
      });
      // Only classify a successful call as a real file.* observation --
      // attributing a completed file.read/written/searched to a call that
      // actually failed would falsely claim a file operation succeeded.
      if (!outcome.failed) {
        const fileEvent = classifyFileTool(norm.toolName, norm.toolInput);
        if (fileEvent) {
          const verb = fileEvent.type.split(".")[1];
          events.push({
            ...base,
            type: fileEvent.type,
            label: `File ${verb}${fileEvent.path ? `: ${fileEvent.path}` : ""}`,
            actor: actorForCurrentAgent,
            ...(parentIdForCurrentAgent !== undefined && { parentId: parentIdForCurrentAgent }),
            metadata: { tool: norm.toolName, path: fileEvent.path, turnId: next.currentTurnId },
          });
        }
      }
      break;
    }

    case "SubagentStart": {
      const agentId = norm.agentId ?? randomUUID();
      const eventId = randomUUID();
      const parentEventId = activeFrame ? activeFrame.eventId : undefined;
      events.push({
        ...base,
        id: eventId,
        type: "subagent.started",
        label: `Subagent started: ${norm.agentType ?? "unknown"}`,
        actor: { id: agentId, kind: "subagent", name: norm.agentType },
        ...(parentEventId !== undefined && { parentId: parentEventId }),
        metadata: { agentType: norm.agentType, turnId: next.currentTurnId },
      });
      next.agentStack.push({
        id: agentId,
        name: norm.agentType ?? null,
        eventId,
        parentEventId: parentEventId ?? null,
      });
      break;
    }

    case "SubagentStop": {
      // Find the matching frame (searching from the top, since nested
      // delegation means the most recently started subagent is usually the
      // one stopping). If VS Code doesn't give us an agent_id, or it
      // doesn't match anything currently open, fall back to popping the
      // top of the stack -- never assume/guess an id that was never
      // observed, but also don't leave a stale frame if we plausibly can
      // resolve which one just stopped.
      let frame = null;
      if (norm.agentId) {
        const idx = next.agentStack.findIndex((f) => f.id === norm.agentId);
        if (idx !== -1) {
          frame = next.agentStack[idx];
          next.agentStack.splice(idx, 1);
        }
      }
      if (!frame && next.agentStack.length > 0) {
        frame = next.agentStack.pop();
      }
      const actor = frame
        ? { id: frame.id, kind: "subagent", name: frame.name ?? undefined }
        : { id: norm.agentId ?? randomUUID(), kind: "subagent", name: norm.agentType };
      events.push({
        ...base,
        type: "subagent.stopped",
        label: `Subagent stopped: ${norm.agentType ?? frame?.name ?? "unknown"}`,
        actor,
        ...(frame?.parentEventId != null && { parentId: frame.parentEventId }),
        metadata: { agentType: norm.agentType, stopHookActive: norm.stopHookActive, turnId: next.currentTurnId },
      });
      break;
    }

    case "PreCompact": {
      events.push({
        ...base,
        type: "context.changed",
        label: "Context compaction triggered",
        actor: { id: "system", kind: "system" },
        metadata: { trigger: norm.trigger, turnId: next.currentTurnId },
      });
      break;
    }

    case "Stop": {
      // Stop marks the end of the current turn/agent response -- NOT the
      // end of the chat session (VS Code has no dedicated session-end
      // hook). Deliberately does not reset turnId or agentStack: a new
      // UserPromptSubmit is what starts the next turn, and a genuinely
      // unmatched SubagentStart (no SubagentStop before Stop) is a real
      // anomaly worth a diagnostic, not something to silently paper over
      // by force-clearing the stack here.
      events.push({
        ...base,
        type: "agent.stopped",
        label: "Agent turn stopped",
        actor: { id: "agent", kind: "agent" },
        metadata: { stopHookActive: norm.stopHookActive, turnId: next.currentTurnId },
      });
      if (next.agentStack.length > 0) {
        process.stderr.write(
          `flowbook-hook: Stop fired with ${next.agentStack.length} unclosed subagent frame(s) -- ` +
            `a SubagentStop may have been missed.\n`,
        );
      }
      break;
    }

    default: {
      events.push({
        ...base,
        type: "context.changed",
        label: `Unrecognized hook event: ${hookName}`,
        actor: { id: "system", kind: "system" },
        metadata: { hookName, turnId: next.currentTurnId },
      });
    }
  }

  // Stamp the currently-active run (if any) onto every event this hook
  // firing produced, so the UI can filter one session down to a single
  // declared run. Done once here rather than per-case above so a run
  // declared mid-session automatically applies to every subsequent event
  // type without editing each case.
  if (next.runId) {
    for (const event of events) {
      event.metadata = { ...(event.metadata ?? {}), runId: next.runId };
    }
  }

  return { events, nextState: next };
}

// --- future: Copilot CLI lifecycle extensibility (NOT WIRED) --------------
// This repo currently has no Copilot CLI integration (confirmed: no
// .github/hooks/*.json CLI config, no CLI-specific runtime anywhere in this
// repo). If/when that changes, the CLI's own lifecycle events would plug
// into this same buildEventsForHook() switch as additional `case` arms --
// NOT a parallel pipeline -- using event types this schema already
// reserves room for:
//   postToolUseFailure -> tool.failed (already implemented above for the
//     best-effort VS Code detection path; a CLI failure hook would just be
//     an authoritative source for the same event type)
//   errorOccurred       -> a new "runtime.error" type (not yet added to
//                          shared/events.ts -- add only once a real source
//                          exists to avoid dead schema surface)
//   permissionRequest   -> a new "permission.request" type (same caveat)
//   notification        -> a new "notification" type (same caveat)
//   sessionEnd          -> a real session-end event, something VS Code
//                          cannot currently provide -- this is the one
//                          limitation a CLI integration would genuinely fix
//   userPromptTransformed -> "prompt.received" with an additional
//                          metadata.transformed field, no new type needed
// Do not wire any of the above into .github/hooks/*.json until this repo
// actually integrates the Copilot CLI -- adding the configuration ahead of
// a real runtime would be dead, untestable configuration.

export function finalizeEvent(partial) {
  return {
    id: randomUUID(),
    ...partial,
    metadata: partial.metadata ? redact(partial.metadata) : undefined,
  };
}

export function buildHookBracketEvent(type, hookName, sessionId, timestamp) {
  return finalizeEvent({
    sessionId,
    timestamp,
    type,
    source: "hook",
    evidence: "observed",
    label: `Hook ${type === "hook.started" ? "fired" : "completed"}: ${hookName}`,
    actor: { id: "hook", kind: "hook", name: hookName },
    metadata: { hookName },
  });
}

// --- persistence + best-effort network push -----------------------------

export async function appendEvents(events) {
  if (events.length === 0) return;
  const sessionId = events[0].sessionId;
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  await mkdir(SESSIONS_DIR, { recursive: true });
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await appendFile(filePath, lines, "utf-8");
}

export async function postToCollector(events) {
  if (typeof fetch !== "function") return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
  try {
    await fetch(COLLECTOR_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
      signal: controller.signal,
    });
  } catch {
    // Collector not running / unreachable — this is expected and fine.
  } finally {
    clearTimeout(timer);
  }
}

// --- orchestration used by the entry point -------------------------------
// One full hook invocation's worth of work, given already-parsed input.
// Exported so the thin shebang entry point (and tests, if ever needed at
// this level) don't have to re-implement the bracket-event/state-save
// sequencing themselves.
export async function processHookInput(input) {
  const hookName = input.hook_event_name ?? "Unknown";
  const { sessionId, state } = await resolveSessionAndState(input);
  // SessionStart is the one real session boundary: always start from a
  // fresh correlation state regardless of what (if anything) was
  // persisted before, matching the original behavior of unconditionally
  // (re)writing the current-session pointer on SessionStart.
  const effectiveState = hookName === "SessionStart" ? createInitialState(sessionId) : state;

  const timestamp = input.timestamp ?? new Date().toISOString();
  const hookGate = buildHookBracketEvent("hook.started", hookName, sessionId, timestamp);

  const { events: semanticPartials, nextState } = buildEventsForHook(
    hookName,
    input,
    sessionId,
    effectiveState,
    timestamp,
  );
  const semanticEvents = semanticPartials.map(finalizeEvent);

  const hookDone = buildHookBracketEvent("hook.completed", hookName, sessionId, new Date().toISOString());

  const allEvents = [hookGate, ...semanticEvents, hookDone];

  await saveState(nextState).catch((err) => {
    process.stderr.write(`flowbook-hook: failed to save session state: ${err}\n`);
  });
  await appendEvents(allEvents).catch((err) => {
    process.stderr.write(`flowbook-hook: failed to append events: ${err}\n`);
  });
  await postToCollector(allEvents);

  return { hookName, events: allEvents, nextState };
}
