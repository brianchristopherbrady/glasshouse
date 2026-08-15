// Shared types for "Book" mode: reads the world/<agent>_actions/*.md files
// (see .github/skills/dispatch/SKILL.md and .github/skills/downstream/SKILL.md)
// as an interactive, cross-character narrative. Every entry here is a
// verbatim excerpt from those files under its own chapter.thread.entry
// locator -- nothing is invented or paraphrased.

export type BookSource = "actions" | "downstream";

export interface BookEntry {
  agentId: string;
  source: BookSource;
  locator: string; // e.g. "1.1.3"
  chapter: number;
  thread: number;
  entry: number;
  text: string;
}

export interface BookCharacter {
  id: string;
  displayName: string;
  entries: BookEntry[];
}

// A single chapter.thread.entry section of an assembled chapter -- see
// .github/skills/writer/SKILL.md's world/chapters/chapter-<N>.md format.
// This is prose the writer Skill assembled from storyboard descriptions,
// not a verbatim ledger excerpt like BookEntry.
export interface ChapterBeat {
  locator: string;
  chapter: number;
  thread: number;
  entry: number;
  text: string;
}

export interface Chapter {
  number: number;
  title: string;
  beats: ChapterBeat[];
}

// One entry from world/storyboard.json -- see .github/skills/storyboard/SKILL.md.
// This is the intermediate "panel description" step between the raw ledger
// (BookEntry) and assembled chapter prose (ChapterBeat): who's involved,
// whether Bloomrot is legitimately in view for them yet, and what the
// description is actually grounded in.
export interface StoryboardBeat {
  locator: string;
  agentId: string;
  source: BookSource;
  description: string;
  involves: string[];
  bloomrotAware: boolean;
  citedSources: string[];
}

export interface BookData {
  characters: BookCharacter[];
  /** All entries across every character/source sharing the same locator,
   * keyed by locator string -- this is what powers "read this beat from
   * another character's perspective". */
  byLocator: Record<string, BookEntry[]>;
  /** Assembled chapters from world/chapters/chapter-<N>.md, if any exist --
   * produced by the writer Skill from world/storyboard.json. Empty until a
   * chapter has actually been drafted; Book mode should not assume this is
   * ever non-empty. */
  chapters: Chapter[];
  /** All world/storyboard.json entries, keyed by locator -- lets Book mode
   * show the storyboard's own panel description/involvement/Bloomrot-
   * awareness/citations for whichever beat is currently being read,
   * regardless of whether that beat is a raw ledger entry or an assembled
   * chapter beat. */
  storyboardByLocator: Record<string, StoryboardBeat[]>;
}
