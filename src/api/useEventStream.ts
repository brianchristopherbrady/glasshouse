// Live SSE connection to /api/stream. Accumulates events in arrival order
// and exposes connection status honestly (no fake "connected" state).
import { useEffect, useRef, useState } from "react";
import type { AgentariumEvent } from "../../shared/events.js";

export interface EventStreamState {
  events: AgentariumEvent[];
  connected: boolean;
  clear: () => void;
}

export function useEventStream(sessionId?: string): EventStreamState {
  const [events, setEvents] = useState<AgentariumEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    const source = new EventSource(`/api/stream${query}`);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as AgentariumEvent;
        setEvents((prev) => [...prev, event]);
      } catch {
        // Malformed message from the stream — ignore rather than crash the UI.
      }
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [sessionId]);

  return {
    events,
    connected,
    clear: () => setEvents([]),
  };
}
