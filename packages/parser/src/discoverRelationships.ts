import type { DiscoveredRelationship, DiscoveredRepository } from './types.js';

type WithoutRelationships = Omit<DiscoveredRepository, 'relationships'>;

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return typeof value === 'string' ? [value] : [];
}

function handoffTargets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((h) => (h && typeof h === 'object' ? (h as Record<string, unknown>).agent : undefined))
    .filter((a): a is string => typeof a === 'string');
}

/**
 * Extracts relationships between already-discovered definitions. Every
 * relationship here is backed by a concrete, checkable fact (a matching
 * filename, a matching declared name) — never a text-similarity guess.
 * If a reference can't be resolved to a real discovered definition, it is
 * silently dropped rather than emitted with fabricated confidence.
 */
export function discoverRelationships(repo: WithoutRelationships): DiscoveredRelationship[] {
  const relationships: DiscoveredRelationship[] = [];

  // workflow -> compiled-workflow: both files were found on disk together,
  // matched by the `.lock.yml` naming convention. Directly observed.
  for (const workflow of repo.workflows) {
    if (!workflow.compiled) continue;
    relationships.push({
      sourcePath: workflow.path,
      sourceKind: 'workflow',
      targetPath: workflow.compiled.path,
      targetKind: 'compiled-workflow',
      relationshipType: 'COMPILES_TO',
      evidence: {
        source: 'parser',
        confidence: 'observed',
        note: `${workflow.compiled.path} found alongside ${workflow.path}`,
      },
    });
  }

  const skillsByName = new Map(repo.skills.map((s) => [s.name, s]));
  const mcpServersByName = new Map(repo.mcpServers.map((m) => [m.name, m]));
  const agentsByName = new Map(repo.agents.map((a) => [a.name, a]));

  for (const agent of repo.agents) {
    // agent -> agent: `agents:` lists the custom agents this agent may run as
    // subagents. `*` (any agent) names nothing concrete, so it's skipped.
    for (const subagentName of new Set(asStringList(agent.frontmatter.agents))) {
      const subagent = agentsByName.get(subagentName);
      if (!subagent || subagent === agent) continue;
      relationships.push({
        sourcePath: agent.path,
        sourceKind: 'agent',
        targetPath: subagent.path,
        targetKind: 'agent',
        relationshipType: 'CAN_CALL',
        evidence: {
          source: 'parser',
          confidence: 'strong',
          note: `${agent.path} frontmatter lists "${subagentName}" as a subagent`,
        },
      });
    }

    // agent -> agent: each `handoffs:` entry names the agent its button switches to.
    for (const targetName of new Set(handoffTargets(agent.frontmatter.handoffs))) {
      const target = agentsByName.get(targetName);
      if (!target || target === agent) continue;
      relationships.push({
        sourcePath: agent.path,
        sourceKind: 'agent',
        targetPath: target.path,
        targetKind: 'agent',
        relationshipType: 'HANDS_OFF_TO',
        evidence: {
          source: 'parser',
          confidence: 'strong',
          note: `${agent.path} declares a handoff to "${targetName}"`,
        },
      });
    }

    // agent -> skill: agent frontmatter names a skill that was also
    // independently discovered under a skills directory. Name-based match,
    // so "strong" rather than "observed" (a rename could desync them).
    for (const skillName of agent.configuredSkills ?? []) {
      const skill = skillsByName.get(skillName);
      if (!skill) continue;
      relationships.push({
        sourcePath: agent.path,
        sourceKind: 'agent',
        targetPath: skill.path,
        targetKind: 'skill',
        relationshipType: 'CONFIGURES',
        evidence: {
          source: 'parser',
          confidence: 'strong',
          note: `${agent.path} frontmatter lists skill "${skillName}"`,
        },
      });
    }

    // agent -> mcp-server: same name-based matching approach. MCP servers
    // are keyed by "path::name" (not just path) since one config file can
    // declare multiple distinct servers.
    for (const serverName of agent.mcpServers ?? []) {
      const server = mcpServersByName.get(serverName);
      if (!server) continue;
      relationships.push({
        sourcePath: agent.path,
        sourceKind: 'agent',
        targetPath: `${server.path}::${server.name}`,
        targetKind: 'mcp-server',
        relationshipType: 'CAN_CALL',
        evidence: {
          source: 'parser',
          confidence: 'strong',
          note: `${agent.path} frontmatter lists MCP server "${serverName}"`,
        },
      });
    }
  }

  // prompt -> agent: a prompt file's `agent:` (legacy `mode:`) names the agent it runs in.
  for (const prompt of repo.prompts) {
    const agentName = prompt.frontmatter.agent ?? prompt.frontmatter.mode;
    if (typeof agentName !== 'string') continue;
    const agent = agentsByName.get(agentName);
    if (!agent) continue;
    relationships.push({
      sourcePath: prompt.path,
      sourceKind: 'prompt',
      targetPath: agent.path,
      targetKind: 'agent',
      relationshipType: 'USES',
      evidence: {
        source: 'parser',
        confidence: 'strong',
        note: `${prompt.path} runs in agent "${agentName}"`,
      },
    });
  }

  return relationships;
}
