// Real artifact diff view -- fetches the genuine pre-run fixture content
// and the genuine post-run artifact content from the server
// (GET /api/runner/runs/:runId/artifact-diff/*, backed by
// shared/text-diff.ts's real LCS diff) and renders the actual unified
// hunks with +/- markers. No simulated "N changes" summary without the
// real lines behind it.
import { useQuery } from "@tanstack/react-query";
import { fetchArtifactDiff } from "../api/runnerClient.js";

function hunkClassName(line: string): string {
  if (line.startsWith("+")) return "diff-line added";
  if (line.startsWith("-")) return "diff-line removed";
  return "diff-line unchanged";
}

export function ArtifactDiffPanel({ runId, path, onClose }: { runId: string; path: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["runner", "artifact-diff", runId, path],
    queryFn: () => fetchArtifactDiff(runId, path),
  });

  return (
    <div className="artifact-diff-overlay" role="dialog" aria-label={`Diff for ${path}`}>
      <div className="artifact-diff-panel">
        <div className="artifact-diff-header">
          <span className="artifact-diff-title">{path}</span>
          {data && (
            <span className="artifact-diff-summary">
              +{data.diff.added} -{data.diff.removed}
            </span>
          )}
          <button type="button" className="artifact-diff-close" onClick={onClose}>
            Close
          </button>
        </div>
        {isLoading && <p className="microcopy">Loading diff…</p>}
        {error && <p className="microcopy">{error instanceof Error ? error.message : String(error)}</p>}
        {data && (
          <pre className="artifact-diff-body">
            {data.diff.hunks.map((line, idx) => (
              <div key={idx} className={hunkClassName(line)}>
                {line}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
