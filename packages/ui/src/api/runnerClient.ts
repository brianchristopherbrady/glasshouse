// Thin REST client for Flowbook's real orchestrator API (/api/runner/*).
// Kept separate from api/client.ts's older FlowbookEvent-observation client
// -- this is a genuinely different source (workflows this app executes
// itself, not an observed VS Code session).
import type { Blueprint, Run, Scenario } from "../../../core/shared/flowbook-types.js";
import type { RunComparison } from "../../../core/shared/compare-runs.js";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

export interface WorkflowSummary {
  id: string;
  label: string;
}

export async function fetchWorkflows(): Promise<WorkflowSummary[]> {
  const data = await getJson<{ workflows: WorkflowSummary[] }>("/api/runner/workflows");
  return data.workflows;
}

export async function fetchBlueprint(workflowId: string): Promise<Blueprint> {
  const data = await getJson<{ blueprint: Blueprint }>(`/api/runner/workflows/${encodeURIComponent(workflowId)}/blueprint`);
  return data.blueprint;
}

export async function fetchScenarios(workflowId: string): Promise<Scenario[]> {
  const data = await getJson<{ scenarios: Scenario[] }>(`/api/runner/workflows/${encodeURIComponent(workflowId)}/scenarios`);
  return data.scenarios;
}

export async function startRun(opts: { workflowId: string; scenarioId?: string; input?: Record<string, unknown> }): Promise<Run> {
  const res = await fetch("/api/runner/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `POST /api/runner/runs failed: ${res.status}`);
  }
  const data = (await res.json()) as { run: Run };
  return data.run;
}

export async function fetchRuns(): Promise<Run[]> {
  const data = await getJson<{ runs: Run[] }>("/api/runner/runs");
  return data.runs;
}

export async function fetchRun(runId: string): Promise<Run> {
  const data = await getJson<{ run: Run }>(`/api/runner/runs/${encodeURIComponent(runId)}`);
  return data.run;
}

export async function fetchRunArtifact(runId: string, relativePath: string): Promise<string> {
  const data = await getJson<{ content: string }>(
    `/api/runner/runs/${encodeURIComponent(runId)}/artifacts/${relativePath}`,
  );
  return data.content;
}
export interface ArtifactDiffResult {
  before: string;
  after: string;
  diff: { added: number; removed: number; hunks: string[] };
}

export async function fetchArtifactDiff(runId: string, relativePath: string): Promise<ArtifactDiffResult> {
  return getJson<ArtifactDiffResult>(`/api/runner/runs/${encodeURIComponent(runId)}/artifact-diff/${relativePath}`);
}

export interface ExplorerResourceRef {
  id: string;
  label: string;
  workflowId: string;
}

export interface ExplorerData {
  workflows: { id: string; label: string; scenarios: { id: string; label: string }[] }[];
  resourcesByKind: Partial<Record<string, ExplorerResourceRef[]>>;
  recentRuns: { id: string; workflowId: string; status: string; startedAt: string }[];
}

export async function fetchExplorer(): Promise<ExplorerData> {
  return getJson<ExplorerData>("/api/runner/explorer");
}

export async function fetchRunComparison(runIdA: string, runIdB: string): Promise<RunComparison> {
  const data = await getJson<{ comparison: RunComparison }>(
    `/api/runner/compare?a=${encodeURIComponent(runIdA)}&b=${encodeURIComponent(runIdB)}`,
  );
  return data.comparison;
}