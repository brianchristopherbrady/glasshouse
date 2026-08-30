// The Workflow screen: Blueprint / Run / Compare modes over a real,
// executable workflow -- Controls panel (workflow+scenario picker, ▶ Run),
// the Blueprint/Run graph, a chronological Span timeline, and an Inspector
// for the selected resource/span. Per docs/flowbook-vision.md's "The
// Homepage Should Not Be a Dashboard" -- this is the default landing view.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBlueprint,
  fetchScenarios,
  fetchWorkflows,
  startRun as startRunRequest,
} from "../api/runnerClient.js";
import { useRunStore } from "../runner/runStore.js";
import { useRunStream } from "../runner/useRunStream.js";
import { ArtifactDiffPanel } from "./ArtifactDiffPanel.js";
import { BlueprintGraph } from "./BlueprintGraph.js";
import { ComparePanel } from "./ComparePanel.js";
import { Explorer } from "./Explorer.js";
import { HandoffInspector } from "./HandoffInspector.js";
import { PromptInspector } from "./PromptInspector.js";
import { SequenceView } from "./SequenceView.js";
import { WaterfallView } from "./WaterfallView.js";
import type { Span } from "../../../core/shared/flowbook-types.js";

type WorkflowMode = "blueprint" | "run" | "compare";
type RunViewMode = "map" | "sequence" | "waterfall";

function formatDuration(span: Span): string {
  if (!span.endTime) return "running…";
  return `${((span.endTime - span.startTime) / 1000).toFixed(2)}s`;
}

