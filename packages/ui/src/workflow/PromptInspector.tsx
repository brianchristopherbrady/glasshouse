// Prompt/Instruction resource inspector -- per plan.md: "Every prompt
// must support two views: Template / Resolved... Developers need to see
// the actual model input, not merely the prompt template." The Template
// tab shows the resource's own static `template` field; the Resolved tab
// shows the real substituted text captured on the matching `prompt` span
// at run time (see server/runner/workflows/document-refactor's
// "implementation prompt resolved" span) -- never a re-simulation.
import { useState } from "react";
import Editor from "@monaco-editor/react";
import type { InstructionResource, PromptResource, Run } from "../../../core/shared/flowbook-types.js";

type Tab = "template" | "resolved";

function findResolvedSpanOutput(run: Run | null | undefined, resourceId: string): { template?: string; resolved?: string } | undefined {
  const span = run?.spans.find((s) => s.kind === "prompt" && s.resourceId === resourceId);
  return span?.output as { template?: string; resolved?: string } | undefined;
}

export function PromptInspector({
  resource,
  activeRun,
}: {
  resource: PromptResource | InstructionResource;
  activeRun: Run | null;
}) {
  const isPrompt = resource.kind === "prompt";
  const resolvedOutput = isPrompt ? findResolvedSpanOutput(activeRun, resource.id) : undefined;
  const hasResolved = !!resolvedOutput?.resolved;
  const [tab, setTab] = useState<Tab>("template");

  const shownText = tab === "resolved" && resolvedOutput?.resolved ? resolvedOutput.resolved : resource.template;

  return (
    <div>
      <div className="inspector-field">
        <span className="inspector-label">{resource.kind}</span>
        <span className="inspector-value">{resource.label}</span>
      </div>
      {resource.description && (
        <div className="inspector-field">
          <span className="inspector-label">Description</span>
          <span className="inspector-value">{resource.description}</span>
        </div>
      )}
      {isPrompt && "variables" in resource && resource.variables.length > 0 && (
        <div className="inspector-field">
          <span className="inspector-label">Variables</span>
          <span className="inspector-value">{resource.variables.join(", ")}</span>
        </div>
      )}
      {isPrompt && (
        <div className="prompt-tabs" role="tablist">
          <button
            type="button"
            className={`prompt-tab ${tab === "template" ? "active" : ""}`}
            onClick={() => setTab("template")}
          >
            Template
          </button>
          <button
            type="button"
            className={`prompt-tab ${tab === "resolved" ? "active" : ""}`}
            onClick={() => setTab("resolved")}
            disabled={!hasResolved}
            title={hasResolved ? undefined : "Run this workflow to see the resolved text"}
          >
            Resolved
          </button>
        </div>
      )}
      <div className="prompt-editor">
        <Editor
          height="220px"
          language="markdown"
          theme="vs-dark"
          value={shownText}
          options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, wordWrap: "on" }}
        />
      </div>
      {isPrompt && tab === "resolved" && !hasResolved && (
        <p className="microcopy">No run has resolved this prompt yet.</p>
      )}
    </div>
  );
}
