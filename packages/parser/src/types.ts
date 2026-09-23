import type { EvidenceSource, Confidence, RelationshipType, DefinitionKind } from '@agentic-flows/domain';

/**
 * Discovery-layer types mirror packages/domain's definition schemas but omit
 * `id`/`repositoryId` — those are assigned by whatever persists the result
 * (a database, an in-memory store, etc). Paths are repo-relative with `/`
 * separators regardless of host OS.
 */

export interface DiscoveredWorkflow {
  path: string;
  name: string;
  frontmatter: Record<string, unknown>;
  body: string;
  triggers: string[];
  engine?: string;
  permissions?: Record<string, string>;
  safeOutputs?: string[];
  compiled?: { path: string; rawYaml: string };
}

export interface DiscoveredAgent {
  path: string;
  name: string;
  frontmatter: Record<string, unknown>;
  body: string;
  tools?: string[];
  mcpServers?: string[];
  configuredSkills?: string[];
}

export interface DiscoveredSkill {
  path: string;
  name: string;
  description?: string;
  frontmatter: Record<string, unknown>;
  body: string;
  scripts?: string[];
  resources?: string[];
}

export interface DiscoveredInstruction {
  path: string;
  kind: 'copilot-instructions' | 'scoped-instructions' | 'agents-md';
  applyTo?: string;
  body: string;
}

export interface DiscoveredPrompt {
  path: string;
  name: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface DiscoveredHook {
  path: string;
  rawJson: Record<string, unknown>;
}

export interface DiscoveredMcpServer {
  path: string;
  name: string;
  command?: string;
  args?: string[];
  rawConfig: Record<string, unknown>;
}

export interface DiscoveredRelationship {
  sourcePath: string;
  sourceKind: DefinitionKind;
  targetPath: string;
  targetKind: DefinitionKind;
  relationshipType: RelationshipType;
  evidence: { source: EvidenceSource; confidence: Confidence; note?: string };
}

export interface DiscoveredRepository {
  workflows: DiscoveredWorkflow[];
  agents: DiscoveredAgent[];
  skills: DiscoveredSkill[];
  instructions: DiscoveredInstruction[];
  prompts: DiscoveredPrompt[];
  hooks: DiscoveredHook[];
  mcpServers: DiscoveredMcpServer[];
  relationships: DiscoveredRelationship[];
}
