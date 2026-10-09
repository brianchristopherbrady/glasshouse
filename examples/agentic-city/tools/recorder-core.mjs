// Records Agentic City agent activity (VS Code agent hooks) as Agentic Flows
// telemetry: one chat session = one run; prompts, subagents, and tool calls
// become spans; edits to the workspace become file changes with real diffs.
//
// Kept free of a shebang and of dependencies so tests and the replay script
// can import it directly. city-recorder.mjs is the thin hook entry point.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const STATE_DIR_NAME = '.city-recorder';
export const DEFAULT_SERVER_URL = 'http://127.0.0.1:4410';

const SESSION_SPAN = 'session';
const IGNORED_DIRS = new Set(['.git', 'node_modules', STATE_DIR_NAME]);
const MAX_SNAPSHOT_FILE_BYTES = 256 * 1024;
const MAX_SNAPSHOT_FILES = 500;
const PREVIEW_CHARS = 400;
const MAX_OUTBOX_EVENTS = 5000;
const BATCH_SIZE = 500;
const SUBAGENT_TOOL = /subagent|^agent$|^task$|run_?agent/i;
const READ_TOOL = /read|view|open|get_?file/i;
const SKILL_PATH = /(?:^|\/)\.github\/skills\/([^/]+)\/SKILL\.md$/i;
const EVENT_ALIASES = {
  sessionStart: 'SessionStart',
  userPromptSubmitted: 'UserPromptSubmit',
  preToolUse: 'PreToolUse',
  postToolUse: 'PostToolUse',
  postToolUseFailure: 'PostToolUseFailure',
  subagentStart: 'SubagentStart',
  subagentStop: 'SubagentStop',
  agentStop: 'Stop',
};

// ---------------------------------------------------------------- helpers

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function excerpt(value, max) {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function toPosix(p) {
  return p.split(sep).join('/');
}

export function slugify(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'workspace';
}

/** "/found-district Noodle Heights, ..." -> a short, readable run name. */
export function runNameFrom(prompt) {
  const text = String(prompt ?? '').trim();
  const firstLine = (s) => s.split(/\r?\n/)[0].trim();
  const slash = /^\/([A-Za-z0-9_.-]+)\s*([\s\S]*)$/.exec(text);
  const name = slash ? `/${slash[1]} ${firstLine(slash[2])}`.trim() : firstLine(text);
  return excerpt(name, 80) || 'Chat session';
}

function toolCategory(toolName = '') {
  if (/terminal|shell|bash|powershell|execute|command/i.test(toolName)) return 'shell';
  if (/^mcp_|mcp/i.test(toolName)) return 'mcp';
  if (/github|pull_?request|issue/i.test(toolName)) return 'github';
  if (/fetch|web|http|browser/i.test(toolName)) return 'network';
  if (/file|read|edit|create|replace|patch|write|view|list_?dir|search|grep|glob/i.test(toolName))
    return 'filesystem';
  return 'custom';
}

// ------------------------------------------------------------------- diffs

function splitLines(text) {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function diffOps(a, b) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const ops = a.slice(0, start).map((l) => ({ t: ' ', l }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  if (midA.length * midB.length > 4_000_000) {
    // Too large for an LCS table: show it as a full replacement.
    ops.push(...midA.map((l) => ({ t: '-', l })), ...midB.map((l) => ({ t: '+', l })));
  } else {
    const cols = midB.length + 1;
    const table = new Uint32Array((midA.length + 1) * cols);
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        table[i * cols + j] =
          midA[i] === midB[j]
            ? table[(i + 1) * cols + j + 1] + 1
            : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        ops.push({ t: ' ', l: midA[i++] });
        j++;
      } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
        ops.push({ t: '-', l: midA[i++] });
      } else {
        ops.push({ t: '+', l: midB[j++] });
      }
    }
    while (i < midA.length) ops.push({ t: '-', l: midA[i++] });
    while (j < midB.length) ops.push({ t: '+', l: midB[j++] });
  }
  ops.push(...a.slice(endA).map((l) => ({ t: ' ', l })));
  return ops;
}

