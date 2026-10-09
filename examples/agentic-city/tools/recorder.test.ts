import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentEventSchema } from '../../../packages/domain/src/events.js';
import { deliver, handleHook, runNameFrom, unifiedDiff } from './recorder-core.mjs';

type Event = {
  id: string;
  kind: string;
  spanId?: string;
  parentSpanId?: string;
  actor?: { type: string; name?: string };
  data: Record<string, unknown>;
};

const config = { serverUrl: 'http://recorder.test', repository: 'local/agentic-city' };
let root: string;
let clock = Date.parse('2026-10-08T12:00:00.000Z');

function hook(event: string, agent: string, extra: Record<string, unknown> = {}): Event[] {
  clock += 1000;
  return handleHook(
    {
      hook_event_name: event,
      session_id: 'session-1',
      timestamp: new Date(clock).toISOString(),
      ...extra,
    },
    { agent, event },
    { root, config },
  ) as Event[];
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentic-city-recorder-'));
  mkdirSync(join(root, 'city', 'districts'), { recursive: true });
  mkdirSync(join(root, '.github', 'skills', 'zoning-code'), { recursive: true });
  writeFileSync(join(root, 'city', 'map.md'), '# Map\n\nline 1\nline 2\n');
  writeFileSync(join(root, '.github', 'skills', 'zoning-code', 'SKILL.md'), '# Zoning\n');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('unifiedDiff', () => {
  it('produces hunks with context for a modified line', () => {
    const result = unifiedDiff('a\nb\nc\nd\ne\n', 'a\nb\nC\nd\ne\n');
    expect(result).toMatchObject({ additions: 1, deletions: 1 });
    expect(result.diff.split('\n')).toEqual([
      '@@ -1,5 +1,5 @@',
      ' a',
      ' b',
      '-c',
      '+C',
      ' d',
      ' e',
    ]);
  });

  it('diffs a created file against nothing', () => {
    const result = unifiedDiff('', 'one\ntwo\n');
    expect(result.diff).toBe('@@ -0,0 +1,2 @@\n+one\n+two');
    expect(result.additions).toBe(2);
  });
});

describe('runNameFrom', () => {
  it('keeps the slash command and its first line', () => {
    expect(runNameFrom('/found-district Noodle Heights\nmore text')).toBe(
      '/found-district Noodle Heights',
    );
    expect(runNameFrom('')).toBe('Chat session');
  });
});

describe('handleHook', () => {
  it('records a delegated session as runs, agents, handoffs, skills, and diffs', () => {
    const events: Event[] = [
      ...hook('UserPromptSubmit', 'mayor', { prompt: '/found-district Noodle Heights' }),
      ...hook('PreToolUse', 'mayor', {
        tool_name: 'runSubagent',
        tool_use_id: 'delegate-1',
        tool_input: { agentName: 'city-planner', description: 'Design Noodle Heights' },
      }),
      ...hook('SubagentStart', 'mayor', { agent_id: 'sub-a', agent_type: 'city-planner' }),
      ...hook('PreToolUse', 'city-planner', {
        tool_name: 'read_file',
        tool_use_id: 'read-1',
        tool_input: { filePath: join(root, '.github', 'skills', 'zoning-code', 'SKILL.md') },
      }),
      ...hook('PostToolUse', 'city-planner', {
        tool_name: 'read_file',
        tool_use_id: 'read-1',
        tool_input: { filePath: join(root, '.github', 'skills', 'zoning-code', 'SKILL.md') },
        tool_response: '# Zoning',
      }),
      ...hook('PreToolUse', 'city-planner', { tool_name: 'create_file', tool_use_id: 'create-1' }),
    ];
    writeFileSync(join(root, 'city', 'districts', 'noodle-heights.md'), '# Noodle Heights\n');
    writeFileSync(join(root, 'city', 'map.md'), '# Map\n\nline 1\nline 2 [NH]\n');
    events.push(
      ...hook('PostToolUse', 'city-planner', { tool_name: 'create_file', tool_use_id: 'create-1' }),
      ...hook('SubagentStop', 'city-planner', {
        agent_id: 'sub-a',
        agent_type: 'city-planner',
        last_assistant_message: 'Designed Noodle Heights on C2.',
      }),
      ...hook('PostToolUse', 'mayor', { tool_name: 'runSubagent', tool_use_id: 'delegate-1' }),
      ...hook('Stop', 'mayor'),
      ...hook('UserPromptSubmit', 'town-crier', { prompt: 'Publish a new edition.' }),
      ...hook('Stop', 'town-crier'),
    );

    for (const event of events) {
      expect(AgentEventSchema.safeParse(event).success, JSON.stringify(event)).toBe(true);
    }
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);

    const sub = events.find((e) => e.kind === 'agent.started' && e.actor?.type === 'subagent')!;
    expect(sub).toMatchObject({ parentSpanId: 'turn-1', data: { name: 'city-planner' } });
    const handoffs = events.filter((e) => e.kind === 'agent.handoff.completed');
    expect(handoffs.map((h) => h.data.name)).toEqual([
      'mayor → city-planner',
      'city-planner → mayor',
      'mayor → town-crier',
    ]);
    expect(handoffs[0]!.data).toMatchObject({ fromSpanId: 'turn-1', toSpanId: sub.spanId });
    expect(handoffs[1]!.data.outputSummary).toBe('Designed Noodle Heights on C2.');

    expect(events.find((e) => e.kind === 'skill.loaded')).toMatchObject({
      parentSpanId: sub.spanId,
      data: { name: 'zoning-code' },
    });
    expect(events.find((e) => e.kind === 'file.read')?.data.path).toBe(
      '.github/skills/zoning-code/SKILL.md',
    );

    const created = events.find((e) => e.kind === 'file.created')!;
    expect(created).toMatchObject({
      actor: { name: 'city-planner' },
      data: { path: 'city/districts/noodle-heights.md', additions: 1, deletions: 0 },
    });
    const toolSpan = events.find(
      (e) => e.kind === 'tool.started' && e.data.toolName === 'create_file',
    )!;
    expect(created.spanId).toBe(toolSpan.spanId);
    expect(toolSpan.parentSpanId).toBe(sub.spanId);
    expect(events.find((e) => e.kind === 'file.modified')?.data).toMatchObject({
      path: 'city/map.md',
      diff: '@@ -1,4 +1,4 @@\n # Map\n \n line 1\n-line 2\n+line 2 [NH]',
    });

    expect(events.filter((e) => e.kind === 'workflow.completed')).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: 'workflow.started',
      data: { name: '/found-district Noodle Heights' },
    });
  });

  it('records a hook that fires twice for the same tool call only once', () => {
    hook('UserPromptSubmit', 'mayor', { prompt: 'hi' });
    const first = hook('PreToolUse', 'mayor', { tool_name: 'read_file', tool_use_id: 'x' });
    const second = hook('PreToolUse', 'city-planner', { tool_name: 'read_file', tool_use_id: 'x' });
    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
  });

  it('records a skill read from the repository root mirror, but not the read itself', () => {
    const rootMirror = join(root, '..', '..', '.github', 'skills', 'civic-budget', 'SKILL.md');
    hook('UserPromptSubmit', 'treasurer', { prompt: 'Audit the books.' });
    const events = hook('PostToolUse', 'treasurer', {
      tool_name: 'read_file',
      tool_use_id: 'read-root',
      tool_input: { filePath: rootMirror },
    });
    expect(events.find((e) => e.kind === 'skill.loaded')?.data).toEqual({
      name: 'civic-budget',
      path: '.github/skills/civic-budget/SKILL.md',
    });
    expect(events.some((e) => e.kind === 'file.read')).toBe(false);
  });
});

