import type {
  AgentDefinition,
  DriftFinding,
  FileHotspot,
  FileOperation,
  LogRecord,
  OverviewResponse,
  Repository,
  RunAgentsResponse,
  RunEvent,
  RunGithubResponse,
  RunMetrics,
  RunTraceResponse,
  SkillDefinition,
  SkillUsage,
  ToolInvocation,
  WorkflowDefinition,
  WorkflowRun,
} from './types.js';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, `${res.status} ${res.statusText}: ${body}`);
  }
  return (await res.json()) as T;
}

export const api = {
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
  listFileHotspots: (repoId: string) =>
    getJson<FileHotspot[]>(`/api/repositories/${repoId}/files`),
  listRuns: (repoId: string, filters?: { workflowId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.workflowId) params.set('workflowId', filters.workflowId);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return getJson<WorkflowRun[]>(
      `/api/repositories/${repoId}/runs${qs ? `?${qs}` : ''}`,
    );
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
};

export { ApiError };
