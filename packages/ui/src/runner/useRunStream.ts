// Subscribes to /api/runner/stream (real Span updates from server/runner/)
// and feeds them into the Zustand run store as they genuinely happen --
// same live-without-refresh requirement as the existing hook-observation
// stream (src/api/useEventStream.ts), for the orchestrator's own runs.
import { useEffect } from "react";
import { useRunStore } from "./runStore.js";
import type { Run } from "../../../core/shared/flowbook-types.js";

export function useRunStream(): void {
  const applyRunUpdate = useRunStore((s) => s.applyRunUpdate);

  useEffect(() => {
    const source = new EventSource("/api/runner/stream");
    source.onmessage = (message) => {
      try {
        const update = JSON.parse(message.data) as { run: Run };
        applyRunUpdate(update.run);
      } catch {
        // Malformed message -- ignore rather than crash the UI.
      }
    };
    return () => source.close();
  }, [applyRunUpdate]);
}
