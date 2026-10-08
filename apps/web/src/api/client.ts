import type {
  AgentDefinition,
  ApiTokenRecord,
  ArchitectureGraphResponse,
  ConnectGithubResult,
  CreatedApiToken,
  DefinitionRelationship,
  DriftFinding,
  FileHotspot,
  FileOperation,
  GithubRunSyncResult,
  LogRecord,
  Me,
  OverviewResponse,
  Repository,
  Role,
  RunAgentsResponse,
  RunEvent,
  RunGithubResponse,
  RunMetrics,
  RunTraceResponse,
  SkillDefinition,
  SkillUsage,
  SyncResult,
  ToolInvocation,
  WorkflowDefinition,
  WorkflowRun,
} from './types.js';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

// Set VITE_STATIC_DEMO=true (see apps/web/.env.github-pages) to serve
// pre-exported JSON snapshots instead of the live Fastify API — Pages can
// only host static files, so this is what powers the hosted demo.
export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true';
const STATIC_BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/demo-data';

// Each person signs in with their own API token (never baked into the
// bundle, which anyone loading the page could read).
const TOKEN_STORAGE_KEY = 'agentic-flows-api-token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text) as { error?: string; message?: string };
    return new ApiError(res.status, body.message ?? body.error ?? res.statusText, body.error);
  } catch {
    return new ApiError(res.status, text || res.statusText);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

const getJson = <T>(path: string) => request<T>('GET', path);
const postJson = <T>(path: string, body: unknown = {}) => request<T>('POST', path, body);

function unavailableInDemo(feature: string): never {
  throw new ApiError(
    501,
    `${feature} is unavailable in this static demo — it requires a live server.`,
  );
}

const liveApi = {
  listRepositories: () => getJson<Repository[]>('/api/repositories'),
  getRepository: (repoId: string) => getJson<Repository>(`/api/repositories/${repoId}`),
  getOverview: (repoId: string) =>
    getJson<OverviewResponse>(`/api/repositories/${repoId}/overview`),
  listWorkflows: (repoId: string) =>
    getJson<WorkflowDefinition[]>(`/api/repositories/${repoId}/workflows`),
  getWorkflow: (repoId: string, workflowId: string) =>
    getJson<WorkflowDefinition>(`/api/repositories/${repoId}/workflows/${workflowId}`),
  listAgents: (repoId: string) => getJson<AgentDefinition[]>(`/api/repositories/${repoId}/agents`),
  listSkills: (repoId: string) => getJson<SkillDefinition[]>(`/api/repositories/${repoId}/skills`),
  listFileHotspots: (repoId: string) => getJson<FileHotspot[]>(`/api/repositories/${repoId}/files`),
  listRelationships: (repoId: string) =>
    getJson<DefinitionRelationship[]>(`/api/repositories/${repoId}/relationships`),
  getArchitecture: (repoId: string) =>
    getJson<ArchitectureGraphResponse>(`/api/repositories/${repoId}/architecture`),
  syncRepository: (repoId: string, checkoutDir: string) =>
    postJson<SyncResult>(`/api/repositories/${repoId}/sync`, { checkoutDir }),
  listRuns: (repoId: string, filters?: { workflowId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.workflowId) params.set('workflowId', filters.workflowId);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return getJson<WorkflowRun[]>(`/api/repositories/${repoId}/runs${qs ? `?${qs}` : ''}`);
  },
  getRun: (runId: string) => getJson<WorkflowRun>(`/api/runs/${runId}`),
  getRunTrace: (runId: string) => getJson<RunTraceResponse>(`/api/runs/${runId}/trace`),
  getRunEvents: (runId: string) => getJson<RunEvent[]>(`/api/runs/${runId}/events`),
  getRunFiles: (runId: string) => getJson<FileOperation[]>(`/api/runs/${runId}/files`),
  getRunAgents: (runId: string) => getJson<RunAgentsResponse>(`/api/runs/${runId}/agents`),
  getRunSkills: (runId: string) => getJson<SkillUsage[]>(`/api/runs/${runId}/skills`),
  getRunTools: (runId: string) => getJson<ToolInvocation[]>(`/api/runs/${runId}/tools`),
  getRunLogs: (runId: string) => getJson<LogRecord[]>(`/api/runs/${runId}/logs`),
  getRunGithub: (runId: string) => getJson<RunGithubResponse>(`/api/runs/${runId}/github`),
  getRunMetrics: (runId: string) => getJson<RunMetrics>(`/api/runs/${runId}/metrics`),
  getRunDrift: (runId: string) => getJson<DriftFinding[]>(`/api/runs/${runId}/drift`),
  getMe: () => getJson<Me>('/api/auth/me'),
  listTokens: () => getJson<ApiTokenRecord[]>('/api/tokens'),
  createToken: (input: { name: string; role: Role; repositoryId: string | null }) =>
    postJson<CreatedApiToken>('/api/tokens', input),
  revokeToken: (id: string) => request<ApiTokenRecord>('DELETE', `/api/tokens/${id}`),
  connectGithubRepository: (owner: string, repo: string) =>
    postJson<ConnectGithubResult>('/api/repositories/github', { owner, repo }),
  syncGithubRuns: (repoId: string) =>
    postJson<GithubRunSyncResult>(`/api/repositories/${repoId}/github-runs/sync`),
  reportClientError: (report: {
    message: string;
    stack?: string;
    componentStack?: string;
    url?: string;
  }) => postJson<{ ok: boolean }>('/api/client-errors', report),
};

const staticApi: typeof liveApi = {
  listRepositories: () => getJson<Repository[]>(`${STATIC_BASE}/repositories.json`),
  getRepository: (repoId) => getJson<Repository>(`${STATIC_BASE}/repositories/${repoId}.json`),
  getOverview: (repoId) =>
    getJson<OverviewResponse>(`${STATIC_BASE}/repositories/${repoId}/overview.json`),
  listWorkflows: (repoId) =>
    getJson<WorkflowDefinition[]>(`${STATIC_BASE}/repositories/${repoId}/workflows.json`),
  getWorkflow: async (repoId, workflowId) => {
    const workflows = await staticApi.listWorkflows(repoId);
    const found = workflows.find((w) => w.id === workflowId);
    if (!found) throw new ApiError(404, 'workflow_not_found');
    return found;
  },
  listAgents: (repoId) =>
    getJson<AgentDefinition[]>(`${STATIC_BASE}/repositories/${repoId}/agents.json`),
  listSkills: (repoId) =>
    getJson<SkillDefinition[]>(`${STATIC_BASE}/repositories/${repoId}/skills.json`),
  listFileHotspots: (repoId) =>
    getJson<FileHotspot[]>(`${STATIC_BASE}/repositories/${repoId}/files.json`),
  listRelationships: (repoId) =>
    getJson<DefinitionRelationship[]>(`${STATIC_BASE}/repositories/${repoId}/relationships.json`),
  getArchitecture: (repoId) =>
    getJson<ArchitectureGraphResponse>(`${STATIC_BASE}/repositories/${repoId}/architecture.json`),
  syncRepository: () => unavailableInDemo('Sync from disk'),
  listRuns: async (repoId, filters) => {
    const runs = await getJson<WorkflowRun[]>(`${STATIC_BASE}/repositories/${repoId}/runs.json`);
    return runs.filter(
      (r) =>
        (!filters?.workflowId || r.workflowDefinitionId === filters.workflowId) &&
        (!filters?.status || r.status === filters.status),
    );
  },
  getRun: (runId) => getJson<WorkflowRun>(`${STATIC_BASE}/runs/${runId}.json`),
  getRunTrace: (runId) => getJson<RunTraceResponse>(`${STATIC_BASE}/runs/${runId}/trace.json`),
  getRunEvents: (runId) => getJson<RunEvent[]>(`${STATIC_BASE}/runs/${runId}/events.json`),
  getRunFiles: (runId) => getJson<FileOperation[]>(`${STATIC_BASE}/runs/${runId}/files.json`),
  getRunAgents: (runId) => getJson<RunAgentsResponse>(`${STATIC_BASE}/runs/${runId}/agents.json`),
  getRunSkills: (runId) => getJson<SkillUsage[]>(`${STATIC_BASE}/runs/${runId}/skills.json`),
  getRunTools: (runId) => getJson<ToolInvocation[]>(`${STATIC_BASE}/runs/${runId}/tools.json`),
  getRunLogs: (runId) => getJson<LogRecord[]>(`${STATIC_BASE}/runs/${runId}/logs.json`),
  getRunGithub: (runId) => getJson<RunGithubResponse>(`${STATIC_BASE}/runs/${runId}/github.json`),
  getRunMetrics: (runId) => getJson<RunMetrics>(`${STATIC_BASE}/runs/${runId}/metrics.json`),
  getRunDrift: (runId) => getJson<DriftFinding[]>(`${STATIC_BASE}/runs/${runId}/drift.json`),
  getMe: async () => ({
    authEnabled: false,
    name: 'demo visitor',
    role: 'viewer' as const,
    kind: 'anonymous' as const,
    repositoryId: null,
  }),
  listTokens: async () => [],
  createToken: () => unavailableInDemo('Token management'),
  revokeToken: () => unavailableInDemo('Token management'),
  connectGithubRepository: () => unavailableInDemo('Connecting a GitHub repository'),
  syncGithubRuns: () => unavailableInDemo('Syncing GitHub Actions runs'),
  reportClientError: async () => ({ ok: true }),
};

export const api = STATIC_DEMO ? staticApi : liveApi;

export { ApiError };