/** Unified-diff hunks (no file header) plus line counts. */
export function unifiedDiff(before, after, context = 3) {
  const ops = diffOps(splitLines(before), splitLines(after));
  let oldNo = 1;
  let newNo = 1;
  const numbered = ops.map((op) => {
    const entry = { ...op, old: oldNo, new: newNo };
    if (op.t !== '+') oldNo++;
    if (op.t !== '-') newNo++;
    return entry;
  });
  const changes = numbered.flatMap((op, i) => (op.t === ' ' ? [] : [i]));
  if (changes.length === 0) return { diff: '', additions: 0, deletions: 0 };

  const ranges = [];
  let [start, end] = [changes[0] - context, changes[0] + context];
  for (const idx of changes.slice(1)) {
    if (idx - context <= end + 1) end = idx + context;
    else {
      ranges.push([start, end]);
      [start, end] = [idx - context, idx + context];
    }
  }
  ranges.push([start, end]);

  const hunks = ranges.map(([s, e]) => {
    const slice = numbered.slice(Math.max(0, s), Math.min(numbered.length, e + 1));
    const oldLines = slice.filter((o) => o.t !== '+');
    const newLines = slice.filter((o) => o.t !== '-');
    const oldStart = oldLines.length ? oldLines[0].old : slice[0].old - 1;
    const newStart = newLines.length ? newLines[0].new : slice[0].new - 1;
    return [
      `@@ -${oldStart},${oldLines.length} +${newStart},${newLines.length} @@`,
      ...slice.map((o) => `${o.t}${o.l}`),
    ].join('\n');
  });
  return {
    diff: hunks.join('\n'),
    additions: ops.filter((o) => o.t === '+').length,
    deletions: ops.filter((o) => o.t === '-').length,
  };
}

// --------------------------------------------------------- workspace scan

/** path -> text content (or a marker for binary/oversized files). */
export function scanWorkspace(root) {
  const snapshot = {};
  let count = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((x, y) => x.name.localeCompare(y.name))) {
      if (count >= MAX_SNAPSHOT_FILES) return;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile()) {
        count++;
        const rel = toPosix(relative(root, full));
        try {
          const { size } = statSync(full);
          if (size > MAX_SNAPSHOT_FILE_BYTES) {
            snapshot[rel] = { marker: `large:${size}` };
            continue;
          }
          const buffer = readFileSync(full);
          snapshot[rel] = buffer.includes(0)
            ? { marker: `binary:${hash(buffer).slice(0, 16)}` }
            : buffer.toString('utf8');
        } catch {
          // vanished mid-scan
        }
      }
    }
  };
  walk(root);
  return snapshot;
}

function changeEvents(ctx, owner, spanId) {
  const current = scanWorkspace(ctx.root);
  const previous = ctx.state.snapshot;
  const paths = [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort();
  for (const path of paths) {
    const before = previous[path];
    const after = current[path];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const kind =
      before === undefined
        ? 'file.created'
        : after === undefined
          ? 'file.deleted'
          : 'file.modified';
    const text = (v) => (typeof v === 'string' ? v : '');
    const textual = typeof (after ?? before) === 'string';
    const { diff, additions, deletions } = unifiedDiff(text(before), text(after));
    emit(ctx, {
      kind,
      spanId,
      actor: agentActor(owner.agent),
      data: {
        path,
        ...(textual ? { diff, additions, deletions } : {}),
        agent: owner.agent,
      },
      note: 'Observed on disk right after the tool call that made it, diffed against the previous snapshot.',
    });
  }
  ctx.state.snapshot = current;
}

// ------------------------------------------------------------ hook input

export function normalizePayload(raw, fallbackEvent) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const pick = (...keys) => {
    for (const key of keys) if (p[key] !== undefined && p[key] !== null) return p[key];
    return undefined;
  };
  const rawEvent = pick('hook_event_name', 'hookEventName') ?? fallbackEvent;
  const ts = pick('timestamp');
  const parsed = typeof ts === 'number' ? ts : typeof ts === 'string' ? Date.parse(ts) : NaN;
  return {
    event: EVENT_ALIASES[rawEvent] ?? rawEvent,
    sessionId: String(pick('session_id', 'sessionId') ?? 'default'),
    timestamp: Number.isFinite(parsed) ? parsed : Date.now(),
    toolName: pick('tool_name', 'toolName'),
    toolInput: pick('tool_input', 'toolArgs', 'toolInput') ?? {},
    toolUseId: pick('tool_use_id', 'toolUseId'),
    toolResponse: pick('tool_response', 'tool_result', 'toolResult', 'error'),
    agentId: pick('agent_id', 'agentId'),
    agentName: pick('agent_name', 'agentName', 'agent_type', 'agentType'),
    prompt: pick('prompt'),
    lastMessage: pick('last_assistant_message', 'response'),
    failed: rawEvent === 'PostToolUseFailure' || rawEvent === 'postToolUseFailure',
  };
}

