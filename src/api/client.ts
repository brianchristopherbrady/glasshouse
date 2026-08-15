// Thin REST client for the AGENTARIUM collector API. All requests are
// same-origin in dev (vite proxies /api to the collector server).
import type { AgentariumEvent } from "../../shared/events.js";
import type { SessionMetrics } from "../../shared/metrics.js";
import type { WorldData } from "../../shared/world-types.js";
import type { ValidationResult } from "../../shared/world-validator.js";
import type { NarrationConfig, NarrativeBook, Storyboard } from "../../shared/narrative-types.js";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchCurrentSession(): Promise<string | null> {
  const data = await getJson<{ sessionId: string | null }>("/api/current-session");
  return data.sessionId;
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

export async function fetchSessionEvents(sessionId: string, upTo?: string): Promise<AgentariumEvent[]> {
  const query = upTo ? `?upTo=${encodeURIComponent(upTo)}` : "";
  const data = await getJson<{ events: AgentariumEvent[] }>(`/api/sessions/${encodeURIComponent(sessionId)}/events${query}`);
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

export async function fetchDemoEvents(name: string): Promise<AgentariumEvent[]> {
  const data = await getJson<{ events: AgentariumEvent[] }>(`/api/demo/${encodeURIComponent(name)}/events`);
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

export interface WorldResponse {
  world: WorldData;
  validation: ValidationResult;
}

/** The actual, currently-on-disk Float world — same data Asterion Dev
 * edits and the validator checks. Not client-side state, so it persists
 * across page loads and reflects real changes as they're made. */
export async function fetchWorld(): Promise<WorldResponse> {
  return getJson<WorldResponse>("/api/world");
}

// --- Generic narrative layer (Storyboard / Book) --------------------------
// See shared/narrative-types.ts.

export async function fetchNarrationConfig(): Promise<NarrationConfig> {
  const data = await getJson<{ config: NarrationConfig }>("/api/narrative/config");
  return data.config;
}

export async function fetchStoryboard(sessionId: string): Promise<Storyboard | null> {
  const data = await getJson<{ storyboard: Storyboard | null }>(
    `/api/narrative/${encodeURIComponent(sessionId)}/storyboard`,
  );
  return data.storyboard;
}

export async function fetchNarrativeBook(sessionId: string): Promise<NarrativeBook | null> {
  const data = await getJson<{ book: NarrativeBook | null }>(
    `/api/narrative/${encodeURIComponent(sessionId)}/book`,
  );
  return data.book;
}
