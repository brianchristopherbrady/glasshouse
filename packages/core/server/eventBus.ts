// In-process pub/sub so the SSE layer can broadcast newly-appended events
// to connected browser clients without polling the JSONL files.
import { EventEmitter } from "node:events";
import type { FlowbookEvent } from "../shared/events.js";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function publish(event: FlowbookEvent): void {
  emitter.emit("event", event);
}

export function subscribe(listener: (event: FlowbookEvent) => void): () => void {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