describe('deliver', () => {
  function response(status: number, body: unknown = {}) {
    return new Response(JSON.stringify(body), { status });
  }

  it('registers the workspace when the server does not know it yet, then retries', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const replies = [
      response(422, { ok: false, errors: [{ index: 0, error: 'unknown_repository' }] }),
      response(201),
      response(201, { ok: true }),
    ];
    const fetchImpl = async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return replies.shift()!;
    };
    const events = hook('UserPromptSubmit', 'mayor', { prompt: 'hi' });
    const result = await deliver(root, events, config, fetchImpl);
    expect(result).toEqual({ delivered: events.length, queued: 0 });
    expect(calls.map((c) => c.url)).toEqual([
      'http://recorder.test/api/telemetry/batch',
      'http://recorder.test/api/repositories/local',
      'http://recorder.test/api/telemetry/batch',
    ]);
    expect(calls[1]!.body).toEqual({ path: root });
  });

  it('queues events while the server is unreachable and flushes them later', async () => {
    const events = hook('UserPromptSubmit', 'mayor', { prompt: 'hi' });
    const offline = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await deliver(root, events, config, offline)).toEqual({
      delivered: 0,
      queued: events.length,
    });
    expect(readFileSync(join(root, '.city-recorder', 'outbox.ndjson'), 'utf8')).toContain(
      events[0]!.id,
    );

    let posted = 0;
    const online = async (_url: string, init: RequestInit) => {
      posted += (JSON.parse(String(init.body)) as { events: unknown[] }).events.length;
      return response(201, { ok: true });
    };
    expect(await deliver(root, [], config, online)).toEqual({
      delivered: events.length,
      queued: 0,
    });
    expect(posted).toBe(events.length);
  });
});
