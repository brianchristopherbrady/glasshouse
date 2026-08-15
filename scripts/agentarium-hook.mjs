#!/usr/bin/env node
// AGENTARIUM hook pipeline entry point.
//
// Wired into every VS Code agent lifecycle hook (see .github/hooks/agentarium.json).
// This script MUST fail gracefully: a broken or unreachable dashboard must
// never break or slow down the actual agent session. Every side effect below
// is wrapped so the only thing that can stop it is a genuine bug in this file.
//
// Kept dependency-free (Node core modules only) so it starts fast and never
// depends on node_modules being installed or a TS toolchain being available.
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const STORE_DIR = path.resolve(process.cwd(), ".agentarium");
const SESSIONS_DIR = path.join(STORE_DIR, "sessions");
const CURRENT_SESSION_FILE = path.join(STORE_DIR, "current-session.json");
// Points at the broadcast-only endpoint: this script already appends events
// to disk itself (appendEvents below), so posting to /api/events would
// double-persist them. /api/events/notify only republishes on the live SSE
// bus without writing to the JSONL file again.
const COLLECTOR_URL = process.env.AGENTARIUM_COLLECTOR_URL ?? "http://localhost:4317/api/events/notify";
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

const REDACTED = "[REDACTED]";
const MAX_STRING_LENGTH = 4000;
const TRUNCATED_SUFFIX = "…[payload truncated]";

function redactString(value) {
  let result = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  if (result.length > MAX_STRING_LENGTH) {
    result = result.slice(0, MAX_STRING_LENGTH) + TRUNCATED_SUFFIX;
  }
  return result;
}

