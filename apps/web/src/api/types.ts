// Server-shaped view types. These mirror the Prisma models the API returns
// (dates arrive as ISO strings over JSON), kept separate from
// @agentic-flows/domain's Zod schemas which describe the deeper conceptual
// model. The UI only needs these lighter shapes.

export interface Repository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  provider: string;
}

export interface WorkflowDefinition {
  id: string;
  path: string;
  name: string;
  frontmatter: Record<string, unknown>;
  body: string;
  triggers: string[];
  engine: string | null;
  permissions: Record<string, string> | null;
  safeOutputs: string[] | null;
  compiledWorkflow: { path: string; rawYaml: string } | null;
}

export interface AgentDefinition {
  id: string;
  path: string;
  name: string;
  body: string;
  tools: string[] | null;
  mcpServers: string[] | null;
  configuredSkills: string[] | null;
}

export interface SkillDefinition {
  id: string;
  path: string;
  name: string;
  description: string | null;
  body: string;
}

export type RunStatus = 'pending' | 'running' | 'success' | 'failure' | 'unknown';

export interface WorkflowRun {
  id: string;
  repositoryId: string;
  workflowDefinitionId: string | null;
  workflowName: string;
  trigger: string;
  branch: string | null;
  commitSha: string | null;
  pullRequestNumber: number | null;
  status: RunStatus;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  engine: string | null;
}

export interface OverviewResponse {
  recentRuns: WorkflowRun[];
  totalRuns: number;
  successRate: number | null;
  averageDurationMs: number | null;
  workflowDefCount: number;
  agentDefCount: number;
  skillDefCount: number;
  toolCallCount: number;
  fileOpCount: number;
  pullRequestCount: number;
  handoffCount: number;
  failingRuns: WorkflowRun[];
}

export interface TraceSpanNode {
  id: string;
  parentSpanId: string | null;
  type: string;
  name: string;
  actorId: string | null;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  status: string;
  attributes: unknown;
  source: string;
  confidence: string;
  children: TraceSpanNode[];
}

export interface RunTraceResponse {
  run: WorkflowRun;
  trace: TraceSpanNode[];
}

export interface AgentRun {
  id: string;
  runId: string;
  spanId: string;
  agentDefinitionId: string | null;
  name: string;
  parentAgentRunId: string | null;
  startTime: string;
  endTime: string | null;
  status: string;
  agentDefinition?: AgentDefinition | null;
}

export interface AgentHandoff {
  id: string;
  fromAgentRunId: string;
  toAgentRunId: string;
  timestamp: string;
  reason: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
}

export interface RunAgentsResponse {
  agentRuns: AgentRun[];
  handoffs: AgentHandoff[];
}

export type TriState = 'true' | 'false' | 'unknown';

export interface SkillUsage {
  id: string;
  skillDefinitionId: string;
  agentRunId: string;
  available: boolean;
  configured: boolean;
  loaded: TriState;
  referenced: TriState;
  executionEvidence: TriState;
  evidence: Array<{ source: string; confidence: string; note?: string }>;
  skillDefinition: SkillDefinition;
}

export interface ToolInvocation {
  id: string;
  runId: string;
  spanId: string;
  agentRunId: string | null;
  category: 'shell' | 'github' | 'mcp' | 'filesystem' | 'network' | 'custom';
  toolName: string;
  argumentsPreview: string | null;
  resultPreview: string | null;
  status: string;
  durationMs: number | null;
}

export interface FileOperation {
  id: string;
  runId: string;
  spanId: string | null;
  path: string;
  previousPath: string | null;
  operation: 'read' | 'created' | 'modified' | 'deleted' | 'renamed' | 'committed';
  additions: number | null;
  deletions: number | null;
  beforeSha: string | null;
  afterSha: string | null;
  diff: string | null;
  actorId: string | null;
}

export interface RunEvent {
  id: string;
  runId: string;
  spanId: string | null;
  parentSpanId: string | null;
  timestamp: string;
  kind: string;
  actorType: string | null;
  actorId: string | null;
  actorName: string | null;
  data: Record<string, unknown>;
  evidenceSource: string;
  evidenceConfidence: string;
  evidenceNote: string | null;
}

export interface RunGithubResponse {
  pullRequests: Array<{
    id: string;
    action: string;
    number: number;
    title: string;
    url: string;
    timestamp: string;
  }>;
  issues: Array<{
    id: string;
    action: string;
    number: number;
    title: string;
    url: string;
    timestamp: string;
  }>;
  checks: Array<{
    id: string;
    name: string;
    status: string;
    startTime: string;
    endTime: string | null;
  }>;
  commits: Array<{
    id: string;
    sha: string;
    message: string;
    authorName: string;
    authoredAt: string;
  }>;
}

export interface RunMetrics {
  durationMs: number | null;
  modelCallCount: number;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
  toolCallCount: number;
  filesChanged: number;
}

export interface LogRecord {
  id: string;
  runId: string;
  spanId: string | null;
  source: string;
  timestamp: string;
  level: string;
  message: string;
}

export interface DriftFinding {
  id: string;
  runId: string;
  kind: string;
  description: string;
  expected: string | null;
  observed: string | null;
}

export interface FileHotspot {
  path: string;
  runCount: number;
  workflows: string[];
  totalOps: number;
  failureCount: number;
}

export interface DefinitionRelationship {
  id: string;
  sourceDefinitionId: string;
  sourceKind: string;
  targetDefinitionId: string;
  targetKind: string;
  relationshipType: string;
  evidenceSource: string;
  evidenceConfidence: string;
  evidenceNote: string | null;
}

export interface SyncResult {
  ok: boolean;
  workflows: number;
  agents: number;
  skills: number;
  instructions: number;
  prompts: number;
  hooks: number;
  mcpServers: number;
  relationships: number;
}

export type DefinitionKind =
  | 'workflow'
  | 'compiled-workflow'
  | 'agent'
  | 'skill'
  | 'instruction'
  | 'prompt'
  | 'hook'
  | 'mcp-server';

export interface ArchitectureNode {
  id: string;
  kind: DefinitionKind;
  name: string;
  path: string;
}

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  sourceKind: string;
  targetKind: string;
  relationshipType: string;
  evidenceSource: string;
  evidenceConfidence: string;
  evidenceNote: string | null;
}

export interface ArchitectureGraphResponse {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}
