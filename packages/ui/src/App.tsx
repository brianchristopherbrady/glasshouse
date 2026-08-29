import { WorkflowView } from "./workflow/WorkflowView.js";

// Flowbook: a Storybook-like explorer/debugger for agentic workflows (see
// plan.md / docs/flowbook-vision.md). The Workflow screen (Explorer +
// Blueprint/Run/Compare + live trace + Inspector) is the entire product
// surface -- there is deliberately no other mode/tab.
export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="app-title">FLOWBOOK</div>
          <div className="app-subtitle">A Storybook for agentic AI</div>
        </div>
      </header>
      <WorkflowView />
    </div>
  );
}