function redact(value, keyHint) {
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

// --- session id handling ------------------------------------------------

function sanitizeSessionId(id) {
  return id.replace(/[:.]/g, "-");
}

async function resolveSessionId(input) {
  if (input.session_id) return sanitizeSessionId(String(input.session_id));
  try {
    const raw = await readFile(CURRENT_SESSION_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.sessionId) return parsed.sessionId;
  } catch {
    // no current session yet, fall through to creating one
  }
  const generated = sanitizeSessionId(new Date().toISOString());
  await writeCurrentSession(generated);
  return generated;
}

async function writeCurrentSession(sessionId) {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(
    CURRENT_SESSION_FILE,
    JSON.stringify({ sessionId, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
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

function classifyFileTool(toolName, toolInput) {
  if (!toolName) return null;
  let type = null;
  if (FILE_READ_TOOLS.has(toolName)) type = "file.read";
  else if (FILE_WRITTEN_TOOLS.has(toolName)) type = "file.written";
  else if (FILE_SEARCHED_TOOLS.has(toolName)) type = "file.searched";
  if (!type) return null;

  const input = toolInput ?? {};
  const path = input.filePath ?? input.path ?? input.query ?? input.includePattern ?? undefined;
  return { type, path };
}

// --- hook_event_name -> AGENTARIUM event mapping ------------------------

function mapHookToEvents(hookName, input, sessionId) {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const base = { sessionId, timestamp, source: "hook", evidence: "observed" };
  const events = [];

  switch (hookName) {
    case "SessionStart":
      events.push({
        ...base,
        type: "session.started",
        label: "Agent session started",
        actor: { id: "user", kind: "user" },
        metadata: { source: input.source ?? "new" },
      });
      break;

    case "UserPromptSubmit":
      events.push({
        ...base,
        type: "prompt.received",
        label: "Prompt received",
        actor: { id: "user", kind: "user" },
        metadata: { prompt: input.prompt },
      });
      break;

    case "PreToolUse":
      events.push({
        ...base,
        type: "tool.requested",
        label: `Tool requested: ${input.tool_name ?? "unknown"}`,
        actor: { id: "agent", kind: "agent" },
        metadata: {
          tool: input.tool_name,
          toolUseId: input.tool_use_id,
          input: input.tool_input,
        },
      });
      break;

    case "PostToolUse":
      events.push({
        ...base,
        type: "tool.completed",
        label: `Tool completed: ${input.tool_name ?? "unknown"}`,
        actor: { id: "agent", kind: "agent" },
        metadata: {
          tool: input.tool_name,
          toolUseId: input.tool_use_id,
          input: input.tool_input,
          response: input.tool_response,
        },
      });
      {
        const fileEvent = classifyFileTool(input.tool_name, input.tool_input);
        if (fileEvent) {
          const verb = fileEvent.type.split(".")[1];
          events.push({
            ...base,
            type: fileEvent.type,
            label: `File ${verb}${fileEvent.path ? `: ${fileEvent.path}` : ""}`,
            actor: { id: "agent", kind: "agent" },
            metadata: { tool: input.tool_name, path: fileEvent.path },
          });
        }
      }
      break;

    case "SubagentStart":
      events.push({
        ...base,
        type: "subagent.started",
        label: `Subagent started: ${input.agent_type ?? "unknown"}`,
        actor: { id: input.agent_id ?? randomUUID(), kind: "subagent", name: input.agent_type },
        metadata: { agentType: input.agent_type },
      });
      break;

    case "SubagentStop":
      events.push({
        ...base,
        type: "subagent.stopped",
        label: `Subagent stopped: ${input.agent_type ?? "unknown"}`,
        actor: { id: input.agent_id ?? randomUUID(), kind: "subagent", name: input.agent_type },
        metadata: { agentType: input.agent_type, stopHookActive: input.stop_hook_active },
      });
      break;

    case "PreCompact":
      events.push({
        ...base,
        type: "context.changed",
        label: "Context compaction triggered",
        actor: { id: "system", kind: "system" },
        metadata: { trigger: input.trigger },
      });
      break;

    case "Stop":
      events.push({
        ...base,
        type: "agent.stopped",
        label: "Agent stopped",
        actor: { id: "agent", kind: "agent" },
        metadata: { stopHookActive: input.stop_hook_active },
      });
      break;

    default:
      events.push({
        ...base,
        type: "context.changed",
        label: `Unrecognized hook event: ${hookName}`,
        actor: { id: "system", kind: "system" },
        metadata: { hookName },
      });
  }

  return events;
}

function finalizeEvent(partial) {
  return {
    id: randomUUID(),
    ...partial,
    metadata: partial.metadata ? redact(partial.metadata) : undefined,
  };
}

// --- persistence + best-effort network push -----------------------------

async function appendEvents(events) {
  if (events.length === 0) return;
  const sessionId = events[0].sessionId;
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  await mkdir(SESSIONS_DIR, { recursive: true });
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await appendFile(filePath, lines, "utf-8");
}

async function postToCollector(events) {
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

// --- entry point ----------------------------------------------------------

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  let hookName = "Unknown";
  try {
    const raw = await readStdin();
    const input = raw.trim().length > 0 ? JSON.parse(raw) : {};
    hookName = input.hook_event_name ?? "Unknown";

    const sessionId = await resolveSessionId(input);
    if (hookName === "SessionStart") await writeCurrentSession(sessionId);

    const hookGate = finalizeEvent({
      id: randomUUID(),
      sessionId,
      timestamp: input.timestamp ?? new Date().toISOString(),
      type: "hook.started",
      source: "hook",
      evidence: "observed",
      label: `Hook fired: ${hookName}`,
      actor: { id: "hook", kind: "hook", name: hookName },
      metadata: { hookName },
    });

    const semanticEvents = mapHookToEvents(hookName, input, sessionId).map(finalizeEvent);

    const hookDone = finalizeEvent({
      id: randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
      type: "hook.completed",
      source: "hook",
      evidence: "observed",
      label: `Hook completed: ${hookName}`,
      actor: { id: "hook", kind: "hook", name: hookName },
      metadata: { hookName },
    });

    const allEvents = [hookGate, ...semanticEvents, hookDone];

    await appendEvents(allEvents).catch((err) => {
      process.stderr.write(`agentarium-hook: failed to append events: ${err}\n`);
    });
    await postToCollector(allEvents);
  } catch (err) {
    process.stderr.write(`agentarium-hook: non-fatal error (${hookName}): ${err}\n`);
  }

  // Always let the agent continue; this hook is observability-only.
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

main();
