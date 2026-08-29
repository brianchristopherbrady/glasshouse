// Live SSE connection to /api/stream. Accumulates events in arrival order
// and exposes connection status honestly (no fake "connected" state).
//
// SSE only delivers events emitted AFTER the browser connects -- it is not
// a backlog. Without first backfilling whatever already happened this
// session (opening the dashboard mid-session, or a page refresh), Live
// mode would only show events from the moment of connection onward, and a
// refresh would silently drop everything before it. So on mount (and
// whenever the effective session changes), this hook fetches the current/
// target session's full JSONL history via the same REST path Replay uses,
// seeds `events` with it, then layers the live stream on top -- deduping
// by id in case an event arrives via both backfill and a racing stream
// message.
import { useEffect, useRef, useState } from "react";
import type { FlowbookEvent } from "../../../core/shared/events.js";
import { fetchCurrentSession, fetchSessionEvents } from "./client.js";

export interface EventStreamState {
  events: FlowbookEvent[];
  connected: boolean;
  clear: () => void;
}

export function useEventStream(sessionId?: string): EventStreamState {
  const [events, setEvents] = useState<FlowbookEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  function addEvents(incoming: FlowbookEvent[]) {
    const fresh = incoming.filter((e) => !seenIds.current.has(e.id));
    if (fresh.length === 0) return;
    for (const e of fresh) seenIds.current.add(e.id);
    setEvents((prev) => [...prev, ...fresh]);
  }

  useEffect(() => {
    let cancelled = false;
    seenIds.current = new Set();
    setEvents([]);

    (async () => {
      // Backfill: whatever this session (explicit, or whichever the
      // collector currently considers "current") already has on disk.
      const backfillSessionId = sessionId ?? (await fetchCurrentSession().catch(() => null));
      if (cancelled || !backfillSessionId) return;
      const history = await fetchSessionEvents(backfillSessionId).catch(() => []);
      if (!cancelled) addEvents(history);
    })();

    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    const source = new EventSource(`/api/stream${query}`);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as FlowbookEvent;
        addEvents([event]);
      } catch {
        // Malformed message from the stream — ignore rather than crash the UI.
      }
    };

    return () => {
      cancelled = true;
      source.close();
      sourceRef.current = null;
    };
  }, [sessionId]);

  return {
    events,
    connected,
    clear: () => {
      seenIds.current = new Set();
      setEvents([]);
    },
  };
}
