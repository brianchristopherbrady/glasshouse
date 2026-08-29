// Left-nav resource browser, per plan.md's Explorer spec: every resource
// any registered workflow actually declared, grouped by kind, with fuzzy
// search -- reads GET /api/runner/explorer (a real aggregation over the
// registry, nothing scanned/inferred). Selecting a resource switches the
// Workflow screen to that resource's owning workflow and selects it in the
// Blueprint, so this is real navigation, not a decorative sidebar.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchExplorer, type ExplorerResourceRef } from "../api/runnerClient.js";
import { KIND_META, KIND_ORDER, KIND_PLURAL } from "./resourceIcons.js";
import type { Resource } from "../../../core/shared/flowbook-types.js";

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return true;
  if (t.includes(q)) return true;
  // Subsequence match, e.g. "mdoc" matching "modify-document".
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function Explorer({
  onSelectResource,
  onSelectWorkflow,
}: {
  onSelectResource: (workflowId: string, resourceId: string) => void;
  onSelectWorkflow: (workflowId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["runner", "explorer"], queryFn: fetchExplorer });

  const groups = useMemo(() => {
    if (!data) return [];
    // "workflow"-kind resources are already shown via filteredWorkflows
    // below (with their scenarios nested) -- skip them here to avoid a
    // duplicate "Workflows" section.
    const kinds = KIND_ORDER.filter((k) => k !== "workflow" && (data.resourcesByKind[k]?.length ?? 0) > 0);
    return kinds.map((kind) => ({
      kind,
      resources: (data.resourcesByKind[kind] ?? []).filter(
        (r: ExplorerResourceRef) => fuzzyMatch(query, r.label) || fuzzyMatch(query, r.id),
      ),
    }));
  }, [data, query]);

  const filteredWorkflows = useMemo(() => {
    if (!data) return [];
    return data.workflows.filter((w) => fuzzyMatch(query, w.label) || fuzzyMatch(query, w.id));
  }, [data, query]);

  return (
    <div className="explorer-panel">
      <p className="panel-title">Explorer</p>
      <input
        className="explorer-search"
        type="text"
        placeholder="Search resources…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isLoading && <p className="microcopy">Loading…</p>}
      {!isLoading && data && data.workflows.length === 0 && (
        <p className="microcopy">No workflows registered yet.</p>
      )}
      <div className="explorer-tree">
        {filteredWorkflows.length > 0 && (
          <div className="explorer-group">
            <p className="explorer-group-label">{KIND_PLURAL.workflow}</p>
            {filteredWorkflows.map((w) => (
              <div key={w.id}>
                <button type="button" className="explorer-item" onClick={() => onSelectWorkflow(w.id)}>
                  <span className="explorer-item-icon" style={{ color: KIND_META.workflow.color }}>
                    {KIND_META.workflow.icon}
                  </span>
                  {w.label}
                </button>
                {w.scenarios
                  .filter((s) => query.length === 0 || fuzzyMatch(query, s.label))
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="explorer-item explorer-item-nested"
                      onClick={() => onSelectWorkflow(w.id)}
                    >
                      {s.label}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
        {groups.map(
          ({ kind, resources }) =>
            resources.length > 0 && (
              <div key={kind} className="explorer-group">
                <p className="explorer-group-label">{KIND_PLURAL[kind as Resource["kind"]]}</p>
                {resources.map((r: ExplorerResourceRef) => (
                  <button
                    key={`${r.workflowId}:${r.id}`}
                    type="button"
                    className="explorer-item"
                    onClick={() => onSelectResource(r.workflowId, r.id)}
                  >
                    <span className="explorer-item-icon" style={{ color: KIND_META[kind as Resource["kind"]].color }}>
                      {KIND_META[kind as Resource["kind"]].icon}
                    </span>
                    {r.label}
                  </button>
                ))}
              </div>
            ),
        )}
      </div>
    </div>
  );
}
