// Type declarations for scripts/hook-pipeline.mjs (plain JS, deliberately
// dependency-free -- see that file's header for why). This lets tests
// import it under `strict`/`noImplicitAny` without every call site
// collapsing to `any`. Kept intentionally loose (not importing
// GlasshouseEvent from shared/events.ts) since this module has no runtime
// dependency on that package and must stay that way.

export interface HookAgentFrame {
  id: string;
  name: string | null;
  eventId: string;
  parentEventId: string | null;
}

export interface HookState {
  sessionId: string;
  updatedAt: string;
  turnSeq: number;
  currentTurnId: string | null;
  agentStack: HookAgentFrame[];
  runId: string | null;
  runLabel: string | null;
}

export interface NormalizedHookEvent {
  hookName: string;
  timestamp: string;
  prompt?: string;
  toolName?: string;
  toolCallId?: string;
  toolInput?: unknown;
  toolResponse?: unknown;
  agentType?: string;
  agentId?: string;
  stopHookActive?: boolean;
  trigger?: string;
  source?: string;
}

export interface ToolOutcome {
  failed: boolean;
  reason?: string;
}

export interface FileToolClassification {
  type: "file.read" | "file.written" | "file.searched";
  path?: string;
}

export interface HookEventActor {
  id: string;
  kind: string;
  name?: string;
}

export interface HookEventPartial {
  id?: string;
  sessionId: string;
  timestamp: string;
  type: string;
  source: string;
  evidence: string;
  label: string;
  actor?: HookEventActor;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface BuildEventsResult {
  events: HookEventPartial[];
  nextState: HookState;
}

export const REDACTED: string;

export function redactString(value: string): string;
export function redact(value: unknown, keyHint?: string): unknown;
export function sanitizeSessionId(id: string): string;
export function createInitialState(sessionId: string): HookState;
export function loadState(): Promise<HookState | null>;
export function saveState(state: HookState): Promise<void>;
export function resolveSessionAndState(
  input: Record<string, unknown>,
): Promise<{ sessionId: string; state: HookState }>;
export function classifyFileTool(toolName?: string, toolInput?: unknown): FileToolClassification | null;
export function detectToolOutcome(toolResponse: unknown): ToolOutcome;
export function normalizeHookEvent(hookName: string, input: Record<string, unknown>): NormalizedHookEvent;
export function buildEventsForHook(
  hookName: string,
  input: Record<string, unknown>,
  sessionId: string,
  state: HookState,
  timestamp?: string,
): BuildEventsResult;
export function finalizeEvent(partial: HookEventPartial): HookEventPartial & { id: string };
export function buildHookBracketEvent(
  type: "hook.started" | "hook.completed",
  hookName: string,
  sessionId: string,
  timestamp: string,
): HookEventPartial & { id: string };
export function appendEvents(events: HookEventPartial[]): Promise<void>;
export function postToCollector(events: HookEventPartial[]): Promise<void>;
export function processHookInput(input: Record<string, unknown>): Promise<{
  hookName: string;
  events: HookEventPartial[];
  nextState: HookState;
}>;