/** Workspace-relative paths a read-like tool call looked at. */
function readPaths(root, toolName, input) {
  if (!READ_TOOL.test(toolName ?? '') || !input || typeof input !== 'object') return [];
  const candidates = [
    input.filePath,
    input.path,
    input.file,
    input.uri,
    input.filePaths,
    input.paths,
  ]
    .flat()
    .filter((v) => typeof v === 'string');
  const paths = [];
  for (const candidate of candidates) {
    let absolute = candidate;
    if (candidate.startsWith('file:')) {
      try {
        absolute = fileURLToPath(candidate);
      } catch {
        continue;
      }
    }
    absolute = isAbsolute(absolute) ? absolute : resolve(root, absolute);
    const rel = relative(root, absolute);
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) paths.push(toPosix(rel));
  }
  return [...new Set(paths)];
}

// ------------------------------------------------------------------ state

function stateDir(root) {
  return join(root, STATE_DIR_NAME);
}

function statePath(root, sessionKey) {
  return join(stateDir(root), 'sessions', `${sessionKey}.json`);
}

function loadState(root, sessionId) {
  const sessionKey = hash(sessionId).slice(0, 24);
  try {
    return JSON.parse(readFileSync(statePath(root, sessionKey), 'utf8'));
  } catch {
    return {
      sessionKey,
      seq: 0,
      turn: 0,
      turnAgent: null,
      turnSpanId: null,
      lastTurnSpanId: null,
      open: [],
      tools: {},
      emittedOnce: [],
      seen: [],
      snapshot: scanWorkspace(root),
    };
  }
}

function saveState(root, state) {
  const file = statePath(root, state.sessionKey);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state));
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Serializes concurrent hook processes; never blocks an agent for long. */
async function withLock(root, fn) {
  mkdirSync(stateDir(root), { recursive: true });
  const lock = join(stateDir(root), 'lock');
  const deadline = Date.now() + 5000;
  let acquired = false;
  while (!acquired) {
    try {
      closeSync(openSync(lock, 'wx'));
      acquired = true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 15_000) rmSync(lock, { force: true });
      } catch {
        // lock released meanwhile
      }
      if (Date.now() > deadline) break;
      sleepSync(25);
    }
  }
  try {
    return await fn();
  } finally {
    if (acquired) rmSync(lock, { force: true });
  }
}

export function log(root, message) {
  try {
    mkdirSync(stateDir(root), { recursive: true });
    appendFileSync(
      join(stateDir(root), 'recorder.log'),
      `${new Date().toISOString()} ${message}\n`,
    );
  } catch {
    // logging must never break a hook
  }
}

export function loadConfig(root, env = process.env) {
  let file = {};
  try {
    file = JSON.parse(readFileSync(join(stateDir(root), 'config.json'), 'utf8'));
  } catch {
    // optional
  }
  return {
    serverUrl: String(env.AGENTIC_FLOWS_URL ?? file.serverUrl ?? DEFAULT_SERVER_URL).replace(
      /\/+$/,
      '',
    ),
    token: env.AGENTIC_FLOWS_API_TOKEN ?? file.token,
    repository: file.repository ?? `local/${slugify(basename(root))}`,
  };
}

// ----------------------------------------------------------------- events

function agentActor(name) {
  return { type: 'agent', id: name, name };
}

function emit(ctx, { key, kind, spanId, parentSpanId, actor, data, note }) {
  const { state } = ctx;
  ctx.events.push({
    id: key
      ? `${state.sessionKey}-${hash(key).slice(0, 20)}`
      : `${state.sessionKey}-s${++state.seq}`,
    correlation: { repository: ctx.config.repository, sessionId: state.sessionKey },
    ...(spanId ? { spanId } : {}),
    ...(parentSpanId ? { parentSpanId } : {}),
    // +1ms per event keeps the order of one hook call's events stable.
    timestamp: new Date(ctx.timestamp + ctx.events.length).toISOString(),
    kind,
    ...(actor ? { actor } : {}),
    data,
    evidence: { source: 'runtime', confidence: 'observed', ...(note ? { note } : {}) },
  });
}

