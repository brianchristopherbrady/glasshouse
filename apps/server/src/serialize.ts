import { redactSecretsDeep } from '@brianbrady/glasshouse-domain';

/**
 * SQLite has no native Json column; JSON-typed fields are stored as text
 * and must be parsed back into real objects/arrays before being sent to
 * clients. Centralized here so every route uses the same fallback logic.
 */
export function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function serializeWorkflowDefinition<
  T extends {
    frontmatter: string;
    triggers: string;
    permissions: string | null;
    safeOutputs: string | null;
  },
>(w: T) {
  return {
    ...w,
    frontmatter: parseJson<Record<string, unknown>>(w.frontmatter, {}),
    triggers: parseJson<string[]>(w.triggers, []),
    permissions: parseJson<Record<string, string> | null>(w.permissions, null),
    safeOutputs: parseJson<string[] | null>(w.safeOutputs, null),
  };
}

export function serializeAgentDefinition<
  T extends {
    frontmatter: string;
    tools: string | null;
    mcpServers: string | null;
    configuredSkills: string | null;
  },
>(a: T) {
  return {
    ...a,
    frontmatter: parseJson<Record<string, unknown>>(a.frontmatter, {}),
    tools: parseJson<string[] | null>(a.tools, null),
    mcpServers: parseJson<string[] | null>(a.mcpServers, null),
    configuredSkills: parseJson<string[] | null>(a.configuredSkills, null),
  };
}

export function serializeSkillDefinition<
  T extends { frontmatter: string; scripts: string | null; resources: string | null },
>(s: T) {
  return {
    ...s,
    frontmatter: parseJson<Record<string, unknown>>(s.frontmatter, {}),
    scripts: parseJson<string[] | null>(s.scripts, null),
    resources: parseJson<string[] | null>(s.resources, null),
  };
}

export function serializeSkillUsage<T extends { evidence: string }>(u: T) {
  return {
    ...u,
    evidence: parseJson<Array<{ source: string; confidence: string; note?: string }>>(
      u.evidence,
      [],
    ),
  };
}

export function serializeEvent<T extends { data: string }>(e: T) {
  return {
    ...e,
    // Event data comes from external agent/tool producers and is displayed
    // verbatim in the timeline/inspector — redact before it ever renders.
    data: redactSecretsDeep(parseJson<Record<string, unknown>>(e.data, {})),
  };
}

function frontmatterText(frontmatter: Record<string, unknown>, key: string): string | null {
  const value = frontmatter[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The slash command a prompt file is invoked with: its `name:`, else its file name. */
export function promptCommand(p: { name: string; frontmatter: string }): string {
  return frontmatterText(parseJson<Record<string, unknown>>(p.frontmatter, {}), 'name') ?? p.name;
}

export function serializePromptDefinition<
  T extends {
    name: string;
    frontmatter: string;
    _count: { workflowRuns: number };
    workflowRuns: Array<{ id: string; status: string; startTime: Date }>;
  },
>(p: T) {
  const { _count, workflowRuns, ...rest } = p;
  const frontmatter = parseJson<Record<string, unknown>>(p.frontmatter, {});
  return {
    ...rest,
    frontmatter,
    command: promptCommand(p),
    description: frontmatterText(frontmatter, 'description'),
    agent: frontmatterText(frontmatter, 'agent') ?? frontmatterText(frontmatter, 'mode'),
    runCount: _count.workflowRuns,
    lastRun: workflowRuns[0] ?? null,
  };
}
