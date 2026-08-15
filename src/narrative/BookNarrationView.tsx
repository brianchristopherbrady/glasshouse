// Generic "Book" mode: styled narration for a session, assembled from its
// Storyboard by the event-book Skill per the consuming repo's own
// agentarium.config.json narration style (see shared/narrative-types.ts).
// Distinct from src/book/BookView.tsx, which is this repo's own
// world/<agent>_actions fiction ledger (now surfaced as the "Ledger" tab).
import { useEffect, useState } from "react";
import type { NarrationConfig, NarrativeBook } from "../../shared/narrative-types.js";
import { fetchNarrationConfig, fetchNarrativeBook } from "../api/client.js";

export function BookNarrationView({ sessionId }: { sessionId: string | null }) {
  const [config, setConfig] = useState<NarrationConfig | null>(null);
  const [book, setBook] = useState<NarrativeBook | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNarrationConfig()
      .then(setConfig)
      .catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    setError(null);
    if (!sessionId) {
      setBook(null);
      return;
    }
    fetchNarrativeBook(sessionId)
      .then(setBook)
      .catch((err) => setError(String(err)));
  }, [sessionId]);

  if (!sessionId) {
    return <div className="inspector-empty">No session in view yet -- pick a live, replay, or demo trace first.</div>;
  }
  if (error) {
    return <div className="inspector-empty">Could not load the book: {error}</div>;
  }

  return (
    <div className="panel book-reader" style={{ maxWidth: 760, margin: "0 auto", overflowY: "auto" }}>
      {config && (
        <p className="microcopy" style={{ marginBottom: "1rem" }}>
          Narration style: <strong>{config.style}</strong>
          {config.description ? ` — ${config.description}` : ""}
        </p>
      )}
      {!book ? (
        <p className="microcopy">
          No Book has been generated yet for session {sessionId}. Ask the coding agent to run the
          event-storyboard Skill, then the event-book Skill, against this session.
        </p>
      ) : (
        <>
          <p className="panel-title" style={{ border: "none", margin: 0, padding: 0 }}>
            {book.title}
          </p>
          {book.sections.map((section, i) => (
            <div key={i} className="book-text" style={{ marginTop: i === 0 ? "0.5rem" : "1.5rem" }}>
              {section.heading && <p className="panel-title">{section.heading}</p>}
              <p>{section.text}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
