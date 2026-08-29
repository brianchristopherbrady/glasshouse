// In-process pub/sub for live Run/Span updates, mirroring server/eventBus.ts's
// pattern but scoped to the runner (kept separate from the hook/MCP
// FlowbookEvent stream since Runs are a genuinely different source: this
// package executing a workflow itself, not observing VS Code).
import { EventEmitter } from "node:events";
import type { Run, Span } from "../../shared/flowbook-types.js";

export interface RunUpdate {
  run: Run;
  span?: Span;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function publishRunUpdate(update: RunUpdate): void {
  emitter.emit("run-update", update);
}

export function subscribeToRuns(listener: (update: RunUpdate) => void): () => void {
  emitter.on("run-update", listener);
  return () => emitter.off("run-update", listener);
}
