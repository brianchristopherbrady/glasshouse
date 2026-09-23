import { discoverWorkflows } from './discoverWorkflows.js';
import { discoverAgents } from './discoverAgents.js';
import { discoverSkills } from './discoverSkills.js';
import { discoverInstructions } from './discoverInstructions.js';
import { discoverPrompts } from './discoverPrompts.js';
import { discoverHooks } from './discoverHooks.js';
import { discoverMcpServers } from './discoverMcpServers.js';
import { discoverRelationships } from './discoverRelationships.js';
import type { DiscoveredRepository } from './types.js';

/**
 * Walks a repository checkout and discovers every static agentic-workflow
 * artifact convention: workflows, agents, skills, instructions, prompts,
 * hooks, and MCP server configuration, plus the relationships between them.
 * Purely mechanical — no LLM calls, no inference beyond what's directly
 * observable on disk.
 */
export function discoverRepository(rootDir: string): DiscoveredRepository {
  const base = {
    workflows: discoverWorkflows(rootDir),
    agents: discoverAgents(rootDir),
    skills: discoverSkills(rootDir),
    instructions: discoverInstructions(rootDir),
    prompts: discoverPrompts(rootDir),
    hooks: discoverHooks(rootDir),
    mcpServers: discoverMcpServers(rootDir),
  };
  return { ...base, relationships: discoverRelationships(base) };
}
