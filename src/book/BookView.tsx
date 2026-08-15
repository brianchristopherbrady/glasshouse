// "Book" mode: reads world/<agent>_actions/*.md as an interactive story --
// pick a character, follow their entries in chapter.thread.entry order, and
// jump sideways to any other character/source that recorded the same beat
// (per the dispatch/downstream Skills' shared locator numbering). Also
// surfaces assembled chapters from world/chapters/chapter-<N>.md (produced
// by the writer Skill from world/storyboard.json, per
// .github/skills/writer/SKILL.md) as a separate, selectable read mode.
// Nothing here is generated client-side -- every word shown is a verbatim
// excerpt from on-disk files, fetched via /api/book (shared/book-loader.ts).
import { useEffect, useMemo, useState } from "react";
import { fetchBook } from "../api/client.js";
import type { BookData, BookEntry, StoryboardBeat } from "../../shared/book-types.js";

type Selection = { kind: "character"; id: string } | { kind: "chapter"; number: number };

function entryKey(e: BookEntry): string {
  return `${e.agentId}:${e.source}:${e.locator}`;
}

/** Toggleable "behind the scenes" view of the storyboard Skill's own panel
 * description(s) for the currently-open locator -- who's involved, whether
 * Bloomrot is legitimately in view yet, and what the description is
 * actually grounded in (see .github/skills/storyboard/SKILL.md). Collapsed
 * by default so it reads as an optional inspector, not part of the prose. */
