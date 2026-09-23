import { z } from 'zod';
import { IdSchema } from './ids.js';
import { EvidenceSchema } from './evidence.js';

/** A repository that has been discovered/connected to the product. */
export const RepositorySchema = z.object({
  id: IdSchema,
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  defaultBranch: z.string(),
  provider: z.literal('github'),
  providerRepoId: z.string(),
});
export type Repository = z.infer<typeof RepositorySchema>;

/** `.github/workflows/*.md` — Agentic Workflow source definition. */
export const WorkflowDefinitionSchema = z.object({
  id: IdSchema,
  repositoryId: IdSchema,
  path: z.string(),
  name: z.string(),
  /** Raw YAML frontmatter parsed to a plain record. */
  frontmatter: z.record(z.string(), z.unknown()),
  /** Natural-language instructions body (markdown, minus frontmatter). */
  body: z.string(),
  triggers: z.array(z.string()),
  engine: z.string().optional(),
  permissions: z.record(z.string(), z.string()).optional(),
  safeOutputs: z.array(z.string()).optional(),
  compiledWorkflowId: IdSchema.optional(),
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

/** Compiled `.lock.yml` GitHub Actions workflow. */
export const CompiledWorkflowSchema = z.object({
  id: IdSchema,
  workflowDefinitionId: IdSchema,
  path: z.string(),
  rawYaml: z.string(),
});
export type CompiledWorkflow = z.infer<typeof CompiledWorkflowSchema>;

/** `.github/agents/*.md` — custom agent definition. */
export const AgentDefinitionSchema = z.object({
  id: IdSchema,
  repositoryId: IdSchema,
  path: z.string(),
  name: z.string(),
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string(),
  tools: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
  configuredSkills: z.array(z.string()).optional(),
});
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

/**
 * SKILL.md under .github/skills, .agents/skills, or .claude/skills.
 */
export const SkillDefinitionSchema = z.object({
  id: IdSchema,
  repositoryId: IdSchema,
  path: z.string(),
  name: z.string(),
  description: z.string().optional(),
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string(),
  scripts: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
});
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

/**
 * .github/copilot-instructions.md, .github/instructions/*.instructions.md,
 * or AGENTS.md.
 */
export const InstructionDefinitionSchema = z.object({
  id: IdSchema,
  repositoryId: IdSchema,
  path: z.string(),
  kind: z.enum(['copilot-instructions', 'scoped-instructions', 'agents-md']),
  applyTo: z.string().optional(),
  body: z.string(),
});
export type InstructionDefinition = z.infer<typeof InstructionDefinitionSchema>;

/** .github/prompts/*.prompt.md */
export const PromptDefinitionSchema = z.object({
  id: IdSchema,
  repositoryId: IdSchema,
  path: z.string(),
  name: z.string(),
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string(),
});
export type PromptDefinition = z.infer<typeof PromptDefinitionSchema>;

/** .github/hooks/*.json */
export const HookDefinitionSchema = z.object({
  id: IdSchema,
  repositoryId: IdSchema,
  path: z.string(),
  rawJson: z.record(z.string(), z.unknown()),
});
export type HookDefinition = z.infer<typeof HookDefinitionSchema>;

/** MCP server configuration discovered in the repository. */
export const McpServerDefinitionSchema = z.object({
  id: IdSchema,
  repositoryId: IdSchema,
  path: z.string(),
  name: z.string(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  rawConfig: z.record(z.string(), z.unknown()),
});
export type McpServerDefinition = z.infer<typeof McpServerDefinitionSchema>;

export const RelationshipTypeSchema = z.enum([
  'USES',
  'CONFIGURES',
  'CAN_CALL',
  'LOADS',
  'REFERENCES',
  'DEPENDS_ON',
  'COMPILES_TO',
  'TRIGGERS',
  'PERMITS',
]);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export const DefinitionKindSchema = z.enum([
  'workflow',
  'compiled-workflow',
  'agent',
  'skill',
  'instruction',
  'prompt',
  'hook',
  'mcp-server',
]);
export type DefinitionKind = z.infer<typeof DefinitionKindSchema>;

/**
 * A statically-discovered relationship between two definitions, always
 * carrying evidence — relationships must never be hallucinated from
 * surface-level text similarity.
 */
export const DefinitionRelationshipSchema = z.object({
  id: IdSchema,
  sourceDefinitionId: IdSchema,
  sourceKind: DefinitionKindSchema,
  targetDefinitionId: IdSchema,
  targetKind: DefinitionKindSchema,
  relationshipType: RelationshipTypeSchema,
  evidence: EvidenceSchema,
});
export type DefinitionRelationship = z.infer<typeof DefinitionRelationshipSchema>;
