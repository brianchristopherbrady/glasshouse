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
    data: parseJson<Record<string, unknown>>(e.data, {}),
  };
}