function StoryboardPanel({ beats, characters }: { beats: StoryboardBeat[]; characters: BookData["characters"] }) {
  const [open, setOpen] = useState(false);

  if (beats.length === 0) return null;

  return (
    <div className="book-storyboard">
      <button className="book-storyboard-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide" : "Show"} storyboard notes ({beats.length})
      </button>
      {open &&
        beats.map((beat, i) => {
          const involvedNames = beat.involves.map(
            (id) => characters.find((c) => c.id === id)?.displayName ?? id
          );
          return (
            <div key={`${beat.agentId}:${beat.source}:${i}`}>
              <p className="book-storyboard-desc">{beat.description}</p>
              <div className="book-storyboard-flags">
                <span className="book-storyboard-flag">involves: {involvedNames.join(", ") || "none listed"}</span>
                <span className={`book-storyboard-flag${beat.bloomrotAware ? " bloomrot-aware" : ""}`}>
                  {beat.bloomrotAware ? "Bloomrot-aware" : "not Bloomrot-aware"}
                </span>
              </div>
              {beat.citedSources.length > 0 && (
                <ul className="book-storyboard-citations">
                  {beat.citedSources.map((src) => (
                    <li key={src}>{src}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
    </div>
  );
}

export function BookView() {
  const [book, setBook] = useState<BookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<BookEntry | null>(null);
  const [selectedBeatIndex, setSelectedBeatIndex] = useState(0);

  useEffect(() => {
    fetchBook()
      .then((data) => {
        setBook(data);
        if (data.chapters.length > 0) {
          setSelection({ kind: "chapter", number: data.chapters[0]!.number });
          setSelectedBeatIndex(0);
          return;
        }
        const first = data.characters.find((c) => c.entries.length > 0);
        if (first) {
          setSelection({ kind: "character", id: first.id });
          setSelectedEntry(first.entries[0] ?? null);
        }
      })
      .catch((err) => setError(String(err)));
  }, []);

  const character = useMemo(
    () => (selection?.kind === "character" ? book?.characters.find((c) => c.id === selection.id) ?? null : null),
    [book, selection]
  );

  const chapter = useMemo(
    () => (selection?.kind === "chapter" ? book?.chapters.find((c) => c.number === selection.number) ?? null : null),
    [book, selection]
  );

  const otherPerspectives = useMemo(() => {
    if (!book || !selectedEntry) return [];
    const siblings = book.byLocator[selectedEntry.locator] ?? [];
    return siblings.filter((e) => entryKey(e) !== entryKey(selectedEntry));
  }, [book, selectedEntry]);

  function selectCharacter(id: string) {
    setSelection({ kind: "character", id });
    const next = book?.characters.find((c) => c.id === id);
    setSelectedEntry(next?.entries[0] ?? null);
  }

  function selectChapter(number: number) {
    setSelection({ kind: "chapter", number });
    setSelectedBeatIndex(0);
  }

  function jumpTo(entry: BookEntry) {
    setSelection({ kind: "character", id: entry.agentId });
    setSelectedEntry(entry);
  }

  if (error) {
    return <div className="inspector-empty">Could not load the book: {error}</div>;
  }

  if (!book) {
    return <div className="inspector-empty">Opening the book…</div>;
  }

  const entryIndex = character && selectedEntry ? character.entries.findIndex((e) => entryKey(e) === entryKey(selectedEntry)) : -1;
  const currentBeat = chapter?.beats[selectedBeatIndex] ?? null;

  return (
    <div className="book-layout">
      <div className="panel book-characters">
        {book.chapters.length > 0 && (
          <>
            <p className="panel-title">Read a chapter</p>
            {book.chapters.map((c) => (
              <div
                key={c.number}
                className={`session-item${selection?.kind === "chapter" && selection.number === c.number ? " active" : ""}`}
                onClick={() => selectChapter(c.number)}
              >
                {c.title}
                <span className="book-entry-count"> ({c.beats.length})</span>
              </div>
            ))}
          </>
        )}

        <p className="panel-title" style={{ marginTop: book.chapters.length > 0 ? "1rem" : 0 }}>
          Follow a character
        </p>
        {book.characters.map((c) => (
          <div
            key={c.id}
            className={`session-item${selection?.kind === "character" && selection.id === c.id ? " active" : ""}`}
            onClick={() => selectCharacter(c.id)}
          >
            {c.displayName}
            <span className="book-entry-count"> ({c.entries.length})</span>
          </div>
        ))}
        {book.characters.every((c) => c.entries.length === 0) && book.chapters.length === 0 && (
          <p className="microcopy">Nothing has been written yet.</p>
        )}
      </div>

      <div className="panel book-reader">
        {chapter && currentBeat ? (
          <>
            <div className="book-reader-header">
              <p className="panel-title" style={{ border: "none", margin: 0, padding: 0 }}>
                {chapter.title} — {currentBeat.locator}
                <span className="book-source-tag"> assembled chapter</span>
              </p>
              <div className="book-nav">
                <button disabled={selectedBeatIndex <= 0} onClick={() => setSelectedBeatIndex((i) => i - 1)}>
                  ← previous
                </button>
                <button
                  disabled={selectedBeatIndex >= chapter.beats.length - 1}
                  onClick={() => setSelectedBeatIndex((i) => i + 1)}
                >
                  next →
                </button>
              </div>
            </div>
            <div className="book-text">{currentBeat.text}</div>

            <div className="book-perspectives">
              <p className="panel-title">Read this beat from a character's raw account</p>
              {(book.byLocator[currentBeat.locator] ?? []).length === 0 ? (
                <p className="microcopy">No character account exists for this locator.</p>
              ) : (
                (book.byLocator[currentBeat.locator] ?? []).map((e) => {
                  const c = book.characters.find((ch) => ch.id === e.agentId);
                  return (
                    <div key={entryKey(e)} className="book-perspective-item" onClick={() => jumpTo(e)}>
                      <span className="book-perspective-name">{c?.displayName ?? e.agentId}</span>
                      <span className="book-source-tag"> {e.source === "actions" ? "own account" : "downstream effect"}</span>
                    </div>
                  );
                })
              )}
            </div>

            <StoryboardPanel beats={book.storyboardByLocator[currentBeat.locator] ?? []} characters={book.characters} />
          </>
        ) : character && selectedEntry ? (
          <>
            <div className="book-reader-header">
              <p className="panel-title" style={{ border: "none", margin: 0, padding: 0 }}>
                {character.displayName} — {selectedEntry.locator}
                <span className="book-source-tag"> {selectedEntry.source === "actions" ? "own account" : "downstream effect"}</span>
              </p>
              <div className="book-nav">
                <button
                  disabled={entryIndex <= 0}
                  onClick={() => character.entries[entryIndex - 1] && setSelectedEntry(character.entries[entryIndex - 1]!)}
                >
                  ← previous
                </button>
                <button
                  disabled={entryIndex < 0 || entryIndex >= character.entries.length - 1}
                  onClick={() => character.entries[entryIndex + 1] && setSelectedEntry(character.entries[entryIndex + 1]!)}
                >
                  next →
                </button>
              </div>
            </div>
            <div className="book-text">{selectedEntry.text}</div>

            <div className="book-perspectives">
              <p className="panel-title">Read this beat from another perspective</p>
              {otherPerspectives.length === 0 ? (
                <p className="microcopy">No one else recorded this beat.</p>
              ) : (
                otherPerspectives.map((e) => {
                  const c = book.characters.find((ch) => ch.id === e.agentId);
                  return (
                    <div key={entryKey(e)} className="book-perspective-item" onClick={() => jumpTo(e)}>
                      <span className="book-perspective-name">{c?.displayName ?? e.agentId}</span>
                      <span className="book-source-tag"> {e.source === "actions" ? "own account" : "downstream effect"}</span>
                    </div>
                  );
                })
              )}
            </div>

            <StoryboardPanel beats={book.storyboardByLocator[selectedEntry.locator] ?? []} characters={book.characters} />
          </>
        ) : (
          <p className="inspector-empty">Choose a chapter or a character to begin reading.</p>
        )}
      </div>
    </div>
  );
}
