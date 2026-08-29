// Thin REST client for the flowbook collector API. All requests are
// same-origin in dev (vite proxies /api to the collector server).
import type { FlowbookEvent } from "../../../core/shared/events.js";
import type { SessionMetrics } from "../../../core/shared/metrics.js";
import type { Storyboard } from "../../../core/shared/narrative-types.js";
import type { WorkspaceGraph, WorkspaceTouch } from "../../../core/shared/workspace-types.js";
import type { WorkspaceLink } from "../../../core/shared/workspace-activity.js";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchCurrentSession(): Promise<string | null> {
  const data = await getJson<{ sessionId: string | null }>("/api/current-session");
  return data.sessionId;
}

export interface CurrentRun {
  runId: string;
  runLabel?: string;
}

/** The currently-declared run within the current session, if any -- see
 * mcp/tools/startRun.ts / shared/runs.ts. Null if no run has been declared
 * since the session started. */
export async function fetchCurrentRun(): Promise<CurrentRun | null> {
  const data = await getJson<{ run: CurrentRun | null }>("/api/current-run");
  return data.run;
}

export interface SessionSummary {
  id: string;
  label?: string;
  saved: boolean;
  savedAt?: string;
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const data = await getJson<{ sessions: SessionSummary[] }>("/api/sessions");
  return data.sessions;
}

/** Sets a friendly label and/or a "saved" flag on a session. Every session
 * already persists forever as JSONL regardless of this call -- "saved" only
 * marks intent so Replay/Compare can surface runs worth keeping. */
export async function updateSession(
  sessionId: string,
  patch: { label?: string; saved?: boolean },
): Promise<SessionSummary> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH /api/sessions/${sessionId} failed: ${res.status}`);
  const data = (await res.json()) as { session: SessionSummary };
  return data.session;
}

export async function fetchSessionEvents(sessionId: string, upTo?: string): Promise<FlowbookEvent[]> {
  const query = upTo ? `?upTo=${encodeURIComponent(upTo)}` : "";
  const data = await getJson<{ events: FlowbookEvent[] }>(`/api/sessions/${encodeURIComponent(sessionId)}/events${query}`);
  return data.events;
}

export async function fetchSessionMetrics(sessionId: string): Promise<SessionMetrics> {
  const data = await getJson<{ metrics: SessionMetrics }>(`/api/sessions/${encodeURIComponent(sessionId)}/metrics`);
  return data.metrics;
}

export async function fetchDemoTraces(): Promise<string[]> {
  const data = await getJson<{ traces: string[] }>("/api/demo");
  return data.traces;
}

export async function fetchDemoEvents(name: string): Promise<FlowbookEvent[]> {
  const data = await getJson<{ events: FlowbookEvent[] }>(`/api/demo/${encodeURIComponent(name)}/events`);
  return data.events;
}

export interface RepoAgent {
  file: string;
  name: string;
  description?: string;
}

export interface RepoSkill {
  dir: string;
  name: string;
  description?: string;
}

export interface RepoPrompt {
  file: string;
  name: string;
  description?: string;
}

export async function fetchRepoAgents(): Promise<RepoAgent[]> {
  const data = await getJson<{ agents: RepoAgent[] }>("/api/repo/agents");
  return data.agents;
}

export async function fetchRepoSkills(): Promise<RepoSkill[]> {
  const data = await getJson<{ skills: RepoSkill[] }>("/api/repo/skills");
  return data.skills;
}

export async function fetchRepoPrompts(): Promise<RepoPrompt[]> {
  const data = await getJson<{ prompts: RepoPrompt[] }>("/api/repo/prompts");
  return data.prompts;
}

// --- Generic narrative layer (Storyboard) ---------------------------------
// See shared/narrative-types.ts.

export async function fetchStoryboard(sessionId: string): Promise<Storyboard | null> {
  const data = await getJson<{ storyboard: Storyboard | null }>(
    `/api/narrative/${encodeURIComponent(sessionId)}/storyboard`,
  );
  return data.storyboard;
}

// --- Workspace Map ---------------------------------------------------------
// See shared/workspace-types.ts / shared/workspace-activity.ts.

/** The real, mechanically discovered package/workspace graph for the repo
 * currently being watched -- read live off disk, not client-side state. */
export async function fetchWorkspaceGraph(): Promise<WorkspaceGraph> {
  const data = await getJson<{ graph: WorkspaceGraph }>("/api/workspaces");
  return data.graph;
}

export interface WorkspaceActivity {
  touches: WorkspaceTouch[];
  links: WorkspaceLink[];
}

/** Which real workspace packages a session's events touched, and any
 * agent-declared causal links between packages during that session. */
export async function fetchWorkspaceActivity(sessionId: string): Promise<WorkspaceActivity> {
  return getJson<WorkspaceActivity>(`/api/workspaces/sessions/${encodeURIComponent(sessionId)}/activity`);
}