export function WorkflowView() {
  useRunStream();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<WorkflowMode>("blueprint");

  const selectedWorkflowId = useRunStore((s) => s.selectedWorkflowId);
  const selectedScenarioId = useRunStore((s) => s.selectedScenarioId);
  const activeRun = useRunStore((s) => s.activeRun);
  const selectedSpanId = useRunStore((s) => s.selectedSpanId);
  const setSelectedWorkflow = useRunStore((s) => s.setSelectedWorkflow);
  const setSelectedScenario = useRunStore((s) => s.setSelectedScenario);
  const setSelectedSpan = useRunStore((s) => s.setSelectedSpan);
  const setActiveRun = useRunStore((s) => s.setActiveRun);

  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [diffPath, setDiffPath] = useState<string | null>(null);
  const [inputText, setInputText] = useState("{}");
  const [inputError, setInputError] = useState<string | null>(null);
  const [runViewMode, setRunViewMode] = useState<RunViewMode>("map");

  const { data: workflows } = useQuery({ queryKey: ["runner", "workflows"], queryFn: fetchWorkflows });

  useEffect(() => {
    if (!selectedWorkflowId && workflows && workflows.length > 0) {
      setSelectedWorkflow(workflows[0]!.id);
    }
  }, [workflows, selectedWorkflowId, setSelectedWorkflow]);

  const { data: blueprint } = useQuery({
    queryKey: ["runner", "blueprint", selectedWorkflowId],
    queryFn: () => fetchBlueprint(selectedWorkflowId!),
    enabled: !!selectedWorkflowId,
  });

  const { data: scenarios } = useQuery({
    queryKey: ["runner", "scenarios", selectedWorkflowId],
    queryFn: () => fetchScenarios(selectedWorkflowId!),
    enabled: !!selectedWorkflowId,
  });

  const selectedScenario = scenarios?.find((s) => s.id === selectedScenarioId);

  // Re-seed the editable input form whenever the selected scenario changes
  // -- always from the scenario's own real `input`, never an invented
  // default, so "Reset" always has something genuine to revert to.
  useEffect(() => {
    setInputText(JSON.stringify(selectedScenario?.input ?? {}, null, 2));
    setInputError(null);
  }, [selectedScenario]);

  function resetInput() {
    setInputText(JSON.stringify(selectedScenario?.input ?? {}, null, 2));
    setInputError(null);
  }

  async function handleRun() {
    if (!selectedWorkflowId) return;
    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(inputText);
    } catch (err) {
      setInputError(err instanceof Error ? err.message : String(err));
      return;
    }
    setInputError(null);
    setStarting(true);
    setStartError(null);
    try {
      const run = await startRunRequest({
        workflowId: selectedWorkflowId,
        scenarioId: selectedScenarioId ?? undefined,
        input: parsedInput,
      });
      setActiveRun(run);
      setMode("run");
      queryClient.invalidateQueries({ queryKey: ["runner", "runs"] });
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }
  const selectedResource = blueprint?.resources.find((r) => r.id === selectedResourceId);
  const selectedSpan = activeRun?.spans.find((s) => s.id === selectedSpanId);

  return (
    <div className="workflow-layout">
      <div className="workflow-sidebar">
        <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <Explorer
            onSelectWorkflow={(workflowId) => {
              setSelectedWorkflow(workflowId);
              setMode("blueprint");
            }}
            onSelectResource={(workflowId, resourceId) => {
              setSelectedWorkflow(workflowId);
              setSelectedResourceId(resourceId);
              setSelectedSpan(null);
              setMode("blueprint");
            }}
          />
        </div>
        <div className="panel workflow-controls">
        <p className="panel-title">Controls</p>

        <div className="inspector-field">
          <span className="inspector-label">Workflow</span>
          <select
            value={selectedWorkflowId ?? ""}
            onChange={(e) => setSelectedWorkflow(e.target.value || null)}
            style={{ width: "100%" }}
          >
            {(workflows ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        <div className="inspector-field">
          <span className="inspector-label">Scenario</span>
          <select
            value={selectedScenarioId ?? ""}
            onChange={(e) => setSelectedScenario(e.target.value || null)}
            style={{ width: "100%" }}
          >
            <option value="">(default input)</option>
            {(scenarios ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {selectedScenario?.description && <p className="microcopy">{selectedScenario.description}</p>}

        <div className="inspector-field">
          <span className="inspector-label">Input (editable)</span>
          <textarea
            className="scenario-input-editor"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setInputError(null);
            }}
            spellCheck={false}
            rows={6}
          />
          {inputError && <p className="microcopy" style={{ color: "var(--red)" }}>{inputError}</p>}
          <button type="button" className="prompt-tab" onClick={resetInput} style={{ marginTop: "0.4rem" }}>
            Reset
          </button>
        </div>

        <button className="workflow-run-button" onClick={handleRun} disabled={starting || !selectedWorkflowId}>
          {starting ? "Starting…" : "▶ Run with changes"}
        </button>
        {startError && <p className="microcopy" style={{ color: "var(--red)" }}>{startError}</p>}

        <div className="workflow-mode-tabs" style={{ marginTop: "1.25rem" }}>
          {(["blueprint", "run", "compare"] as WorkflowMode[]).map((m) => (
            <button key={m} className={`workflow-mode-tab${mode === m ? " active" : ""}`} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>

        {mode === "run" && (
          <div className="workflow-mode-tabs" style={{ marginTop: "0.5rem" }}>
            {(["map", "sequence", "waterfall"] as RunViewMode[]).map((m) => (
              <button key={m} className={`workflow-mode-tab${runViewMode === m ? " active" : ""}`} onClick={() => setRunViewMode(m)}>
                {m}
              </button>
            ))}
          </div>
        )}
        </div>
      </div>

      <div className="workflow-canvas">
        {mode === "compare" ? (
          <ComparePanel workflowId={selectedWorkflowId} />
        ) : mode === "run" && activeRun && runViewMode === "sequence" ? (
          <SequenceView run={activeRun} />
        ) : mode === "run" && activeRun && runViewMode === "waterfall" ? (
          <WaterfallView run={activeRun} />
        ) : blueprint ? (
          <BlueprintGraph
            resources={blueprint.resources}
            relationships={blueprint.relationships}
            run={mode === "run" ? activeRun : null}
            selectedId={selectedResourceId}
            onSelect={(id) => {
              setSelectedResourceId(id);
              setSelectedSpan(null);
            }}
          />
        ) : (
          <div className="inspector-empty">Select a workflow to see its Blueprint.</div>
        )}
      </div>

      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="workflow-timeline" style={{ flex: 1 }}>
          <p className="panel-title">Trace</p>
          {!activeRun ? (
            <p className="microcopy">No run yet -- press ▶ Run to execute this workflow.</p>
          ) : (
            <>
              <p className="microcopy">
                Run {activeRun.id.slice(0, 8)} · <span className={`blueprint-node-status status-${activeRun.status}`}>{activeRun.status}</span>
              </p>
              {activeRun.spans.map((span) => (
                <div
                  key={span.id}
                  className={`workflow-timeline-row${span.id === selectedSpanId ? " selected" : ""}`}
                  onClick={() => {
                    setSelectedSpan(span.id);
                    setSelectedResourceId(null);
                  }}
                >
                  <span className="workflow-timeline-time">
                    {formatDuration(span)} · {span.kind}
                  </span>
                  <span>{span.label}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div>
          <p className="panel-title">Inspector</p>
          {selectedSpan ? (
            <div>
              <div className="inspector-field">
                <span className="inspector-label">Span</span>
                <span className="inspector-value">{selectedSpan.label}</span>
              </div>
              <div className="inspector-field">
                <span className="inspector-label">Status</span>
                <span className="inspector-value">{selectedSpan.status}</span>
              </div>
              {selectedSpan.kind === "handoff" ? (
                <HandoffInspector span={selectedSpan} />
              ) : (
                <>
                  {selectedSpan.input !== undefined && (
                    <div className="inspector-field">
                      <span className="inspector-label">Input</span>
                      <pre className="raw-json">{JSON.stringify(selectedSpan.input, null, 2)}</pre>
                    </div>
                  )}
                  {selectedSpan.output !== undefined && (
                    <div className="inspector-field">
                      <span className="inspector-label">Output</span>
                      <pre className="raw-json">{JSON.stringify(selectedSpan.output, null, 2)}</pre>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : selectedResource ? (
            selectedResource.kind === "prompt" || selectedResource.kind === "instruction" ? (
              <PromptInspector resource={selectedResource} activeRun={activeRun ?? null} />
            ) : (
              <div>
                <div className="inspector-field">
                  <span className="inspector-label">{selectedResource.kind}</span>
                  <span className="inspector-value">{selectedResource.label}</span>
                </div>
                {"description" in selectedResource && selectedResource.description && (
                  <div className="inspector-field">
                    <span className="inspector-label">Description</span>
                    <span className="inspector-value">{selectedResource.description}</span>
                  </div>
                )}
                {selectedResource.kind === "agent" && (
                  <>
                    <div className="inspector-field">
                      <span className="inspector-label">Skills</span>
                      <span className="inspector-value">{selectedResource.skills.join(", ") || "none"}</span>
                    </div>
                    <div className="inspector-field">
                      <span className="inspector-label">Hands off to</span>
                      <span className="inspector-value">{selectedResource.handoffs.join(", ") || "none"}</span>
                    </div>
                  </>
                )}
                {selectedResource.kind === "artifact" && activeRun && (
                  <button type="button" className="prompt-tab" onClick={() => setDiffPath(selectedResource.path)}>
                    View Diff
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="inspector-empty">Click a node or a trace row to see its details.</div>
          )}
        </div>
      </div>
      {diffPath && activeRun && (
        <ArtifactDiffPanel runId={activeRun.id} path={diffPath} onClose={() => setDiffPath(null)} />
      )}
    </div>
  );
}
