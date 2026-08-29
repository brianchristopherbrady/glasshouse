// First-class handoff inspector -- per plan.md's "Agent handoffs must be
// first-class objects" requirement. Renders a real included/excluded
// context checklist from the handoff span's own `contextTransferred`
// output (see server/runner/workflows/document-refactor's handoff span) --
// never invents context items the workflow didn't actually report.
import type { Span } from "../../../core/shared/flowbook-types.js";

// The full universe of context items a handoff COULD carry -- used only to
// compute which ones were excluded (i.e. present here but absent from the
// span's own real `contextTransferred` list). Never presented as if the
// workflow declared these as possibilities; it's purely a display aid so
// "excluded" items are shown, not just omitted silently.
const KNOWN_CONTEXT_ITEMS = [
  "document",
  "accessibilityCheckResult",
  "originalRequest",
  "implementationSummary",
  "testResults",
  "conversationContext",
];

function labelFor(item: string): string {
  return item.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export function HandoffInspector({ span }: { span: Span }) {
  const output = span.output as { contextTransferred?: unknown } | undefined;
  const transferred = Array.isArray(output?.contextTransferred)
    ? output.contextTransferred.filter((x): x is string => typeof x === "string")
    : [];
  const excluded = KNOWN_CONTEXT_ITEMS.filter((item) => !transferred.includes(item));

  return (
    <div>
      <div className="inspector-field">
        <span className="inspector-label">Handoff</span>
        <span className="inspector-value">{span.label}</span>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">Status</span>
        <span className="inspector-value">{span.status}</span>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">Context transferred</span>
        {transferred.length === 0 ? (
          <p className="microcopy">No context items were reported as transferred.</p>
        ) : (
          <ul className="handoff-context-list">
            {transferred.map((item) => (
              <li key={item} className="handoff-context-item included">
                <span className="handoff-context-mark">✓</span> {labelFor(item)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {excluded.length > 0 && (
        <div className="inspector-field">
          <span className="inspector-label">Not transferred</span>
          <ul className="handoff-context-list">
            {excluded.map((item) => (
              <li key={item} className="handoff-context-item excluded">
                <span className="handoff-context-mark">○</span> {labelFor(item)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
