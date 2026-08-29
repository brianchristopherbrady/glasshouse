// Zustand store for the currently-selected Run: holds the live-updating
// Run record (spans accumulate in real time via the /api/runner/stream SSE
// connection) plus which workflow/scenario is selected in the Workflow
// screen's Controls panel. Kept separate from React Query's server-state
// cache (fetchRun/fetchRuns) since this is genuinely client-side UI state
// (selection + live-stream accumulation), not cached server data.
import { create } from "zustand";
import type { Run } from "../../../core/shared/flowbook-types.js";

interface RunStoreState {
  selectedWorkflowId: string | null;
  selectedScenarioId: string | null;
  activeRun: Run | null;
  selectedSpanId: string | null;
  setSelectedWorkflow: (workflowId: string | null) => void;
  setSelectedScenario: (scenarioId: string | null) => void;
  setSelectedSpan: (spanId: string | null) => void;
  /** Replaces the active run wholesale (e.g. on POST /api/runner/runs'
   * initial response, or when a run is picked from history). Selects a
   * new run outright, but for the SAME run id never regresses progress
   * that SSE has already delivered (see applyRunUpdate) -- a fast
   * workflow can genuinely finish, and its SSE update arrive, before the
   * POST response's own "just started" snapshot resolves. */
  setActiveRun: (run: Run | null) => void;
  /** Merges one live SSE update into the active run, if it's the same run
   * -- ignores updates for a run that isn't currently selected. */
  applyRunUpdate: (run: Run) => void;
}

/** Whether `incoming` genuinely represents earlier progress than `current`
 * for the same run id -- fewer real spans recorded, or a regression from a
 * terminal status back to "running". Used to make run-state updates
 * commutative regardless of arrival order (SSE vs. the POST response). */
function isStale(current: Run, incoming: Run): boolean {
  if (current.id !== incoming.id) return false;
  if (current.status !== "running" && incoming.status === "running") return true;
  return incoming.spans.length < current.spans.length;
}

export const useRunStore = create<RunStoreState>((set, get) => ({
  selectedWorkflowId: null,
  selectedScenarioId: null,
  activeRun: null,
  selectedSpanId: null,
  setSelectedWorkflow: (workflowId) => set({ selectedWorkflowId: workflowId, selectedScenarioId: null }),
  setSelectedScenario: (scenarioId) => set({ selectedScenarioId: scenarioId }),
  setSelectedSpan: (spanId) => set({ selectedSpanId: spanId }),
  setActiveRun: (run) => {
    const current = get().activeRun;
    if (run && current && isStale(current, run)) return;
    set({ activeRun: run, selectedSpanId: null });
  },
  applyRunUpdate: (run) => {
    const current = get().activeRun;
    if (current && current.id !== run.id) return;
    if (current && isStale(current, run)) return;
    set({ activeRun: run });
  },
}));