function emitOnce(ctx, onceKey, event) {
  if (ctx.state.emittedOnce.includes(onceKey)) return;
  ctx.state.emittedOnce = [...ctx.state.emittedOnce.slice(-1999), onceKey];
  emit(ctx, event);
}

function gitInfo(root) {
  const git = (...args) => {
    try {
      return execFileSync('git', args, {
        cwd: root,
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      return undefined;
    }
  };
  return { branch: git('rev-parse', '--abbrev-ref', 'HEAD'), commitSha: git('rev-parse', 'HEAD') };
}

function startTurn(ctx, agent, prompt) {
  const { state } = ctx;
  const previousAgent = state.turnAgent;
  const previousSpan = state.turnSpanId ?? state.lastTurnSpanId;
  if (state.turnSpanId) closeTurn(ctx);
  state.turn += 1;
  emit(ctx, {
    key: `workflow.started:${state.turn}`,
    kind: 'workflow.started',
    spanId: SESSION_SPAN,
    actor: { type: 'workflow', name: 'chat session' },
    data: {
      name: runNameFrom(prompt),
      trigger: 'chat prompt',
      engine: ctx.engine,
      ...(state.turn === 1 ? gitInfo(ctx.root) : {}),
    },
  });
  const spanId = `turn-${state.turn}`;
  emit(ctx, {
    key: `agent.started:${spanId}`,
    kind: 'agent.started',
    spanId,
    parentSpanId: SESSION_SPAN,
    actor: agentActor(agent),
    data: { name: agent, turn: state.turn, prompt: excerpt(prompt, 500) },
  });
  if (previousAgent && previousAgent !== agent && previousSpan) {
    emit(ctx, {
      key: `handoff:${spanId}`,
      kind: 'agent.handoff.completed',
      spanId: `handoff-${spanId}`,
      parentSpanId: SESSION_SPAN,
      actor: agentActor(previousAgent),
      data: {
        name: `${previousAgent} → ${agent}`,
        fromSpanId: previousSpan,
        toSpanId: spanId,
        reason: excerpt(prompt, 300) || 'The chat switched agents.',
        mode: 'handoff',
      },
      note: `The chat's active agent changed from ${previousAgent} to ${agent} between prompts.`,
    });
  }
  state.turnAgent = agent;
  state.turnSpanId = spanId;
  state.lastTurnSpanId = spanId;
  state.open = [{ spanId, agent, kind: 'turn' }];
}

function closeSubagent(ctx, sub, outputSummary) {
  const { state } = ctx;
  if (!state.open.includes(sub)) return;
  changeEvents(ctx, sub, sub.spanId);
  emit(ctx, {
    key: `agent.completed:${sub.spanId}`,
    kind: 'agent.completed',
    spanId: sub.spanId,
    actor: { type: 'subagent', id: sub.agent, name: sub.agent },
    data: { name: sub.agent, status: 'success' },
  });
  emit(ctx, {
    key: `handoff-return:${sub.spanId}`,
    kind: 'agent.handoff.completed',
    spanId: `handoff-return-${sub.spanId}`,
    parentSpanId: sub.parentSpanId,
    actor: agentActor(sub.agent),
    data: {
      name: `${sub.agent} → ${sub.parentAgent}`,
      fromSpanId: sub.spanId,
      toSpanId: sub.parentSpanId,
      reason: 'Reported back to the delegating agent.',
      outputSummary: excerpt(outputSummary, 600) || undefined,
      mode: 'subagent-return',
    },
  });
  state.open = state.open.filter((o) => o !== sub);
}

function closeTurn(ctx) {
  const { state } = ctx;
  for (const sub of state.open.filter((o) => o.kind === 'subagent').reverse()) {
    closeSubagent(ctx, sub);
  }
  emit(ctx, {
    key: `agent.completed:${state.turnSpanId}`,
    kind: 'agent.completed',
    spanId: state.turnSpanId,
    actor: agentActor(state.turnAgent),
    data: { name: state.turnAgent, status: 'success' },
  });
  state.turnSpanId = null;
  state.open = [];
}

function ensureTurn(ctx) {
  if (!ctx.state.turnSpanId) startTurn(ctx, ctx.agent ?? ctx.state.turnAgent ?? 'agent', '');
}

/** Which open agent span a tool call belongs to. */
function currentOwner(ctx) {
  ensureTurn(ctx);
  const { open, turnAgent } = ctx.state;
  const subs = open.filter((o) => o.kind === 'subagent');
  const named = [...subs].reverse().find((o) => o.agent === ctx.agent);
  if (named) return named;
  // A parent agent's hook can fire for its running subagent's tool calls.
  if (subs.length > 0 && (!ctx.agent || ctx.agent === turnAgent)) return subs[subs.length - 1];
  return open.find((o) => o.kind === 'turn');
}

function openSubagent(ctx, { agent, agentId, viaToolUseId, reason }) {
  const parent = currentOwner(ctx);
  const spanId = `sub-${hash(viaToolUseId ?? agentId ?? `${agent}-${ctx.state.seq}`).slice(0, 16)}`;
  const sub = {
    spanId,
    agent,
    agentId,
    viaToolUseId,
    kind: 'subagent',
    parentSpanId: parent.spanId,
    parentAgent: parent.agent,
  };
  emit(ctx, {
    key: `agent.started:${spanId}`,
    kind: 'agent.started',
    spanId,
    parentSpanId: parent.spanId,
    actor: { type: 'subagent', id: agent, name: agent },
    data: { name: agent, agentId },
  });
  emit(ctx, {
    key: `handoff:${spanId}`,
    kind: 'agent.handoff.completed',
    spanId: `handoff-${spanId}`,
    parentSpanId: parent.spanId,
    actor: agentActor(parent.agent),
    data: {
      name: `${parent.agent} → ${agent}`,
      fromSpanId: parent.spanId,
      toSpanId: spanId,
      reason: excerpt(reason, 300) || `Delegated to ${agent} as a subagent.`,
      mode: 'subagent',
    },
    note: `${parent.agent} started ${agent} as a subagent.`,
  });
  ctx.state.open.push(sub);
  return sub;
}

function onPreToolUse(ctx, p) {
  const { state } = ctx;
  if (SUBAGENT_TOOL.test(p.toolName ?? '')) {
    const input = p.toolInput ?? {};
    const agent = input.agentName ?? input.agent ?? input.subagent_type ?? input.agentType;
    openSubagent(ctx, {
      agent: typeof agent === 'string' && agent ? agent : 'subagent',
      viaToolUseId: p.toolUseId ?? `${p.toolName}-${state.seq}`,
      reason: input.description ?? input.prompt,
    });
    return undefined;
  }
  const owner = currentOwner(ctx);
  const toolKey = p.toolUseId ?? `${p.toolName}-${state.seq + 1}`;
  const spanId = `tool-${hash(toolKey).slice(0, 16)}`;
  state.tools[toolKey] = {
    spanId,
    ownerSpanId: owner.spanId,
    agent: owner.agent,
    toolName: p.toolName,
    startedAt: ctx.timestamp,
  };
  emit(ctx, {
    key: `tool.started:${toolKey}`,
    kind: 'tool.started',
    spanId,
    parentSpanId: owner.spanId,
    actor: { type: 'tool', name: p.toolName },
    data: {
      name: p.toolName,
      toolName: p.toolName,
      category: toolCategory(p.toolName),
      agent: owner.agent,
      argumentsPreview: excerpt(p.toolInput, PREVIEW_CHARS),
    },
  });
  return toolKey;
}

function onPostToolUse(ctx, p) {
  const { state } = ctx;
  if (SUBAGENT_TOOL.test(p.toolName ?? '')) {
    const sub =
      state.open.find((o) => o.kind === 'subagent' && o.viaToolUseId === p.toolUseId) ??
      [...state.open].reverse().find((o) => o.kind === 'subagent');
    if (sub) closeSubagent(ctx, sub, p.toolResponse);
    return;
  }
  let toolKey = p.toolUseId;
  if (!toolKey || !state.tools[toolKey]) {
    toolKey = Object.keys(state.tools)
      .reverse()
      .find((k) => state.tools[k].toolName === p.toolName);
  }
  if (!toolKey) {
    // No PreToolUse was recorded for this call: open and close it now.
    toolKey = onPreToolUse(ctx, p);
  }
  const tool = state.tools[toolKey];
  if (!tool) return;
  const owner = state.open.find((o) => o.spanId === tool.ownerSpanId) ?? {
    spanId: tool.ownerSpanId,
    agent: tool.agent,
  };

  for (const path of readPaths(ctx.root, p.toolName, p.toolInput)) {
    emitOnce(ctx, `read:${tool.spanId}:${path}`, {
      kind: 'file.read',
      spanId: tool.spanId,
      actor: agentActor(owner.agent),
      data: { path, agent: owner.agent },
    });
    const skill = SKILL_PATH.exec(path);
    if (skill) {
      emitOnce(ctx, `skill:${owner.spanId}:${skill[1]}`, {
        key: `skill.loaded:${owner.spanId}:${skill[1]}`,
        kind: 'skill.loaded',
        spanId: `skill-${hash(`${owner.spanId}:${skill[1]}`).slice(0, 16)}`,
        parentSpanId: owner.spanId,
        actor: agentActor(owner.agent),
        data: { name: skill[1], path },
        note: `${owner.agent} read ${path}.`,
      });
    }
  }

  changeEvents(ctx, owner, tool.spanId);
  emit(ctx, {
    key: `tool.completed:${toolKey}`,
    kind: 'tool.completed',
    spanId: tool.spanId,
    actor: { type: 'tool', name: p.toolName },
    data: {
      toolName: p.toolName,
      category: toolCategory(p.toolName),
      status: p.failed ? 'failure' : 'success',
      durationMs: Math.max(0, ctx.timestamp - tool.startedAt),
      argumentsPreview: excerpt(p.toolInput, PREVIEW_CHARS),
      resultPreview: excerpt(p.toolResponse, PREVIEW_CHARS),
    },
  });
  delete state.tools[toolKey];
}

function onSubagentStart(ctx, p) {
  const name = p.agentName ?? 'subagent';
  const { open } = ctx.state;
  if (open.some((o) => o.kind === 'subagent' && p.agentId && o.agentId === p.agentId)) return;
  // Already opened from the delegating tool call: just remember its id.
  const pending = [...open]
    .reverse()
    .find(
      (o) => o.kind === 'subagent' && !o.agentId && (o.agent === name || o.agent === 'subagent'),
    );
  if (pending) {
    pending.agentId = p.agentId;
    pending.agent = name;
    return;
  }
  openSubagent(ctx, { agent: name, agentId: p.agentId });
}

function onSubagentStop(ctx, p) {
  const subs = ctx.state.open.filter((o) => o.kind === 'subagent');
  const sub =
    subs.find((o) => p.agentId && o.agentId === p.agentId) ??
    [...subs].reverse().find((o) => o.agent === (p.agentName ?? ctx.agent));
  if (sub) closeSubagent(ctx, sub, p.lastMessage);
}

function onStop(ctx) {
  const { state } = ctx;
  const ownSub = [...state.open]
    .reverse()
    .find((o) => o.kind === 'subagent' && o.agent === ctx.agent && ctx.agent !== state.turnAgent);
  if (ownSub) {
    // A custom agent's Stop hook fires as its subagent stop.
    closeSubagent(ctx, ownSub);
    return;
  }
  if (!state.turnSpanId) return;
  const turn = state.open.find((o) => o.kind === 'turn');
  changeEvents(ctx, turn, turn.spanId);
  const finishedTurn = state.turn;
  closeTurn(ctx);
  emit(ctx, {
    key: `workflow.completed:${finishedTurn}`,
    kind: 'workflow.completed',
    spanId: SESSION_SPAN,
    actor: { type: 'workflow', name: 'chat session' },
    data: { status: 'success' },
  });
}

/**
 * Turns one hook invocation into telemetry events, updating the session's
 * persisted state. Synchronous and network-free (see runHook for delivery).
 */
export function handleHook(payload, args, { root, config, engine }) {
  const p = normalizePayload(payload, args.event);
  const state = loadState(root, p.sessionId);
  // Several agents' scoped hooks can fire for the same moment; record it once.
  const identity = p.toolUseId ?? p.agentId ?? `${p.timestamp}|${excerpt(p.prompt, 200)}`;
  const invocation = hash(`${p.event}|${identity}`);
  if (state.seen.includes(invocation)) return [];
  state.seen = [...state.seen.slice(-199), invocation];

  const ctx = {
    root,
    config,
    state,
    agent: args.agent,
    engine: engine ?? args.engine ?? 'VS Code agent (local)',
    timestamp: p.timestamp,
    events: [],
  };
  switch (p.event) {
    case 'UserPromptSubmit':
      startTurn(ctx, ctx.agent ?? state.turnAgent ?? 'agent', p.prompt);
      break;
    case 'PreToolUse':
      onPreToolUse(ctx, p);
      break;
    case 'PostToolUse':
    case 'PostToolUseFailure':
      onPostToolUse(ctx, p);
      break;
    case 'SubagentStart':
      onSubagentStart(ctx, p);
      break;
    case 'SubagentStop':
      onSubagentStop(ctx, p);
      break;
    case 'Stop':
      onStop(ctx);
      break;
    default:
      break; // SessionStart etc.: the state (and its baseline snapshot) is enough
  }
  saveState(root, state);
  return ctx.events;
}

// --------------------------------------------------------------- delivery

function readOutbox(file) {
  try {
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

async function registerWorkspace(root, config, fetchImpl, headers) {
  try {
    const res = await fetchImpl(`${config.serverUrl}/api/repositories/local`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path: root }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) log(root, `workspace registration failed: HTTP ${res.status}`);
    return res.ok;
  } catch (err) {
    log(root, `workspace registration failed: ${err.message}`);
    return false;
  }
}

/** 'ok' | 'retry' (keep for later) | 'drop' (the server rejected the events). */
async function postBatch(root, batch, config, fetchImpl, retried = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  let res;
  try {
    res = await fetchImpl(`${config.serverUrl}/api/telemetry/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: batch }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return 'retry';
  }
  if (res.ok) return 'ok';
  const body = await res.json().catch(() => null);
  if (res.status === 422 && body?.errors?.some((e) => e.error === 'unknown_repository')) {
    if (retried) return 'retry';
    return (await registerWorkspace(root, config, fetchImpl, headers))
      ? postBatch(root, batch, config, fetchImpl, true)
      : 'retry';
  }
  if (res.status >= 500 || [401, 403, 408, 429].includes(res.status)) return 'retry';
  log(root, `server rejected ${batch.length} event(s): HTTP ${res.status} ${JSON.stringify(body)}`);
  return 'drop';
}

/** Sends events (plus anything queued while the server was unreachable). */
export async function deliver(root, events, config, fetchImpl = fetch) {
  const outbox = join(stateDir(root), 'outbox.ndjson');
  const pending = [...readOutbox(outbox), ...events];
  if (pending.length === 0) return { delivered: 0, queued: 0 };
  let delivered = 0;
  let keep = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const outcome = await postBatch(root, batch, config, fetchImpl);
    if (outcome === 'ok') delivered += batch.length;
    if (outcome === 'retry') {
      keep = pending.slice(i).slice(-MAX_OUTBOX_EVENTS);
      break;
    }
  }
  if (keep.length > 0) {
    mkdirSync(stateDir(root), { recursive: true });
    writeFileSync(outbox, keep.map((e) => JSON.stringify(e)).join('\n') + '\n');
  } else {
    rmSync(outbox, { force: true });
  }
  return { delivered, queued: keep.length };
}

/** Full hook invocation: parse stdin, record, deliver. Never throws. */
export async function runHook(rawInput, args, options = {}) {
  const root = options.root ?? WORKSPACE_ROOT;
  try {
    const payload = rawInput && rawInput.trim() ? JSON.parse(rawInput) : {};
    const config = options.config ?? loadConfig(root);
    return await withLock(root, async () => {
      const events = handleHook(payload, args, { root, config, engine: options.engine });
      const delivery =
        options.deliver === false
          ? null
          : await deliver(root, events, config, options.fetchImpl ?? fetch);
      return { events, delivery };
    });
  } catch (err) {
    log(root, `hook failed (${args.event ?? 'unknown event'}): ${err.stack ?? err}`);
    return { events: [], delivery: null };
  }
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = /^--(agent|event|engine)$/.exec(argv[i]);
    if (flag && argv[i + 1] !== undefined) args[flag[1]] = argv[++i];
  }
  return args;
}
